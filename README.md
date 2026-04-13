# FlameFlare Worker Examples

This directory contains real-world Cloudflare Worker examples that demonstrate various patterns and features supported by FlameFlare.

## Available Examples

### JavaScript/TypeScript Examples

| Example | Description | Features |
|---------|-------------|----------|
| [`hello-world/`](./hello-world/) | Simplest possible worker | Basic Response, zero config |
| [`json-api/`](./json-api/) | REST API with routing | JSON responses, URL routing, HTTP methods |
| [`environment-variables/`](./environment-variables/) | Using env vars and secrets | Environment bindings, secret management |
| [`router-worker/`](./router-worker/) | URL routing with CORS | Advanced routing, CORS, HTML/JSON responses |
| [`scheduled-worker/`](./scheduled-worker/) | Cron trigger patterns | Scheduled events, dual handlers |
| [`multi-module/`](./multi-module/) | Multi-file worker with imports | ES module imports, JSON modules, code splitting |
| [`wasm-module/`](./wasm-module/) | WASM module import | WebAssembly import, binary modules, `WebAssembly.instantiate()` |
| [`queue-producer-consumer/`](./queue-producer-consumer/) | Message queue patterns | Queues, producers, consumers, batch processing |

### Workflow Examples

| Example | Description | Features |
|---------|-------------|----------|
| [`workflow-basic/`](./workflow-basic/) | Multi-step document signing | Durable steps, sleep, retry config, status tracking |
| [`workflow-events/`](./workflow-events/) | Event-driven payment verification | waitForEvent, sendEvent, webhook patterns |
| [`workflow-comprehensive/`](./workflow-comprehensive/) | User onboarding pipeline (all features) | Every Workflow API: parallel steps, sleepUntil, conditional branching, dynamic loops, try/catch, NonRetryableError, all instance management |

### Integration Examples

| Example | Description | Features |
|---------|-------------|----------|
| [`order-processing-pipeline/`](./order-processing-pipeline/) | Full e-commerce pipeline (Workers + Queues + Workflows) | All binding types, queue producer/consumer chains, workflow with event waiting, cron triggers, service bindings, multi-worker coordination |

### AI Multi-Agent Examples

| Example | Description | Features |
|---------|-------------|----------|
| [`ai-code-review-council/`](./ai-code-review-council/) | Multi-agent AI code review with BAML | 3 specialist BAML agents (architecture, security, synthesizer), service bindings, workflow tracking, queue verdict delivery, structured LLM extraction |
| [`ai-pitch-evaluator/`](./ai-pitch-evaluator/) | Multi-agent startup pitch evaluation with BAML | 4 specialist BAML agents (market, financial, technical, verdict), service bindings, workflow tracking, queue evaluation delivery, investment decision |

### Multi-Runtime Examples

| Example | Runtime | Description | Features |
|---------|---------|-------------|----------|
| [`node-hello-world/`](./node-hello-world/) | Node.js | Node.js runtime basics | Node.js APIs, CommonJS |
| [`deno-hello-world/`](./deno-hello-world/) | Deno | Deno runtime basics | ES modules, TypeScript |
| [`bun-hello-world/`](./bun-hello-world/) | Bun | Bun runtime basics | Fast startup, Web APIs |
| [`python-hello-world/`](./python-hello-world/) | Python | Python runtime basics | WSGI/ASGI, stdlib |
| [`elixir-hello-world/`](./elixir-hello-world/) | Elixir | Elixir runtime basics | OTP, Plug |

### Tool Integration Examples

| Example | Description | Features |
|---------|-------------|----------|
| [`ffmpeg-worker/`](./ffmpeg-worker/) | Video processing | CLI tool binding, media processing |
| [`pdf-worker/`](./pdf-worker/) | PDF generation | CLI tool binding, document creation |

## Prerequisites

1. **FlameFlare** running locally or deployed (e.g. on Fly.io)

2. **API Token**: Get your token from the setup output or re-run `cd apps/server && mix run priv/repo/seeds.exs`

3. **FlameFlare CLI**: Install the CLI to deploy workers:
   ```bash
   # One-time: configure GitHub Packages registry
   echo "@onixus74:registry=https://npm.pkg.github.com" >> ~/.npmrc
   echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT" >> ~/.npmrc

   # Install
   bun add -g @onixus74/flameflare-cli

   # Log in
   ff login
   ```

## Environment Setup

All examples use three environment variables. Set these once before deploying or testing:

