# Hello World Worker

The simplest possible Cloudflare Worker that returns "Hello World!" for any request.

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/hello-world/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

This worker demonstrates:
- Basic Worker export structure
- Simple Response creation
- Zero configuration deployment
