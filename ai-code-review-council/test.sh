#!/usr/bin/env bash
#
# End-to-end test for the AI Code Review Council.
# Requires OPENAI_API_KEY to be set.
#
set -euo pipefail

: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY}"
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY for AI agent calls}"

if [ -z "${FLAMEFLARE_ACCOUNT_ID:-}" ]; then
  FLAMEFLARE_ACCOUNT_ID=$(curl -sf \
    -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
    "${FLAMEFLARE_URL}/accounts" \
    | jq -r '.result[0].id' 2>/dev/null) || true
fi
: "${FLAMEFLARE_ACCOUNT_ID:?Could not detect account ID}"

BASE="${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers"

echo "=== AI Code Review Council — End-to-End Test ==="
echo ""

echo "1. Submitting code for review..."
RESPONSE=$(curl -s -X POST "${BASE}/review-api/dispatch/review" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
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