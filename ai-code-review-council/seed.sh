#!/usr/bin/env bash
#
# AI Code Review Council — Full Build & Deploy Script
#
# Builds all 3 BAML agents, deploys all 4 workers, sets secrets,
# and adds service bindings.
#
# Required environment variables:
#   FLAMEFLARE_URL        - API base URL (e.g. http://localhost:4000/client/v4)
#   FLAMEFLARE_API_KEY      - API bearer token
#   OPENAI_API_KEY        - OpenAI API key for the agents
#
# Optional:
#   FLAMEFLARE_ACCOUNT_ID - Account UUID (auto-detected if not set)
#
set -euo pipefail

: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY}"
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY}"

# Auto-detect account ID
if [ -z "${FLAMEFLARE_ACCOUNT_ID:-}" ]; then
  FLAMEFLARE_ACCOUNT_ID=$(curl -sf \
    -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
    "${FLAMEFLARE_URL}/accounts" \
    | jq -r '.result[0].id' 2>/dev/null) || true
  if [ -z "${FLAMEFLARE_ACCOUNT_ID:-}" ]; then
    echo "Error: Could not auto-detect account ID." >&2; exit 1
  fi
  echo "Account ID: ${FLAMEFLARE_ACCOUNT_ID}"
fi
export FLAMEFLARE_ACCOUNT_ID

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FF_CLI="$(cd "${SCRIPT_DIR}/../.." && pwd)/apps/cli/src/index.ts"
FF_DEPLOY="bun run ${FF_CLI} deploy --token ${FLAMEFLARE_API_KEY} --api-url ${FLAMEFLARE_URL} --account-id ${FLAMEFLARE_ACCOUNT_ID}"

echo ""
echo "=== AI Code Review Council — Build & Deploy ==="
echo ""

set_secret() {
  local worker="$1"
  local name="$2"
  local value="$3"
  curl -sf -X PUT \
    "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/scripts/${worker}/secrets" \
    -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name}\",\"text\":\"${value}\",\"type\":\"secret_text\"}" > /dev/null 2>&1 || true
}

# Build + deploy each BAML agent
for agent in architect-agent security-agent synthesizer-agent; do
  echo "--- Building ${agent} ---"
  (cd "${SCRIPT_DIR}/${agent}" && npm install --silent 2>&1 && npm run generate 2>&1 && npm run build 2>&1) || {
    echo "Error: Build failed for ${agent}" >&2; exit 1
  }

  echo "--- Deploying ${agent} ---"
  (cd "${SCRIPT_DIR}/${agent}/dist" && \
    FLAMEFLARE_URL="${FLAMEFLARE_URL}" \
    FLAMEFLARE_API_KEY="${FLAMEFLARE_API_KEY}" \
    FLAMEFLARE_ACCOUNT_ID="${FLAMEFLARE_ACCOUNT_ID}" \
    ${FF_DEPLOY})

  echo "--- Setting OPENAI_API_KEY secret on ${agent} ---"
  set_secret "${agent}" "OPENAI_API_KEY" "${OPENAI_API_KEY}"
  echo ""
done

# Deploy review-api (plain JS, no build needed)
echo "--- Deploying review-api ---"
(cd "${SCRIPT_DIR}/review-api" && \
  FLAMEFLARE_URL="${FLAMEFLARE_URL}" \
  FLAMEFLARE_API_KEY="${FLAMEFLARE_API_KEY}" \
  FLAMEFLARE_ACCOUNT_ID="${FLAMEFLARE_ACCOUNT_ID}" \
  ${FF_DEPLOY})
echo ""

# Add 3 service bindings to review-api
echo "--- Adding service bindings to review-api ---"
EXISTING=$(curl -sf \
  "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/scripts/review-api/settings" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  | jq '{bindings: ([.result.bindings[]? | select(.name != "ARCHITECT_AGENT" and .name != "SECURITY_AGENT" and .name != "SYNTHESIZER_AGENT")] + [{"type":"service_binding","name":"ARCHITECT_AGENT","service":"architect-agent"},{"type":"service_binding","name":"SECURITY_AGENT","service":"security-agent"},{"type":"service_binding","name":"SYNTHESIZER_AGENT","service":"synthesizer-agent"}])}' 2>/dev/null) || EXISTING='{"bindings":[{"type":"service_binding","name":"ARCHITECT_AGENT","service":"architect-agent"},{"type":"service_binding","name":"SECURITY_AGENT","service":"security-agent"},{"type":"service_binding","name":"SYNTHESIZER_AGENT","service":"synthesizer-agent"}]}'

SVC_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/scripts/review-api/settings" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "${EXISTING}") || true

if [ "${SVC_RESP:-0}" -ge 200 ] && [ "${SVC_RESP:-0}" -lt 300 ]; then
  echo "Service bindings added successfully"
else
  echo "Warning: Service binding setup returned HTTP ${SVC_RESP}" >&2
fi
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