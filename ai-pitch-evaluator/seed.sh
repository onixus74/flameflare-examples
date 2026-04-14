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
echo "=== AI Startup Pitch Evaluator — Build & Deploy ==="
echo ""

# Build + deploy each BAML agent (build runs automatically via [build] in flameflare.toml)
for agent in market-analyst financial-reviewer tech-assessor verdict-agent; do
  echo "--- Deploying ${agent} ---"
  (cd "${SCRIPT_DIR}/${agent}" && ff deploy)

  if [ -n "${OPENAI_API_KEY:-}" ]; then
    echo "--- Setting OPENAI_API_KEY secret on ${agent} ---"
    ff secret put OPENAI_API_KEY -n "${agent}" --value "${OPENAI_API_KEY}"
  fi
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
