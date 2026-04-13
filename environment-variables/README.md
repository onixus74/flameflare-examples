# Environment Variables Worker

Demonstrates using environment variables and secrets in Cloudflare Workers.

## Environment Variables

This worker uses three environment variables defined in `flameflare.toml`:
- `APP_NAME` - Application name
- `ENVIRONMENT` - Current environment 
- `API_VERSION` - API version

## Secrets

You can also set secrets via the FlameFlare API:

```bash
curl -X PUT "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/scripts/env-example/secrets" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "SECRET_KEY", "text": "super-secret-value", "type": "secret_text"}'
```

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/env-example/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

This worker demonstrates:
- Environment variables from flameflare.toml
- Runtime access to env variables via the `env` parameter
- Checking for secret existence without exposing values
