# Node.js Hello World Worker

A Hello World worker running on the Node.js runtime, demonstrating the standard Cloudflare Workers API pattern with Node.js v18+ support.

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

- Node.js v18 or higher
- FlameFlare environment configured

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
npm run deploy
```

## Test

```bash
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/node-hello-world/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

This worker demonstrates:
- Node.js runtime specification with `runtime = "node"`
- Standard Workers fetch handler API
- URL parsing and path extraction
- Response creation with headers