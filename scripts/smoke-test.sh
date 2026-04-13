#!/usr/bin/env bash
#
# Smoke test: deploy all examples and verify they execute correctly.
#
# Usage:
#   examples/scripts/smoke-test.sh <base_url> <token>
#
# Examples:
#   examples/scripts/smoke-test.sh http://localhost:4000/client/v4 "$LOCAL_TOKEN"
#   examples/scripts/smoke-test.sh https://flameflare.fly.dev/client/v4 "$PROD_TOKEN"
#
set -euo pipefail

BASE="${1:?Usage: smoke-test.sh <base_url> <token>}"
TOKEN="${2:?Usage: smoke-test.sh <base_url> <token>}"
AUTH="Authorization: Bearer ${TOKEN}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXAMPLES_DIR="${SCRIPT_DIR}/.."
FF_CLI="${EXAMPLES_DIR}/../apps/cli/src/index.ts"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

# --- Auto-detect account ID ---
echo -e "${BOLD}Detecting account ID...${NC}"
ACCT=$(curl -s "${BASE}/accounts" -H "${AUTH}" \
  | jq -r '.result[0].id' 2>/dev/null) || true

if [ -z "${ACCT:-}" ]; then
  echo -e "${RED}Error: Could not detect account ID. Is the server running?${NC}" >&2
  exit 1
fi
echo -e "Account ID: ${ACCT}"
echo ""

# ============================================================
# Phase 1: Deploy all examples
# ============================================================
echo -e "${BOLD}=== Phase 1: Deploying all examples ===${NC}"
echo ""

DEPLOY_PASS=0
DEPLOY_FAIL=0
DEPLOY_FAILURES=""

for dir in "${EXAMPLES_DIR}"/*/; do
  [ -f "${dir}/flameflare.toml" ] || continue
  name=$(basename "$dir")

  # Skip examples that require a manual build step (main target doesn't exist yet)
  main_file=$(grep '^main' "${dir}/flameflare.toml" | head -1 | sed 's/.*= *"\(.*\)"/\1/')
  if [ -n "$main_file" ] && [ ! -f "${dir}/${main_file}" ]; then
    echo -e "  Deploying ${name}... ${YELLOW}SKIP${NC} (main file ${main_file} not found; build required)"
    continue
  fi

  echo -n "  Deploying ${name}... "
  OUTPUT=$(cd "$dir" && bun run "${FF_CLI}" deploy --token "${TOKEN}" --api-url "${BASE}" --account-id "${ACCT}" 2>&1) || true

  if [[ "$OUTPUT" == *"successfully"* ]]; then
    echo -e "${GREEN}OK${NC}"
    DEPLOY_PASS=$((DEPLOY_PASS + 1))
  else
    echo -e "${RED}FAILED${NC}"
    DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
    last_line="${OUTPUT##*$'\n'}"
    DEPLOY_FAILURES="${DEPLOY_FAILURES}  ${name}: ${last_line}\n"
  fi
done

# Deploy multi-worker example: order-processing-pipeline
OPP="${EXAMPLES_DIR}/order-processing-pipeline"
if [ -d "${OPP}/order-api" ]; then
  for worker_dir in "${OPP}"/*/; do
    [ -f "${worker_dir}/flameflare.toml" ] || continue
    wname=$(basename "$worker_dir")
    echo -n "  Deploying order-processing-pipeline/${wname}... "
    OUTPUT=$(cd "$worker_dir" && bun run "${FF_CLI}" deploy --token "${TOKEN}" --api-url "${BASE}" --account-id "${ACCT}" 2>&1) || true
    if [[ "$OUTPUT" == *"successfully"* ]]; then
      echo -e "${GREEN}OK${NC}"
      DEPLOY_PASS=$((DEPLOY_PASS + 1))
    else
      echo -e "${RED}FAILED${NC}"
      DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
      last_line="${OUTPUT##*$'\n'}"
      DEPLOY_FAILURES="${DEPLOY_FAILURES}  order-processing-pipeline/${wname}: ${last_line}\n"
    fi
  done

  # Add service binding: order-api → cleanup-worker
  echo -n "  Adding service binding (order-api → cleanup-worker)... "
  EXISTING=$(curl -sf "${BASE}/accounts/${ACCT}/workers/scripts/order-api/settings" -H "${AUTH}" \
    | jq '{bindings: ([.result.bindings[]? | select(.name != "CLEANUP_SERVICE")] + [{"type":"service_binding","name":"CLEANUP_SERVICE","service":"cleanup-worker"}])}' 2>/dev/null) || EXISTING='{"bindings":[{"type":"service_binding","name":"CLEANUP_SERVICE","service":"cleanup-worker"}]}'
  SVC_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "${BASE}/accounts/${ACCT}/workers/scripts/order-api/settings" \
    -H "${AUTH}" -H "Content-Type: application/json" -d "${EXISTING}") || true
  if [ "${SVC_RESP:-0}" -ge 200 ] && [ "${SVC_RESP:-0}" -lt 300 ]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}WARN (HTTP ${SVC_RESP})${NC}"
  fi
