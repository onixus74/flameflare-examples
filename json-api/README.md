# JSON API Worker

A REST API worker that demonstrates JSON responses, URL routing, and request handling.

## Available Endpoints

- `GET /api/user` - Returns user information
- `GET /api/time` - Returns current timestamp
- `GET /api/headers` - Returns request headers
- `POST /api/echo` - Echoes the request body back

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
# Get user info
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/json-api/dispatch/api/user" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Get current time
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/json-api/dispatch/api/time" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Echo a POST request
curl -X POST "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/json-api/dispatch/api/echo" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello API!"}'
```

This worker demonstrates:
- URL routing with pathname checking
- JSON request/response handling
- HTTP method handling
- Error responses with status codes
