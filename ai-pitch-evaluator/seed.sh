#!/usr/bin/env bash
#
# AI Startup Pitch Evaluator — Full Build & Deploy Script
#
# Builds all 4 BAML agents, deploys all 5 workers, and sets secrets.
# Service bindings are declared in pitch-api/flameflare.toml and
# configured automatically during deploy.
#
# Required environment variables:
#   FLAMEFLARE_URL        - API base URL (e.g. http://localhost:4000/client/v4)
#   FLAMEFLARE_API_KEY    - API bearer token
#   OPENAI_API_KEY        - OpenAI API key for the agents
#
# Optional:
#   FLAMEFLARE_ACCOUNT_ID - Account UUID (auto-detected by CLI if not set)
#
set -euo pipefail

: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY}"
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FF_CLI="$(cd "${SCRIPT_DIR}/../.." && pwd)/apps/cli/src/index.ts"
ff() { bun run "${FF_CLI}" "$@"; }

echo ""
echo "=== AI Startup Pitch Evaluator — Build & Deploy ==="
echo ""

# Build + deploy each BAML agent
for agent in market-analyst financial-reviewer tech-assessor verdict-agent; do
  echo "--- Building ${agent} ---"
  (cd "${SCRIPT_DIR}/${agent}" && npm install --silent 2>&1 && npm run generate 2>&1 && npm run build 2>&1) || {
    echo "Error: Build failed for ${agent}" >&2; exit 1
  }

  echo "--- Deploying ${agent} ---"
  (cd "${SCRIPT_DIR}/${agent}/dist" && ff deploy)

  echo "--- Setting OPENAI_API_KEY secret on ${agent} ---"
  ff secret put OPENAI_API_KEY -n "${agent}" --value "${OPENAI_API_KEY}"
  echo ""
done

# Deploy pitch-api (plain JS, no build needed)
# Service bindings (MARKET_ANALYST, FINANCIAL_REVIEWER, TECH_ASSESSOR, VERDICT_AGENT)
# are declared in pitch-api/flameflare.toml.
echo "--- Deploying pitch-api ---"
(cd "${SCRIPT_DIR}/pitch-api" && ff deploy)
echo ""

echo "=== Deployment Complete ==="
echo ""
echo "Components:"
echo "  Workers:          pitch-api, market-analyst, financial-reviewer, tech-assessor, verdict-agent"
echo "  Queue:            evaluation-queue (auto)"
echo "  Workflow:         pitch-evaluation (auto)"
echo "  Service bindings: MARKET_ANALYST, FINANCIAL_REVIEWER, TECH_ASSESSOR, VERDICT_AGENT"
echo ""
echo "Test: ./test.sh"
