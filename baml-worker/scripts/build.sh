#!/usr/bin/env bash
#
# Build script for the BAML Worker.
#
# Assembles a dist/ directory containing:
#   - Worker entry point (index.mjs) bundled with baml_client
#   - @boundaryml/baml package with the correct native addon for the TARGET platform
#
# The target platform defaults to linux-x64-gnu (typical server).
# Override with: TARGET_PLATFORM=darwin-arm64 npm run build
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"

# Target platform for the server (default: linux-x64-gnu)
TARGET_PLATFORM="${TARGET_PLATFORM:-linux-x64-gnu}"

echo "Building BAML Worker for target platform: ${TARGET_PLATFORM}"

# --- Clean ---
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# --- Ensure baml_client is generated ---
if [ ! -d "$PROJECT_DIR/baml_client" ]; then
  echo "Error: baml_client/ not found. Run 'npm run generate' first." >&2
  exit 1
fi

# --- Bundle worker + baml_client with esbuild ---
# esbuild bundles src/index.mjs and all its imports (including baml_client/*.ts)
# into a single dist/index.mjs. The @boundaryml/baml native package is marked
# external since it must be loaded from node_modules at runtime.
echo "Bundling worker with esbuild..."
npx esbuild "$PROJECT_DIR/src/index.mjs" \
  --bundle \
  --platform=node \
  --format=esm \
  --outfile="$DIST_DIR/index.mjs" \
  --external:@boundaryml/baml \
  --target=node18

# --- Copy @boundaryml/baml package ---
BAML_PKG="$PROJECT_DIR/node_modules/@boundaryml/baml"
if [ ! -d "$BAML_PKG" ]; then
  echo "Error: @boundaryml/baml not found in node_modules. Run 'npm install' first." >&2
  exit 1
fi

mkdir -p "$DIST_DIR/node_modules/@boundaryml"
cp -r "$BAML_PKG" "$DIST_DIR/node_modules/@boundaryml/baml"

# --- Install target platform native addon ---
# Remove any local platform addon that was installed (e.g., darwin-arm64 from dev machine)
rm -rf "$DIST_DIR/node_modules/@boundaryml/baml-"*

# Install the target platform's native addon.
# --force is required when cross-installing (e.g. linux addon on macOS dev machine).
# We use a temp directory to avoid npm cleaning up our already-copied node_modules.
# Pin the version to match the installed @boundaryml/baml package.
BAML_VERSION=$(node -e "console.log(require('$DIST_DIR/node_modules/@boundaryml/baml/package.json').version)")
TARGET_PKG="@boundaryml/baml-${TARGET_PLATFORM}@${BAML_VERSION}"
echo "Installing target native addon: ${TARGET_PKG}"

ADDON_TMPDIR=$(mktemp -d)
cd "$ADDON_TMPDIR"
npm install --force --no-save "${TARGET_PKG}" 2>&1 | tail -3 || true

if [ -d "$ADDON_TMPDIR/node_modules/@boundaryml/baml-${TARGET_PLATFORM}" ]; then
  cp -r "$ADDON_TMPDIR/node_modules/@boundaryml/baml-${TARGET_PLATFORM}" \
        "$DIST_DIR/node_modules/@boundaryml/baml-${TARGET_PLATFORM}"
  echo "Installed native addon for ${TARGET_PLATFORM}"
else
  echo ""
  echo "Warning: Could not install ${TARGET_PKG}."
  echo "The BAML WASI fallback may be used at runtime."
  echo "To use WASI explicitly, set NAPI_RS_FORCE_WASI=1 in your env bindings."
  echo ""
fi
rm -rf "$ADDON_TMPDIR"

# --- Create a flameflare.toml for ff deploy ---
cat > "$DIST_DIR/flameflare.toml" <<'EOF'
name = "baml-worker"
main = "index.mjs"
compatibility_date = "2024-01-01"
runtime = "node"
EOF

echo ""
echo "Build complete! Output in dist/"
echo ""
echo "To deploy:"
echo "  cd dist && ff deploy"
echo ""
echo "Don't forget to set the OPENAI_API_KEY secret after deploying:"
echo "  curl -X PUT \"\$FLAMEFLARE_URL/accounts/\$FLAMEFLARE_ACCOUNT_ID/workers/scripts/baml-worker/secrets\" \\"
echo "    -H \"Authorization: Bearer \$FLAMEFLARE_API_KEY\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"name\": \"OPENAI_API_KEY\", \"text\": \"sk-...\", \"type\": \"secret_text\"}'"
