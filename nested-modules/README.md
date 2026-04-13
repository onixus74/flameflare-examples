# Nested Modules Example

Demonstrates a Worker with nested subdirectory structure, verifying that FlameFlare correctly handles relative imports across directories.

## Structure

```
src/
├── worker.mjs              # Entry point
├── lib/
│   ├── router.mjs          # URL routing logic
│   └── response-helpers.mjs # Response builder utilities
└── routes/
    ├── index.mjs           # Barrel re-export
    ├── users.mjs           # /users route handler
    └── health.mjs          # /health route handler
```

## What it demonstrates

- Relative imports across directories (`import { Router } from './lib/router.mjs'`)
- Barrel re-exports (`export { handleUsers } from './users.mjs'` in `routes/index.mjs`)
- A realistic project structure for production Workers

## Deploy

```bash
cd examples/nested-modules
ff deploy
```

## Test

```bash
# Root endpoint
curl "$FLAMEFLARE_URL/client/v4/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/nested-modules/dispatch/"

# Health check
curl "$FLAMEFLARE_URL/client/v4/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/nested-modules/dispatch/health"

# Users
curl "$FLAMEFLARE_URL/client/v4/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/nested-modules/dispatch/users"
```