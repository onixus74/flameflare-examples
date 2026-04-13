#!/usr/bin/env bash
#
# End-to-end test for the AI Code Review Council.
# Uses the FlameFlare CLI for dispatch.
#
# Required environment variables:
#   FLAMEFLARE_URL        - API base URL
#   FLAMEFLARE_API_KEY    - API bearer token
#   OPENAI_API_KEY        - OpenAI API key for AI agent calls
#
set -euo pipefail

: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY}"
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY for AI agent calls}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FF_CLI="$(cd "${SCRIPT_DIR}/../.." && pwd)/apps/cli/src/index.ts"
ff() { bun run "${FF_CLI}" "$@"; }

echo "=== AI Code Review Council — End-to-End Test ==="
echo ""

echo "1. Submitting code for review..."
RESPONSE=$(ff dispatch /review -n review-api -X POST -d '{
    "code": "function fetchUser(id) {\n  const query = \"SELECT * FROM users WHERE id = \" + id;\n  return db.query(query);\n}",
    "language": "javascript"
  }')

echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

SUCCESS=$(echo "$RESPONSE" | jq -r 'if .success then "yes" else "no" end' 2>/dev/null) || SUCCESS="no"
if [ "$SUCCESS" = "yes" ]; then
  echo "2. Review completed successfully!"
  VERDICT=$(echo "$RESPONSE" | jq -r '"Verdict: \(.verdict.verdict // "?") (score: \(.verdict.overall_score // "?")/10)"' 2>/dev/null) || true
  echo "   $VERDICT"
else
  echo "2. Review failed or incomplete."
fi
echo ""
echo "=== Test Complete ==="
