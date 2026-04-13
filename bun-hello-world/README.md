# Bun Hello World Worker

A Hello World worker running on the Bun runtime, demonstrating the standard Cloudflare Workers API pattern with Bun's fast JavaScript runtime support.

## Worker API Convention

This example uses the standard Cloudflare Workers export pattern:
```javascript
export default {
  async fetch(request, env) {
    // Handle HTTP requests
    return new Response(...);
  }
}
```

## Requirements

- Bun v1.0 or higher
- FlameFlare environment configured

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
npm run deploy
```

## Test

```bash
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/bun-hello-world/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

This worker demonstrates:
- Bun runtime specification with `runtime = "bun"`
- Standard Workers fetch handler API
- URL parsing and path extraction
- Response creation with headers