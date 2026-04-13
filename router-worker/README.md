# Router Worker

A comprehensive routing example that demonstrates URL routing, CORS handling, and different response types.

## Features

- **CORS Support**: Handles preflight OPTIONS requests
- **Multiple Routes**: GET/POST endpoints with different functionality
- **HTML Responses**: Serves an HTML page at the root
- **JSON API**: RESTful endpoints for todos
- **Health Check**: Simple health monitoring endpoint

## Routes

- `GET /` - HTML landing page
- `GET /todos` - List todos (JSON)
- `POST /todos` - Create todo (JSON)
- `GET /health` - Health check (JSON)
- `OPTIONS *` - CORS preflight

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
# View HTML page
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/router-worker/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Get todos
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/router-worker/dispatch/todos" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Create a todo
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/router-worker/dispatch/todos" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn FlameFlare"}'

# Health check
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/router-worker/dispatch/health" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

This worker demonstrates:
- URL routing with pathname and method matching
- CORS headers for cross-origin requests
- HTML and JSON response handling
- Function organization and separation of concerns