```bash
# --- Pick one ---

# Local development
export FLAMEFLARE_URL="http://localhost:4000/client/v4"

# Production (Fly.io)
export FLAMEFLARE_URL="https://flameflare.fly.dev/client/v4"

# --- Required for both ---

export FLAMEFLARE_API_KEY="your-api-token"

# Fetch your account ID automatically
export FLAMEFLARE_ACCOUNT_ID=$(curl -s "$FLAMEFLARE_URL/accounts" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" | jq -r '.result[0].id')
```

Verify the setup:

```bash
curl -s "$FLAMEFLARE_URL/user/tokens/verify" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

## Quick Start

### Deploy any example:

```bash
cd examples/hello-world
ff deploy
```

The CLI reads `flameflare.toml`, discovers all source files, and uploads the worker. If the config includes `[triggers].crons`, schedules are synced automatically.

### Test with curl:

```bash
# Execute a deployed worker
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/hello-world/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

## Example Progression

We recommend exploring examples in this order:

1. **hello-world** - Basic worker structure
2. **json-api** - Request/response handling
3. **environment-variables** - Configuration management
4. **router-worker** - Advanced routing patterns
5. **scheduled-worker** - Cron triggers and scheduled tasks
6. **multi-module** - Multi-file ES module imports
7. **wasm-module** - WebAssembly binary module import
8. **queue-producer-consumer** - Asynchronous task processing
9. **workflow-basic** - Durable multi-step workflow execution
10. **workflow-events** - Event-driven workflows with external webhooks
11. **workflow-comprehensive** - Every Workflow feature in one example
12. **order-processing-pipeline** - Complete interconnected pipeline (Workers + Queues + Workflows + Cron + Service Bindings)

## Common Patterns

### Environment Setup

All examples include these standard files:
- `flameflare.toml` - Worker configuration (name, main module, runtime, bindings)
- `src/index.js` (or `src/index.py`, `src/index.exs`, etc.) - Worker entry point
- `package.json` - NPM configuration with `deploy` script
- `README.md` - Example-specific documentation

#### Runtime Configuration

Each worker can specify its runtime in `flameflare.toml`:

```toml
name = "my-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"
runtime = "javascript"  # javascript, node, deno, bun, python, elixir

[vars]
ENVIRONMENT = "production"
```

Supported runtimes:
- `javascript` (default) - Standard Web Workers API
- `node` - Node.js runtime with CommonJS support
- `deno` - Deno runtime with TypeScript and ES modules
- `bun` - Bun runtime for fast startup and Web APIs
- `python` - Python runtime with WSGI/ASGI support
- `elixir` - Elixir runtime with OTP and Plug

#### Resource Profile Configuration

Workers can declare a resource profile to control which FLAME pool they execute on. This ensures CPU-heavy workloads get performance CPUs and more memory, while lightweight workers stay on cheaper shared infrastructure.

```toml
name = "my-video-processor"
main = "src/index.js"
resource_profile = "dedicated"
```

Supported profiles:
- `standard` (default) - Request/response handlers, API calls, compute, I/O (max_concurrency: 10, 5 min idle)
- `dedicated` - Heavy compute, long-running workflows, near-isolation (max_concurrency: 2, 4 hr idle)

### Deployment Commands

Each example supports:
- `ff deploy` - Deploy to FlameFlare using the CLI

### Testing

Test deployed workers with:
```bash
# Basic test
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/{worker-name}/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# With custom path (using the /*path splat route)
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/{worker-name}/dispatch/api/users" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# With POST data
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/{worker-name}/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

## Differences from Cloudflare

These examples work on both Cloudflare and FlameFlare. FlameFlare adds multi-runtime support, resource profiles for standard/dedicated workloads, CLI tool bindings, and removes execution time limits. See the [FlameFlare for Cloudflare Workers Developers](../docs/guides/cloudflare-differences.md) guide for the full comparison.

## Dashboard Monitoring

After deploying examples, visit the FlameFlare dashboard to:

- View all deployed workers
- Monitor execution logs
- Check queue message processing
- View workflow execution steps
- Monitor system metrics

Local: `http://localhost:4000/dashboard`
Production: `https://flameflare.fly.dev/dashboard`

## Need Help?

- Check individual example READMEs for specific instructions
- View the [Getting Started guide](../docs/guides/getting-started.md)
- Verify your API token: `curl -H "Authorization: Bearer $FLAMEFLARE_API_KEY" "$FLAMEFLARE_URL/user/tokens/verify"`
