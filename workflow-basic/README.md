# Workflow Basic - Document Signing

Demonstrates Cloudflare Workers Workflows with multi-step durable execution, including `step.do()`, `step.sleep()`, and retry configuration.

## Features

- **Multi-step execution**: Upload → Prepare Envelope → Wait → Request Signatures → Finalize
- **Durable state**: Each step persists its output; workflow resumes from last successful step on failure
- **Retry configuration**: Envelope preparation retries 3× with exponential backoff
- **Sleep/delay**: Configurable pause between steps
- **Status tracking**: Query instance status at any time

## Workflow Steps

1. **Upload Document** - Validates input (title, signers) and creates document record
2. **Prepare Envelope** - Creates signing envelope with per-signer links (retries: 3, exponential backoff)
3. **Wait for Signing Window** - Sleeps 10 seconds (simulates processing time)
4. **Request Signatures** - Collects signatures from all parties (retries: 2, linear backoff)
5. **Finalize Document** - Seals the document and generates certificate + download URL

## Workflow Configuration

```toml
[[workflows]]
name = "document-signing"
binding = "SIGNING_WORKFLOW"
class_name = "DocumentSigningWorkflow"
```

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

The workflow entity is auto-created when the worker is deployed.

## Test

```bash
# Create a signing workflow with custom document
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-basic/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Partnership Agreement",
    "author": "Legal Team",
    "signers": [
      {"name": "Alice Smith", "email": "alice@example.com"},
      {"name": "Bob Johnson", "email": "bob@example.com"}
    ]
  }'

# Create with default document data
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-basic/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Check instance status (use the instanceId from the create response)
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/workflow-basic/dispatch?instanceId=<INSTANCE_ID>" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

## Workflow Lifecycle

1. **POST** triggers the worker, which creates a workflow instance
2. Each `step.do()` executes and persists its result
3. If a step fails, it retries according to its config
4. `step.sleep()` pauses the workflow durably (survives restarts)
5. **GET** with `instanceId` returns current status and step outputs

## Use Cases

- Contract and agreement signing
- Multi-party document approval
- Regulatory compliance workflows
- Any process requiring sequential sign-off with durability

## Cloudflare API Compatibility

This example uses the same Workflow API as Cloudflare Workers:
- `WorkflowEntrypoint` class with `run(event, step)` method
- `step.do(name, [config], callback)` for durable steps
- `step.sleep(name, duration)` for pausing
- `env.BINDING.create()` and `env.BINDING.get()` for instance management