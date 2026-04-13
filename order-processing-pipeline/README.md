# Order Processing Pipeline Example

This example demonstrates a complete e-commerce order processing pipeline using FlameFlare Workers, Queues, and Workflows. It shows how these components work together to create a robust, scalable order fulfillment system.

## Architecture Overview

```
                                   Order Processing Pipeline
                                        (FlameFlare)

┌─────────────────┐    POST /order    ┌─────────────────┐
│   Customer      │ ───────────────► │   order-api     │
│   (curl/web)    │                   │   (Worker)      │
└─────────────────┘                   └─────────────────┘
                                             │  │
                                             │  └─ Start Workflow
                                             │     (order-fulfillment)
                                             │
                                    Enqueue Payment
                                             │
                                             ▼
                              ┌─────────────────────────┐
                              │     payment-queue       │
                              │       (Queue)           │
                              └─────────────────────────┘
                                             │
                                    Consume Messages
                                             │
                                             ▼
                              ┌─────────────────────────┐     Enqueue Notification
                              │  payment-processor      │ ──────────────────────►
                              │     (Worker)            │
                              └─────────────────────────┘
                                                                        │
                                                                        ▼
                                                         ┌─────────────────────────┐
                                                         │   notification-queue    │
                                                         │       (Queue)           │
                                                         └─────────────────────────┘
                                                                        │
                                                               Consume Messages
                                                                        │
                                                                        ▼
                                                         ┌─────────────────────────┐
                                                         │  notification-sender    │
                                                         │      (Worker)           │
                                                         └─────────────────────────┘

Order Workflow Steps:
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ OrderFulfillmentWorkflow (running in order-api)                                          │
│                                                                                           │
│ 1. Validate Order ──► 2. Reserve Inventory ──► 3. Wait for Payment ──► 4. Create       │
│                                                      │                      Shipment     │
│                                                      │                         │         │
│                                               Payment Event              5. Send         │
│                                               (from payment-             Confirmation    │
│                                                processor)                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘

Cleanup System:
┌─────────────────┐    Cron: */5 * * * *    ┌─────────────────┐
│   Scheduler     │ ───────────────────────► │  cleanup-worker │
│   (Built-in)    │                          │    (Worker)     │
└─────────────────┘                          └─────────────────┘
                                                       ▲
                                              Service Binding
                                                       │
                                             ┌─────────────────┐
                                             │   order-api     │
                                             │   (Worker)      │
                                             └─────────────────┘
```

## Components

### Workers (4)
- **order-api** - Main API endpoint, starts workflows and queues
- **payment-processor** - Consumes payment queue, processes payments
- **notification-sender** - Consumes notification queue, sends notifications
- **cleanup-worker** - Periodic cleanup via cron and on-demand via service binding

### Queues (2)
- **payment-queue** - Holds payment processing tasks
- **notification-queue** - Holds notification tasks

### Workflows (1)
- **order-fulfillment** - Multi-step order processing with retries and event waiting

### Triggers (1)
- **cron** - Every 5 minutes cleanup trigger

## Data Flow

1. **Order Creation**: Customer posts order to order-api
2. **Workflow Start**: order-api starts OrderFulfillmentWorkflow
3. **Payment Queue**: order-api enqueues payment message
4. **Payment Processing**: payment-processor consumes payment, processes it
5. **Notification Queue**: payment-processor enqueues notification
6. **Notification Sending**: notification-sender consumes and sends notifications
7. **Workflow Completion**: Workflow waits for payment event, then ships and confirms
8. **Cleanup**: cleanup-worker runs periodically and on-demand

## Bindings

### order-api
- `PAYMENT_QUEUE` → payment-queue (producer)
- `ORDER_WORKFLOW` → order-fulfillment workflow
- `CLEANUP_SERVICE` → cleanup-worker (service binding)
- `ORDER_API_KEY` → environment variable

### payment-processor  
- `NOTIFICATION_QUEUE` → notification-queue (producer)
- Consumes from payment-queue

### notification-sender
- Consumes from notification-queue

### cleanup-worker
- No bindings (receives cron and service calls)

## Setup and Deployment

### Prerequisites
Set these environment variables:
```bash
export FLAMEFLARE_URL="http://localhost:4000/client/v4"
export FLAMEFLARE_API_KEY="your-api-token"
export FLAMEFLARE_ACCOUNT_ID="your-account-id"
```

