# Workflow Events - Payment Verification

Demonstrates Cloudflare Workers Workflows with the `waitForEvent` / `sendEvent` pattern for external event-driven execution.

## Features

- **External events**: Workflow pauses and waits for a webhook callback
- **Event-driven resume**: `sendEvent()` delivers data to a waiting step
- **Timeout handling**: `waitForEvent` can timeout after a configurable duration
- **Real-world pattern**: Mirrors payment processor webhook flows

## Workflow Steps

1. **Initialize Payment** - Creates payment record from input params
2. **Submit to Processor** - Sends to external payment API (with retries)
3. **Wait for Confirmation** - Pauses until `payment-confirmed` event is received (1 hour timeout)
4. **Finalize Payment** - Processes the confirmed payment
5. **Send Receipt** - Emails receipt to customer

## Workflow Configuration

```toml
[[workflows]]
name = "payment-verification"
binding = "PAYMENT_WORKFLOW"
class_name = "PaymentWorkflow"
```

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

First, create the workflow via FlameFlare API:

```bash
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workflows" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "payment-verification"}'
```

Then deploy the worker:

```bash
ff deploy
```

## Test

The test flow demonstrates the full event-driven lifecycle:

```bash
# 1. Start a payment workflow
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-events/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 149.99, "currency": "USD", "customerEmail": "buyer@example.com"}'
# -> Returns instanceId and webhook URL

# 2. Check status (should be "waiting" at the waitForEvent step)
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-events/dispatch?instanceId=<INSTANCE_ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# 3. Simulate a payment processor webhook callback
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-events/dispatch/webhook?instanceId=<INSTANCE_ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"confirmed": true, "transactionRef": "stripe_ch_abc123", "processedAt": "2024-01-15T10:30:00Z"}'

# 4. Check final status (should be "completed")
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-events/dispatch?instanceId=<INSTANCE_ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

## Event Flow

```
Client                    Worker                  Workflow Engine
  |                         |                         |
  |-- POST / ------------->|                         |
  |                         |-- create instance ----->|
  |                         |                         |-- step.do("init payment")
  |                         |                         |-- step.do("submit to processor")
  |                         |                         |-- step.waitForEvent("payment-confirmed")
  |                         |                         |   (workflow pauses here)
  |<-- { instanceId } -----|                         |
  |                         |                         |
  |-- POST /webhook ------>|                         |
  |                         |-- sendEvent ----------->|
  |                         |                         |-- (workflow resumes)
  |                         |                         |-- step.do("finalize payment")
  |                         |                         |-- step.do("send receipt")
  |<-- { event sent } -----|                         |
```

## Use Cases

- Payment processor webhook callbacks (Stripe, PayPal)
- Multi-party approval workflows
- Third-party API callbacks
- Human-in-the-loop approval processes
- Any flow requiring external confirmation

## Cloudflare API Compatibility

This example uses the same Workflow Events API as Cloudflare Workers:
- `step.waitForEvent(name, { type, timeout })` to pause for external events
- `instance.sendEvent({ type, payload })` to deliver events
- Event types must match between `waitForEvent` and `sendEvent`