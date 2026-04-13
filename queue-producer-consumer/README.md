# Queue Producer-Consumer Worker

Demonstrates Cloudflare Queues with both producer and consumer functionality in a single worker.

## Features

- **Producer**: HTTP endpoint that accepts tasks and queues them
- **Consumer**: Processes queued messages in batches
- **Error Handling**: Retry failed messages automatically
- **Batch Processing**: Configurable batch size and timeout

## Queue Configuration

- Queue name: `my-task-queue`
- Max batch size: 10 messages
- Batch timeout: 30 seconds
- Max retries: 3 attempts

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

First, create the queue via FlameFlare API:

```bash
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/queues" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-task-queue"}'
```

Then deploy the worker:

```bash
ff deploy
```

## Test

```bash
# Send a task to the queue (producer)
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/queue-worker/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task": "send_email", "to": "user@example.com", "subject": "Hello!"}'

# Send another task
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/queue-worker/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task": "process_payment", "amount": 99.99, "customer_id": 12345}'

# Check logs in FlameFlare dashboard to see consumer processing
```

## Message Flow

1. **Producer**: HTTP POST -> Queue message
2. **Queue**: Batches messages based on configuration
3. **Consumer**: Processes batch -> ACK/Retry individual messages

## Use Cases

- Asynchronous task processing
- Email sending queues
- Image processing pipelines
- Data synchronization
- Background job processing

This worker demonstrates:
- Queue producer patterns with HTTP triggers
- Queue consumer patterns with batch processing
- Error handling and retry logic
- Message acknowledgment and retry mechanisms