### Deploy Everything
```bash
# Make scripts executable
chmod +x seed.sh test.sh

# Deploy all workers and create all resources
./seed.sh
```

### Manual Step-by-Step Deployment

Each worker can be deployed individually with `ff deploy`. Queues and the workflow
are auto-created by the server when the consumer/workflow workers deploy.

```bash
# 1. Deploy cleanup-worker first (order-api references it via service binding)
cd cleanup-worker && ff deploy && cd ..

# 2. Deploy payment-processor (auto-creates payment-queue)
cd payment-processor && ff deploy && cd ..

# 3. Deploy notification-sender (auto-creates notification-queue)
cd notification-sender && ff deploy && cd ..

# 4. Deploy order-api (auto-creates order-fulfillment workflow)
cd order-api && ff deploy && cd ..

# 5. Add service binding + cron trigger via seed.sh (or manually via API)
```

## Testing

### Run Full End-to-End Test
```bash
./test.sh
```

### Manual Testing

#### 1. Create an Order
```bash
curl -X POST "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/order-api/dispatch" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "items": [
      {"name": "Widget", "price": 29.99, "quantity": 2},
      {"name": "Gadget", "price": 15.99, "quantity": 1}
    ],
    "customer": {
      "name": "John Doe", 
      "email": "john@example.com",
      "phone": "+1-555-0123"
    }
  }'
```

#### 2. Check Order Status
```bash
# Get the instanceId from the order response, then:
curl "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/order-api/dispatch?orderId=order_123" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}"
```

#### 3. Trigger Manual Cleanup
```bash
curl -X POST "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workers/order-api/dispatch/cleanup" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 4. Check Queue Stats
```bash
# Payment queue
curl "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/queues/payment-queue" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}"

# Notification queue  
curl "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/queues/notification-queue" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}"
```

#### 5. Check Workflow Instances
```bash
curl "${FLAMEFLARE_URL}/accounts/${FLAMEFLARE_ACCOUNT_ID}/workflows/order-fulfillment/instances" \
  -H "Authorization: Bearer ${FLAMEFLARE_API_KEY}"
```

## Monitoring

### Dashboard
Visit the FlameFlare dashboard to monitor:
- Worker execution logs and metrics
- Queue depth and processing rates  
- Workflow instance status and step progress
- Cron trigger execution history

### Logs
Each worker logs its activities. Check the dashboard or API for:
- Order processing events
- Payment processing status
- Notification delivery confirmations
- Cleanup execution results

## Key Features Demonstrated

### Workers
- **HTTP request handling** (order-api)
- **Queue consumption** (payment-processor, notification-sender)
- **Service bindings** (order-api → cleanup-worker)
- **Cron scheduling** (cleanup-worker)

### Queues  
- **Producer/consumer patterns**
- **Message batching and acking**
- **Retry logic on failures**
- **Cross-worker communication**

### Workflows
- **Multi-step orchestration** with error handling
- **Event waiting** (payment confirmation)
- **Retry policies** (exponential/linear backoff)
- **Step isolation** and state management

### Integration Patterns
- **Async messaging** between workers via queues
- **Synchronous calls** via service bindings
- **Event-driven coordination** between workflows and workers
- **Scheduled maintenance** tasks

## Customization

### Modify Processing Logic
- Edit worker source files in `<worker>/src/index.js`
- Update queue configuration in `<worker>/flameflare.toml`
- Adjust workflow steps in `OrderFulfillmentWorkflow` class inside `order-api/src/index.js`

### Add New Workers
- Create a new directory alongside the existing workers
- Add its deployment step to `seed.sh`
- Configure bindings as needed

### Change Queue Behavior
- Modify `max_batch_size`, `max_retries` in flameflare.toml
- Add new queues and update bindings
- Implement custom retry logic in worker code

## Troubleshooting

### Common Issues
- **Queue messages not processed**: Check worker deployment and queue bindings
- **Workflow stuck**: Check event names and timeout configurations  
- **Service binding fails**: Verify cleanup-worker is deployed and binding exists
- **Cron not triggering**: Check trigger configuration in FlameFlare

### Debugging
- Check worker logs in dashboard
- Monitor queue depths and error rates
- Verify environment variables and bindings
- Test individual components before full pipeline