fi

# Deploy multi-agent example: ai-code-review-council (BAML agents)
COUNCIL="${EXAMPLES_DIR}/ai-code-review-council"
if [ -d "${COUNCIL}/review-api" ]; then
  # Source .env for OPENAI_API_KEY
  source "${EXAMPLES_DIR}/../.env" 2>/dev/null || true

  # Build + deploy each BAML agent
  for agent in architect-agent security-agent synthesizer-agent; do
    echo -n "  Building ai-code-review-council/${agent}... "
    BUILD_OUT=$(cd "${COUNCIL}/${agent}" && npm install --silent 2>&1 && npm run generate 2>&1 && npm run build 2>&1) || true
    if [ -d "${COUNCIL}/${agent}/dist" ]; then
      echo -e "${GREEN}OK${NC}"
      echo -n "  Deploying ai-code-review-council/${agent}... "
      OUTPUT=$(cd "${COUNCIL}/${agent}/dist" && bun run "${FF_CLI}" deploy --token "${TOKEN}" --api-url "${BASE}" --account-id "${ACCT}" 2>&1) || true
      if [[ "$OUTPUT" == *"successfully"* ]]; then
        echo -e "${GREEN}OK${NC}"
        DEPLOY_PASS=$((DEPLOY_PASS + 1))
      else
        echo -e "${RED}FAILED${NC}"
        DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
        last_line="${OUTPUT##*$'\n'}"
        DEPLOY_FAILURES="${DEPLOY_FAILURES}  ai-code-review-council/${agent}: ${last_line}\n"
      fi
      # Set OPENAI_API_KEY secret if available
      if [ -n "${OPENAI_API_KEY:-}" ]; then
        curl -sf -X PUT \
          "${BASE}/accounts/${ACCT}/workers/scripts/${agent}/secrets" \
          -H "${AUTH}" -H "Content-Type: application/json" \
          -d "{\"name\":\"OPENAI_API_KEY\",\"text\":\"${OPENAI_API_KEY}\",\"type\":\"secret_text\"}" > /dev/null 2>&1 || true
      fi
    else
      echo -e "${RED}FAILED${NC} (build produced no dist/)"
      DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
      DEPLOY_FAILURES="${DEPLOY_FAILURES}  ai-code-review-council/${agent}: build failed\n"
    fi
  done

  # Deploy review-api (plain JS, no build)
  echo -n "  Deploying ai-code-review-council/review-api... "
  OUTPUT=$(cd "${COUNCIL}/review-api" && bun run "${FF_CLI}" deploy --token "${TOKEN}" --api-url "${BASE}" --account-id "${ACCT}" 2>&1) || true
  if [[ "$OUTPUT" == *"successfully"* ]]; then
    echo -e "${GREEN}OK${NC}"
    DEPLOY_PASS=$((DEPLOY_PASS + 1))
  else
    echo -e "${RED}FAILED${NC}"
    DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
    last_line="${OUTPUT##*$'\n'}"
    DEPLOY_FAILURES="${DEPLOY_FAILURES}  ai-code-review-council/review-api: ${last_line}\n"
  fi

  # Add 3 service bindings to review-api
  echo -n "  Adding service bindings (review-api → agents)... "
  EXISTING=$(curl -sf "${BASE}/accounts/${ACCT}/workers/scripts/review-api/settings" -H "${AUTH}" \
    | jq '{bindings: ([.result.bindings[]? | select(.name != "ARCHITECT_AGENT" and .name != "SECURITY_AGENT" and .name != "SYNTHESIZER_AGENT")] + [{"type":"service_binding","name":"ARCHITECT_AGENT","service":"architect-agent"},{"type":"service_binding","name":"SECURITY_AGENT","service":"security-agent"},{"type":"service_binding","name":"SYNTHESIZER_AGENT","service":"synthesizer-agent"}])}' 2>/dev/null) || EXISTING='{"bindings":[{"type":"service_binding","name":"ARCHITECT_AGENT","service":"architect-agent"},{"type":"service_binding","name":"SECURITY_AGENT","service":"security-agent"},{"type":"service_binding","name":"SYNTHESIZER_AGENT","service":"synthesizer-agent"}]}'
  SVC_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "${BASE}/accounts/${ACCT}/workers/scripts/review-api/settings" \
    -H "${AUTH}" -H "Content-Type: application/json" -d "${EXISTING}") || true
  if [ "${SVC_RESP:-0}" -ge 200 ] && [ "${SVC_RESP:-0}" -lt 300 ]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}WARN (HTTP ${SVC_RESP})${NC}"
  fi
