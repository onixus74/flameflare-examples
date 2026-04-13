# Workflow Comprehensive - User Onboarding Pipeline

A single example that demonstrates **every** Cloudflare Workers Workflow capability in a realistic user-onboarding scenario.

## Feature Checklist

Every Workflows API feature is exercised here. The table maps each feature to the step that uses it.

| Cloudflare Workflow Feature | Step / Location | Notes |
|-----------------------------|-----------------|-------|
| `step.do(name, callback)` | Validate user data | Basic durable step |
| `step.do(name, config, callback)` | KYC check, fraud check, provisioning | With retry config + timeout |
| `retries.backoff: "exponential"` | KYC check | Exponential backoff |
| `retries.backoff: "linear"` | Fraud detection | Linear backoff |
| `retries.backoff: "constant"` | Provisioning, welcome notification | Constant backoff |
| `retries.limit` / `retries.delay` | Multiple steps | Configurable per step |
| `timeout` on step | KYC, fraud, provisioning | Per-step timeout |
| `step.sleep(name, duration)` | Cool-down period | Relative sleep ("5 seconds") |
| `step.sleepUntil(name, date)` | Wait for activation date | Sleep until computed Date |
| `step.waitForEvent(name, opts)` | Email verification | With timeout + try/catch |
| Multiple `waitForEvent` calls | Email + admin approval | Conditional second wait |
| `waitForEvent` timeout handling | Email verification | try/catch around waitForEvent |
| `Promise.all([step.do, ...])` | KYC + fraud in parallel | Concurrent steps |
| Conditional branching (`if/else`) | Free vs premium tier setup | Based on step output |
| Dynamic step loop (`for..of`) | Enable features | Steps from a list |
| `try/catch` around steps | Provisioning | Error recovery + cleanup |
| `NonRetryableError` | Provisioning (blocked domain) | Immediate failure |
| `return` from `run()` | Final output | Available in `status().output` |
| `create({id, params})` | Fetch handler POST / | Custom instance ID |
| `get(id)` + `status()` | Fetch handler GET | Instance lookup |
| `sendEvent({type, payload})` | /verify-email, /admin-approve | Event delivery |
| `terminate()` | /terminate | Stop execution |
| `pause()` / `resume()` | /pause, /resume | Suspend/continue |
| `restart()` | /restart | Re-run from scratch |

## Workflow Steps

```
1. Validate user data ............... step.do (basic)
2. Run KYC + fraud check ........... Promise.all([step.do, step.do])  (parallel)
3. Configure tier (free/premium) ... if/else branching
4. Wait for email verification ..... step.waitForEvent + try/catch
5. (premium) Wait for admin ........ step.waitForEvent (conditional)
6. Cool-down period ................ step.sleep("5 seconds")
7. Wait for activation date ........ step.sleepUntil(computedDate)
8. Provision account resources ..... step.do + try/catch + NonRetryableError
9. Enable features (loop) .......... for..of → step.do per feature
10. Send welcome notification ...... step.do (constant backoff)
```

## Workflow Configuration

```toml
[[workflows]]
name = "user-onboarding"
binding = "ONBOARDING_WORKFLOW"
class_name = "OnboardingWorkflow"
```

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

First, create the workflow via FlameFlare API:

```bash
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workflows" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "user-onboarding"}'
```

Then deploy the worker:

```bash
ff deploy
```

## Test

### Free-tier user (full happy path)

```bash
# 1. Create onboarding workflow for a free user
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_42", "email": "alice@example.com", "name": "Alice", "tier": "free"}'
# -> Returns instanceId and all management endpoints

# 2. Check status (should be waiting for email verification)
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# 3. Send email verification event
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch/verify-email?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"method": "link-click"}'

# 4. Check final status (after sleeps complete, should be "onboarded")
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

### Premium-tier user (requires admin approval)

```bash
# 1. Create onboarding for premium user
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_99", "email": "bob@corp.com", "name": "Bob", "tier": "premium"}'

# 2. Send email verification
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch/verify-email?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# 3. Send admin approval (premium only)
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch/admin-approve?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"approvedBy": "admin@corp.com"}'
```

### Instance management

```bash
# Pause a running instance
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch/pause?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Resume a paused instance
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch/resume?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Terminate a running instance
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch/terminate?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Restart a terminated/completed instance
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch/restart?instanceId=<ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

### Error case: blocked domain triggers NonRetryableError

```bash
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-comprehensive/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_bad", "email": "hacker@blocked.example", "name": "Bad Actor", "tier": "free"}'
```

## Onboarding Flow

```
Client                     Worker                   Workflow Engine
  |                          |                          |
  |-- POST / (free user) -->|                          |
  |                          |-- create(id, params) -->|
  |                          |                          |-- step.do("validate user")
  |                          |                          |-- Promise.all(KYC, fraud)   [parallel]
  |                          |                          |-- step.do("configure free tier")
  |                          |                          |-- step.waitForEvent("email-verified")
  |<-- { instanceId } ------|                          |   (pauses here)
  |                          |                          |
  |-- POST /verify-email -->|                          |
  |                          |-- sendEvent ----------->|   (resumes)
  |                          |                          |-- step.sleep("5 seconds")
  |                          |                          |-- step.sleepUntil(activationDate)
  |                          |                          |-- step.do("provision")
  |                          |                          |-- for feature: step.do("enable ...")
  |                          |                          |-- step.do("send welcome")
  |                          |                          |-- return { status: "onboarded" }
  |                          |                          |
  |-- GET ?instanceId ----->|                          |
  |                          |-- get(id).status() ---->|
  |<-- { output } ----------|                          |
```

For premium users, an additional `step.waitForEvent("admin-approved")` is inserted after email verification.

## Cloudflare API Compatibility

This example uses the complete Cloudflare Workers Workflow API surface:

- `WorkflowEntrypoint` class with `run(event, step)` method
- All `WorkflowStep` methods: `do`, `sleep`, `sleepUntil`, `waitForEvent`
- All `WorkflowStepConfig` options: `retries.limit`, `retries.delay`, `retries.backoff`, `timeout`
- All backoff strategies: `exponential`, `linear`, `constant`
- `NonRetryableError` for permanent failures
- All `Workflow` binding methods: `create`, `get`
- All `WorkflowInstance` methods: `status`, `sendEvent`, `terminate`, `pause`, `resume`, `restart`
- Control flow: `if/else` branching, `for..of` dynamic loops, `Promise.all` parallel steps, `try/catch` error handling
