# BAML Worker Example

Demonstrates deploying a Worker with npm native addon dependencies, using [BAML](https://docs.boundaryml.com) for structured LLM extraction.

## What is BAML?

BAML (Boundary ML) is a domain-specific language for defining type-safe LLM function calls. It generates a TypeScript/JS client that handles structured output parsing and validation. The `@boundaryml/baml` npm package includes a Rust-based native addon (NAPI-RS).

## Prerequisites

- Node.js 18+
- An OpenAI API key
- FlameFlare running and accessible

## Setup

```bash
# Install dependencies (gets @boundaryml/baml + native addon for your platform)
npm install

# Generate baml_client/ from baml_src/ definitions
npm run generate

# Build dist/ directory with correct server-platform native addon
npm run build
# Or specify a different target platform:
# TARGET_PLATFORM=darwin-arm64 npm run build
```

## Deploy

```bash
# Deploy to FlameFlare
ff deploy

# Set the OpenAI API key as a secret binding
curl -X PUT "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/scripts/baml-worker/secrets" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "OPENAI_API_KEY", "text": "sk-...", "type": "secret_text"}'
```

## Test

```bash
# GET — see usage info
curl "$FLAMEFLARE_URL/client/v4/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/baml-worker/dispatch/"

# POST — extract structured data from resume text
curl -X POST "$FLAMEFLARE_URL/client/v4/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/baml-worker/dispatch/" \
  -H "Content-Type: application/json" \
  -d '{"resume_text": "John Doe, CTO at Acme Inc. Expert in Python and Rust. MIT 2015."}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "title": "CTO",
    "company": "Acme Inc",
    "skills": ["Python", "Rust"],
    "education": "MIT 2015"
  }
}
```

## How the build works

The `scripts/build.sh` script handles the cross-platform native addon problem:

1. Copies `src/index.mjs` to `dist/`
2. Copies the generated `baml_client/` to `dist/baml_client/`
3. Copies `@boundaryml/baml` from `node_modules/` to `dist/node_modules/`
4. Installs the **target platform's** native addon (e.g., `@boundaryml/baml-linux-x64-gnu`) into `dist/node_modules/`
5. Creates a `flameflare.toml` in `dist/` for deployment

This ensures the deployed package contains the correct native binary for the server, regardless of the developer's local platform.

## Architecture notes

- BAML's `@boundaryml/baml` uses NAPI-RS (Rust native addon) — not WASM, not pure JS
- Cannot be bundled by esbuild/rollup — requires `node_modules/` at runtime
- The build script handles cross-compilation by installing the server's platform addon
- A WASI fallback exists but is experimental; set `NAPI_RS_FORCE_WASI=1` if needed