fi

# Deploy multi-agent example: ai-pitch-evaluator (BAML agents)
PITCH="${EXAMPLES_DIR}/ai-pitch-evaluator"
if [ -d "${PITCH}/pitch-api" ]; then
  source "${EXAMPLES_DIR}/../.env" 2>/dev/null || true

  for agent in market-analyst financial-reviewer tech-assessor verdict-agent; do
    echo -n "  Building ai-pitch-evaluator/${agent}... "
    BUILD_OUT=$(cd "${PITCH}/${agent}" && npm install --silent 2>&1 && npm run generate 2>&1 && npm run build 2>&1) || true
    if [ -d "${PITCH}/${agent}/dist" ]; then
      echo -e "${GREEN}OK${NC}"
      echo -n "  Deploying ai-pitch-evaluator/${agent}... "
      OUTPUT=$(cd "${PITCH}/${agent}/dist" && bun run "${FF_CLI}" deploy --token "${TOKEN}" --api-url "${BASE}" --account-id "${ACCT}" 2>&1) || true
      if [[ "$OUTPUT" == *"successfully"* ]]; then
        echo -e "${GREEN}OK${NC}"
        DEPLOY_PASS=$((DEPLOY_PASS + 1))
      else
        echo -e "${RED}FAILED${NC}"
        DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
        last_line="${OUTPUT##*$'\n'}"
        DEPLOY_FAILURES="${DEPLOY_FAILURES}  ai-pitch-evaluator/${agent}: ${last_line}\n"
      fi
      if [ -n "${OPENAI_API_KEY:-}" ]; then
        curl -sf -X PUT \
          "${BASE}/accounts/${ACCT}/workers/scripts/${agent}/secrets" \
          -H "${AUTH}" -H "Content-Type: application/json" \
          -d "{\"name\":\"OPENAI_API_KEY\",\"text\":\"${OPENAI_API_KEY}\",\"type\":\"secret_text\"}" > /dev/null 2>&1 || true
      fi
    else
      echo -e "${RED}FAILED${NC} (build produced no dist/)"
      DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
      DEPLOY_FAILURES="${DEPLOY_FAILURES}  ai-pitch-evaluator/${agent}: build failed\n"
    fi
  done

  echo -n "  Deploying ai-pitch-evaluator/pitch-api... "
  OUTPUT=$(cd "${PITCH}/pitch-api" && bun run "${FF_CLI}" deploy --token "${TOKEN}" --api-url "${BASE}" --account-id "${ACCT}" 2>&1) || true
  if [[ "$OUTPUT" == *"successfully"* ]]; then
    echo -e "${GREEN}OK${NC}"
    DEPLOY_PASS=$((DEPLOY_PASS + 1))
  else
    echo -e "${RED}FAILED${NC}"
    DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
    last_line="${OUTPUT##*$'\n'}"
    DEPLOY_FAILURES="${DEPLOY_FAILURES}  ai-pitch-evaluator/pitch-api: ${last_line}\n"
  fi

  echo -n "  Adding service bindings (pitch-api → agents)... "
  EXISTING=$(curl -sf "${BASE}/accounts/${ACCT}/workers/scripts/pitch-api/settings" -H "${AUTH}" \
    | jq '{bindings: ([.result.bindings[]? | select(.name != "MARKET_ANALYST" and .name != "FINANCIAL_REVIEWER" and .name != "TECH_ASSESSOR" and .name != "VERDICT_AGENT")] + [{"type":"service_binding","name":"MARKET_ANALYST","service":"market-analyst"},{"type":"service_binding","name":"FINANCIAL_REVIEWER","service":"financial-reviewer"},{"type":"service_binding","name":"TECH_ASSESSOR","service":"tech-assessor"},{"type":"service_binding","name":"VERDICT_AGENT","service":"verdict-agent"}])}' 2>/dev/null) || EXISTING='{"bindings":[{"type":"service_binding","name":"MARKET_ANALYST","service":"market-analyst"},{"type":"service_binding","name":"FINANCIAL_REVIEWER","service":"financial-reviewer"},{"type":"service_binding","name":"TECH_ASSESSOR","service":"tech-assessor"},{"type":"service_binding","name":"VERDICT_AGENT","service":"verdict-agent"}]}'
  SVC_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "${BASE}/accounts/${ACCT}/workers/scripts/pitch-api/settings" \
    -H "${AUTH}" -H "Content-Type: application/json" -d "${EXISTING}") || true
  if [ "${SVC_RESP:-0}" -ge 200 ] && [ "${SVC_RESP:-0}" -lt 300 ]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}WARN (HTTP ${SVC_RESP})${NC}"
  fi
