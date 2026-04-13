#!/usr/bin/env bash
#
# Order Processing Pipeline — Full Deployment Script
#
# Deploys all four workers in the correct order using the FlameFlare CLI.
# Service bindings and cron triggers are declared in flameflare.toml and
# configured automatically during deploy — no extra API calls needed.
#
# Required environment variables:
#   FLAMEFLARE_URL        - API base URL (e.g. http://localhost:4000/client/v4)
#   FLAMEFLARE_API_KEY    - API bearer token
#
# Optional:
#   FLAMEFLARE_ACCOUNT_ID - Account UUID (auto-detected by CLI if not set)
#
# Usage:
#   cd examples/order-processing-pipeline && ./seed.sh
#
set -euo pipefail

: "${FLAMEFLARE_URL:?Set FLAMEFLARE_URL (e.g. http://localhost:4000/client/v4)}"
: "${FLAMEFLARE_API_KEY:?Set FLAMEFLARE_API_KEY to your API token}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FF_CLI="$(cd "${SCRIPT_DIR}/../.." && pwd)/apps/cli/src/index.ts"
ff() { bun run "${FF_CLI}" "$@"; }

echo ""
echo "=== Order Processing Pipeline Deployment ==="
echo ""
echo "  API: ${FLAMEFLARE_URL}"
echo ""

# ----------------------------------------------------------------
# Step 1 — Deploy cleanup-worker first (order-api references it
#          via a service binding declared in its flameflare.toml).
#          Cron trigger (*/5 * * * *) is also in flameflare.toml.
# ----------------------------------------------------------------
echo "--- Step 1: Deploy cleanup-worker ---"
(cd "${SCRIPT_DIR}/cleanup-worker" && ff deploy)
echo ""

# ----------------------------------------------------------------
# Step 2 — Deploy payment-processor.
#          Its flameflare.toml declares [[queues.consumers]] for
#          "payment-queue", so the server auto-creates that queue
#          and registers the consumer.
# ----------------------------------------------------------------
echo "--- Step 2: Deploy payment-processor ---"
(cd "${SCRIPT_DIR}/payment-processor" && ff deploy)
echo ""

# ----------------------------------------------------------------
# Step 3 — Deploy notification-sender.
#          Same pattern: auto-creates "notification-queue".
# ----------------------------------------------------------------
echo "--- Step 3: Deploy notification-sender ---"
(cd "${SCRIPT_DIR}/notification-sender" && ff deploy)
echo ""

# ----------------------------------------------------------------
# Step 4 — Deploy order-api (the main entry point).
#          Its flameflare.toml declares:
#            [[queues.producers]]  → binding to payment-queue
#            [[workflows]]         → auto-creates order-fulfillment workflow
#            [[services]]          → CLEANUP_SERVICE → cleanup-worker
#            [vars]                → ORDER_API_KEY plain_text binding
# ----------------------------------------------------------------
echo "--- Step 4: Deploy order-api ---"
(cd "${SCRIPT_DIR}/order-api" && ff deploy)
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
