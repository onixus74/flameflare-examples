#!/usr/bin/env bash
#
# Order Processing Pipeline — Full Deployment Script
#
# Deploys all four workers in the correct order using the FlameFlare CLI,
# then adds the two resources that cannot be declared in flameflare.toml:
#   1. A service binding from order-api → cleanup-worker (via settings PATCH)
#   2. A cron trigger for cleanup-worker (via cron-triggers API)
#
# Everything else (queues, queue consumers, workflow) is auto-created by the
# server when the workers are deployed — no extra API calls needed.
#
# Required environment variables:
#   FLAMEFLARE_URL        - API base URL (e.g. http://localhost:4000/client/v4)
#   FLAMEFLARE_API_KEY      - API bearer token
#
# Optional:
#   FLAMEFLARE_ACCOUNT_ID - Account UUID (auto-detected from API if not set)
#
# Usage:
#   cd examples/order-processing-pipeline && ./seed.sh
#
set -euo pipefail

# --- Validate env vars ---
: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL (e.g. http://localhost:4000/client/v4)}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY to your API token}"

# Auto-detect account ID if not provided
if [ -z "${FLAMEFLARE_ACCOUNT_ID:-}" ]; then
  FLAMEFLARE_ACCOUNT_ID=$(curl -sf \
    -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
    "${FLAMEFLARE_URL}/accounts" \
    | jq -r '.result[0].id' 2>/dev/null) || true

  if [ -z "${FLAMEFLARE_ACCOUNT_ID:-}" ]; then
    echo "Error: Could not auto-detect account ID. Set FLAMEFLARE_ACCOUNT_ID manually." >&2
    exit 1
  fi
  echo "Auto-detected account ID: ${FLAMEFLARE_ACCOUNT_ID}"
fi
export FLAMEFLARE_ACCOUNT_ID

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FF_CLI="$(cd "${SCRIPT_DIR}/../.." && pwd)/apps/cli/src/index.ts"
FF_DEPLOY="bun run ${FF_CLI} deploy --token ${FLAMEFLARE_API_KEY} --api-url ${FLAMEFLARE_URL} --account-id ${FLAMEFLARE_ACCOUNT_ID}"

echo ""
echo "=== Order Processing Pipeline Deployment ==="
echo ""
echo "  API:     ${FLAMEFLARE_URL}"
echo "  Account: ${FLAMEFLARE_ACCOUNT_ID}"
echo ""

# ----------------------------------------------------------------
# Step 1 — Deploy cleanup-worker first (order-api references it
#          via a service binding that we add in step 5).
# ----------------------------------------------------------------
echo "--- Step 1: Deploy cleanup-worker ---"
(cd "${SCRIPT_DIR}/cleanup-worker" && ${FF_DEPLOY})
echo ""

# ----------------------------------------------------------------
# Step 2 — Deploy payment-processor.
#          Its flameflare.toml declares [[queues.consumers]] for
#          "payment-queue", so the server auto-creates that queue
#          and registers the consumer.
# ----------------------------------------------------------------
echo "--- Step 2: Deploy payment-processor ---"
(cd "${SCRIPT_DIR}/payment-processor" && ${FF_DEPLOY})
echo ""

# ----------------------------------------------------------------
# Step 3 — Deploy notification-sender.
#          Same pattern: auto-creates "notification-queue".
# ----------------------------------------------------------------
echo "--- Step 3: Deploy notification-sender ---"
(cd "${SCRIPT_DIR}/notification-sender" && ${FF_DEPLOY})
echo ""

# ----------------------------------------------------------------
# Step 4 — Deploy order-api (the main entry point).
#          Its flameflare.toml declares:
#            [[queues.producers]]  → binding to payment-queue
#            [[workflows]]         → auto-creates order-fulfillment workflow
#            [vars]                → ORDER_API_KEY plain_text binding
# ----------------------------------------------------------------
echo "--- Step 4: Deploy order-api ---"
(cd "${SCRIPT_DIR}/order-api" && ${FF_DEPLOY})
echo ""

# ----------------------------------------------------------------
# Step 5 — Add service binding: order-api → cleanup-worker.
#          Service bindings are configured via the settings API
#          (same as Cloudflare), not in flameflare.toml.
# ----------------------------------------------------------------
echo "--- Step 5: Add service binding (order-api → cleanup-worker) ---"

# First get existing bindings so we don't overwrite them
EXISTING=$(curl -sf \
  "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/scripts/order-api/settings" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  | jq '{bindings: ([.result.bindings[]? | select(.name != "CLEANUP_SERVICE")] + [{"type":"service_binding","name":"CLEANUP_SERVICE","service":"cleanup-worker"}])}' 2>/dev/null) || EXISTING='{"bindings":[{"type":"service_binding","name":"CLEANUP_SERVICE","service":"cleanup-worker"}]}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH \
  "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/scripts/order-api/settings" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "${EXISTING}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "Service binding added successfully"
else
  echo "Warning: Could not add service binding (HTTP ${HTTP_CODE})" >&2
fi
echo ""

# ----------------------------------------------------------------
# Step 6 — Create cron trigger for cleanup-worker (*/5 * * * *).
# ----------------------------------------------------------------
echo "--- Step 6: Create cron trigger (cleanup-worker, every 5 min) ---"

# Look up the cleanup-worker's UUID
CLEANUP_ID=$(curl -sf \
  "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/scripts/cleanup-worker" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  | jq -r '.result.id // empty' 2>/dev/null) || true

if [ -z "${CLEANUP_ID:-}" ]; then
  echo "Warning: Could not look up cleanup-worker ID; skipping cron trigger." >&2
else
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/cron-triggers" \
    -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"cleanup-every-5min\",\"cron_expression\":\"*/5 * * * *\",\"target_type\":\"worker\",\"target_id\":\"${CLEANUP_ID}\",\"enabled\":true}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "Cron trigger created successfully"
  else
    echo "Warning: Cron trigger may already exist (HTTP ${HTTP_CODE})" >&2
  fi
fi
echo ""

# ----------------------------------------------------------------
# Done
# ----------------------------------------------------------------
echo "=== Deployment Complete ==="
echo ""
echo "Components:"
echo "  Workers:         order-api, payment-processor, notification-sender, cleanup-worker"
echo "  Queues:          payment-queue (auto), notification-queue (auto)"
echo "  Workflow:        order-fulfillment (auto)"
echo "  Cron:            cleanup-worker every 5 min"
echo "  Service binding: order-api → cleanup-worker"
echo ""
echo "Test:      ./test.sh"
echo "Dashboard: ${FLAMEFLARE_URL%/client/v4}/dashboard"
