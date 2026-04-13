# Deno Hello World Worker

A Hello World worker running on the Deno runtime with TypeScript support, demonstrating the standard Cloudflare Workers API pattern with Deno v1.37+ support.

## Worker API Convention

This example uses the standard Cloudflare Workers export pattern with TypeScript:
```typescript
export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    // Handle HTTP requests
    return new Response(...);
  }
}
```

## Requirements

- Deno v1.37 or higher
- FlameFlare environment configured

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/deno-hello-world/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

This worker demonstrates:
- Deno runtime specification with `runtime = "deno"`
- TypeScript support out of the box
- Standard Workers fetch handler API with types
- URL parsing and path extraction
- Response creation with headers