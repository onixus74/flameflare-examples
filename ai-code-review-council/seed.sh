#!/usr/bin/env bash
#
# AI Code Review Council — Full Build & Deploy Script
#
# Builds all 3 BAML agents, deploys all 4 workers, and sets secrets.
# Service bindings are declared in review-api/flameflare.toml and
# configured automatically during deploy.
#
# Required environment variables:
#   FLAMEFLARE_URL        - API base URL (e.g. http://localhost:4000/client/v4)
#   FLAMEFLARE_API_KEY    - API bearer token
#
# Optional:
#   OPENAI_API_KEY        - OpenAI API key for the agents (secret set only if provided)
#   FLAMEFLARE_ACCOUNT_ID - Account UUID (auto-detected by CLI if not set)
#
set -euo pipefail

: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FF_CLI="${FF_CLI:-$(cd "${SCRIPT_DIR}/../.." && pwd)/apps/cli/src/index.ts}"
ff() { bun run "${FF_CLI}" "$@"; }

echo ""
echo "=== AI Code Review Council — Build & Deploy ==="
echo ""

# Build + deploy each BAML agent (build runs automatically via [build] in flameflare.toml)
for agent in architect-agent security-agent synthesizer-agent; do
  echo "--- Deploying ${agent} ---"
  (cd "${SCRIPT_DIR}/${agent}" && ff deploy)

  if [ -n "${OPENAI_API_KEY:-}" ]; then
    echo "--- Setting OPENAI_API_KEY secret on ${agent} ---"
    ff secret put OPENAI_API_KEY -n "${agent}" --value "${OPENAI_API_KEY}"
  fi
  echo ""
done

# Deploy review-api (plain JS, no build needed)
# Service bindings (ARCHITECT_AGENT, SECURITY_AGENT, SYNTHESIZER_AGENT)
# are declared in review-api/flameflare.toml.
echo "--- Deploying review-api ---"
(cd "${SCRIPT_DIR}/review-api" && ff deploy)
echo ""

echo "=== Deployment Complete ==="
echo ""
echo "Components:"
echo "  Workers:          review-api, architect-agent, security-agent, synthesizer-agent"
echo "  Queue:            verdict-queue (auto)"
echo "  Workflow:         code-review (auto)"
echo "  Service bindings: ARCHITECT_AGENT, SECURITY_AGENT, SYNTHESIZER_AGENT"
echo ""
echo "Test: ./test.sh"