fi

echo ""
echo -e "${BOLD}Deploy results: ${GREEN}${DEPLOY_PASS} passed${NC}, ${RED}${DEPLOY_FAIL} failed${NC}"
if [ -n "${DEPLOY_FAILURES}" ]; then
  echo -e "${RED}Failures:${NC}"
  echo -e "${DEPLOY_FAILURES}"
fi
echo ""

# ============================================================
# Phase 2: Verify all examples via dispatch
# ============================================================
echo -e "${BOLD}=== Phase 2: Verifying all examples ===${NC}"
echo ""

PASS=0
FAIL=0
SKIP=0
FAILURES=""

dispatch() {
  local worker="$1"
  local path="${2:-}"
  local method="${3:-GET}"
  local data="${4:-}"

  local url="${BASE}/accounts/${ACCT}/workers/${worker}/dispatch${path}"

  if [ -n "$data" ]; then
    curl -s -X "${method}" "${url}" -H "${AUTH}" -H "Content-Type: application/json" -d "${data}" 2>/dev/null
  else
    curl -s -X "${method}" "${url}" -H "${AUTH}" 2>/dev/null
  fi
}

check() {
  local label="$1"
  local worker="$2"
  local path="$3"
  local expect="$4"
  local method="${5:-GET}"
  local data="${6:-}"

  echo -n "  ${label}... "
  local resp
  resp=$(dispatch "$worker" "$path" "$method" "$data")

  if [[ "$resp" == *"$expect"* ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC} (expected '${expect}')"
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}  ${label}: ${resp:0:120}\n"
  fi
}

skip() {
  local label="$1"
  local reason="$2"
  echo -e "  ${label}... ${YELLOW}SKIP${NC} (${reason})"
  SKIP=$((SKIP + 1))
}

# Like check() but retries up to N times with a delay (for cold-start workers)
check_with_retry() {
  local label="$1"
  local worker="$2"
  local path="$3"
  local expect="$4"
  local retries="${5:-5}"
  local delay="${6:-3}"

  echo -n "  ${label}... "
  local resp
  local attempt=1
  while [ "$attempt" -le "$retries" ]; do
    resp=$(dispatch "$worker" "$path" "GET" "")
    if [[ "$resp" == *"$expect"* ]]; then
      echo -e "${GREEN}PASS${NC}"
      PASS=$((PASS + 1))
      return
    fi
    if [ "$attempt" -lt "$retries" ]; then
      sleep "$delay"
    fi
    attempt=$((attempt + 1))
  done
  echo -e "${RED}FAIL${NC} (expected '${expect}' after ${retries} attempts)"
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}  ${label}: ${resp:0:120}\n"
}

# --- JavaScript workers ---
check "hello-world"              "hello-world"        ""           "Hello World"
check "json-api (root)"          "json-api"           ""           "available_routes"
check "json-api /api/user"       "json-api"           "/api/user"  "John Doe"
check "json-api /api/time"       "json-api"           "/api/time"  "timestamp"
check "env-example"              "env-example"        ""           "FlameFlare Demo"
check "router-worker"            "router-worker"      ""           "Router Worker"
check "router-worker /todos"     "router-worker"      "/todos"     "Deploy to FlameFlare"
check "router-worker /health"    "router-worker"      "/health"    "status"
check "scheduled-worker"         "scheduled-worker"   ""           "schedule"
check "multi-module"             "multi-module"       ""           "message"

# --- Queue worker (GET only; POST needs live queue binding) ---
check "queue-worker (GET)"       "queue-worker"       ""           "POST a JSON body"
check "queue-worker (POST)"      "queue-worker"       ""           "queued"       "POST" '{"task":"send_email","to":"test@example.com"}'

# --- Multi-runtime workers ---
check "node-hello-world"         "node-hello-world"   ""           "Hello from Node"
check "bun-hello-world"          "bun-hello-world"    ""           "Hello from Bun"
check "deno-hello-world"         "deno-hello-world"   ""           "Hello from Deno"
check "python-hello-world"       "python-hello-world" ""           "Hello from Python"
check "elixir-hello-world"       "elixir-hello-world" ""           "Hello from Elixir"

