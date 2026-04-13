#!/usr/bin/env bash
#
# AI Startup Pitch Evaluator — Test Script
#
# Tests the deployed pitch evaluation system by submitting a sample pitch
# using the FlameFlare CLI.
#
# Required environment variables:
#   FLAMEFLARE_URL        - API base URL
#   FLAMEFLARE_API_KEY    - API bearer token
#
set -euo pipefail

: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FF_CLI="$(cd "${SCRIPT_DIR}/../.." && pwd)/apps/cli/src/index.ts"
ff() { bun run "${FF_CLI}" "$@"; }

echo "=== AI Startup Pitch Evaluator — Test ==="
echo ""

# Sample startup pitch for testing
SAMPLE_PITCH="FreshFarm is a direct-to-consumer marketplace connecting local organic farmers with urban households. We handle logistics, cold-chain delivery, and subscription management. Currently operating in 3 cities with 200 active farms and 5,000 subscribers. Revenue is \$80K/month with 40% gross margins. We're raising \$2M to expand to 10 cities and build our own delivery fleet."

echo "Submitting sample pitch:"
echo "\"${SAMPLE_PITCH}\""
echo ""

RESPONSE=$(ff dispatch /evaluate -n pitch-api -X POST -d "{\"pitch\": \"${SAMPLE_PITCH}\"}") || {
  echo "Error: Failed to submit pitch evaluation" >&2
  exit 1
}

echo "Response received:"
echo "${RESPONSE}" | jq . 2>/dev/null || echo "${RESPONSE}"
echo ""

# Check if the evaluation was successful
SUCCESS=$(echo "${RESPONSE}" | jq -r 'if .success then "yes" else "no" end' 2>/dev/null) || SUCCESS="no"

if [ "${SUCCESS}" = "yes" ]; then
  VERDICT=$(echo "${RESPONSE}" | jq -r '"DECISION: \(.verdict.decision // "Unknown") (\(.verdict.overall_score // 0)/10)\nSUMMARY: \(.verdict.summary // "No summary provided")"' 2>/dev/null) || VERDICT="Could not parse verdict"

  echo "=== INVESTMENT VERDICT ==="
  echo "${VERDICT}"
  echo ""
  echo "Pitch evaluation completed successfully!"
else
  echo "Pitch evaluation failed"
  exit 1
fi
