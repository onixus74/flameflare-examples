#!/usr/bin/env bash
#
# AI Startup Pitch Evaluator — Test Script
#
# Tests the deployed pitch evaluation system by submitting a sample pitch.
#
# Required environment variables:
#   FLAMEFLARE_URL    - API base URL
#   FLAMEFLARE_API_KEY  - API bearer token
#
set -euo pipefail

: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY}"

# Auto-detect account ID
if [ -z "${FLAMEFLARE_ACCOUNT_ID:-}" ]; then
  FLAMEFLARE_ACCOUNT_ID=$(curl -sf \
    -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
    "${FLAMEFLARE_URL}/accounts" \
    | jq -r '.result[0].id' 2>/dev/null) || true
  if [ -z "${FLAMEFLARE_ACCOUNT_ID:-}" ]; then
    echo "Error: Could not auto-detect account ID." >&2; exit 1
  fi
fi
export FLAMEFLARE_ACCOUNT_ID

WORKER_URL="${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/scripts/pitch-api/dispatch/evaluate"

echo "=== AI Startup Pitch Evaluator — Test ==="
echo ""
echo "Testing pitch evaluation at:"
echo "  ${WORKER_URL}"
echo ""

# Sample startup pitch for testing
SAMPLE_PITCH="FreshFarm is a direct-to-consumer marketplace connecting local organic farmers with urban households. We handle logistics, cold-chain delivery, and subscription management. Currently operating in 3 cities with 200 active farms and 5,000 subscribers. Revenue is $80K/month with 40% gross margins. We're raising $2M to expand to 10 cities and build our own delivery fleet."

echo "Submitting sample pitch:"
echo "\"${SAMPLE_PITCH}\""
echo ""

RESPONSE=$(curl -sf -X POST "${WORKER_URL}" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"pitch\": \"${SAMPLE_PITCH}\"}" 2>/dev/null) || {
  echo "Error: Failed to submit pitch evaluation" >&2
  exit 1
}

echo "Response received:"
echo "${RESPONSE}" | jq . 2>/dev/null || echo "${RESPONSE}"
echo ""

# Check if the evaluation was successful
SUCCESS=$(echo "${RESPONSE}" | jq -r 'if .success then "yes" else "no" end' 2>/dev/null) || SUCCESS="no"

if [ "${SUCCESS}" = "yes" ]; then
  # Extract the verdict
  VERDICT=$(echo "${RESPONSE}" | jq -r '"DECISION: \(.verdict.decision // "Unknown") (\(.verdict.overall_score // 0)/10)\nSUMMARY: \(.verdict.summary // "No summary provided")"' 2>/dev/null) || VERDICT="Could not parse verdict"

  echo "=== INVESTMENT VERDICT ==="
  echo "${VERDICT}"
  echo ""
  echo "✅ Pitch evaluation completed successfully!"
else
  echo "❌ Pitch evaluation failed"
  exit 1
fi