# --- Module workers ---
check "wasm-module"              "wasm-module"        ""           "result"

# --- Nested module workers ---
check "nested-modules (root)"    "nested-modules"     "/"          "nested-modules"
check "nested-modules /health"   "nested-modules"     "/health"    "status"
check "nested-modules /users"    "nested-modules"     "/users"     "Alice"

# --- Workflow workers ---
check "workflow-basic (GET)"     "workflow-basic"     ""           "workflow-basic"
check "workflow-basic (POST)"    "workflow-basic"     ""           "instanceId"   "POST" "{}"
check "workflow-events (GET)"    "workflow-events"    ""           "workflow-events"
check "workflow-events (POST)"   "workflow-events"    ""           "instanceId"   "POST" "{}"
check "workflow-comprehensive"   "workflow-comprehensive" ""       "workflow-comprehensive"
check "workflow-parallel (GET)"  "workflow-parallel"   ""           "workflow-parallel"
check "workflow-parallel (POST)" "workflow-parallel"   ""           "instanceId"   "POST" "{}"
check "workflow-parallel batch"  "workflow-parallel"   "/batch"     "instances"    "POST" "{}"

# --- Tool workers (GET returns usage page) ---
check "ffmpeg-worker"            "ffmpeg-worker"      ""           "FFmpeg Worker"
check "pdf-worker"               "pdf-worker"         ""           "PDF Worker"

# --- Order processing pipeline (multi-worker) ---
check "order-api (GET)"          "order-api"          ""           "order-api"
check "order-api (POST /order)"  "order-api"          "/order"     "paymentQueued"   "POST" '{"orderId":"smoke-test-order","items":[{"name":"Widget","price":9.99,"quantity":1}],"customer":{"name":"Smoke Test","email":"smoke@test.com"}}'
check "payment-processor"        "payment-processor"  ""           "payment-processor"
check "notification-sender"      "notification-sender" ""          "notification-sender"
check "cleanup-worker"           "cleanup-worker"     ""           "cleanup-worker"

# --- AI Code Review Council (multi-agent BAML, retry for cold-start) ---
check "review-api (GET)"         "review-api"          ""           "review-api"
check_with_retry "architect-agent (GET)"    "architect-agent"      ""  "architect-agent"  5  3
check_with_retry "security-agent (GET)"     "security-agent"       ""  "security-agent"   5  3
check_with_retry "synthesizer-agent (GET)"  "synthesizer-agent"    ""  "synthesizer-agent" 5  3

# POST test only if OPENAI_API_KEY is available (costs money)
source "${EXAMPLES_DIR}/../.env" 2>/dev/null || true
if [ -n "${OPENAI_API_KEY:-}" ]; then
  check "review-api (POST /review)" "review-api" "/review" "success" "POST" '{"code":"function add(a,b) { return a+b; }","language":"javascript"}'
else
  skip "review-api (POST /review)" "OPENAI_API_KEY not set"
fi

# --- AI Pitch Evaluator (multi-agent BAML, retry for cold-start) ---
check "pitch-api (GET)"             "pitch-api"            ""  "pitch-api"
check_with_retry "market-analyst (GET)"      "market-analyst"       ""  "market-analyst"       5  3
check_with_retry "financial-reviewer (GET)"  "financial-reviewer"   ""  "financial-reviewer"   5  3
check_with_retry "tech-assessor (GET)"       "tech-assessor"        ""  "tech-assessor"        5  3
check_with_retry "verdict-agent (GET)"       "verdict-agent"        ""  "verdict-agent"        5  3

source "${EXAMPLES_DIR}/../.env" 2>/dev/null || true
if [ -n "${OPENAI_API_KEY:-}" ]; then
  check "pitch-api (POST /evaluate)" "pitch-api" "/evaluate" "success" "POST" '{"pitch":"TinyStartup sells widgets online for $10 each. 100 customers. Bootstrapped."}'
else
  skip "pitch-api (POST /evaluate)" "OPENAI_API_KEY not set"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${BOLD}===============================${NC}"
TOTAL=$((PASS + FAIL))
echo -e "${BOLD}Results: ${GREEN}${PASS}/${TOTAL} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${SKIP} skipped${NC}"

if [ -n "${FAILURES}" ]; then
  echo ""
  echo -e "${RED}Failures:${NC}"
  echo -e "${FAILURES}"
fi

echo -e "${BOLD}===============================${NC}"

# Exit with failure if any test failed
[ "$FAIL" -eq 0 ] || exit 1
