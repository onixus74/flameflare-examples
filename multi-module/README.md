# Multi-Module Worker

A worker composed of multiple ES modules, demonstrating how to split code across files and import JSON data.

## File Structure

```
src/
  worker.mjs   - Entry point (fetch handler)
  utils.mjs    - Helper functions (formatGreeting, getTimestamp)
  config.json  - Static configuration imported as a JSON module
```

`worker.mjs` imports from both companion modules:

```javascript
import { formatGreeting, getTimestamp } from './utils.mjs';
import config from './config.json';
```

All files in `src/` are uploaded together. The `main` field in `flameflare.toml` identifies the entry point; the remaining files are available for import at runtime.

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
# Default greeting
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/multi-module/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Greeting with custom name
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/multi-module/dispatch?name=Alice" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Health check (returns version from config.json)
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/multi-module/dispatch/health" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

### Expected responses

Default greeting:
```json
{
  "message": "Hello, World! Welcome to FlameFlare Multi-Module Demo.",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "config": {
    "appName": "FlameFlare Multi-Module Demo",
    "version": "1.0.0"
  }
}
```

Health check:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## This worker demonstrates

- ES module `import`/`export` between files
- JSON module imports (`import config from './config.json'`)
- Code splitting for maintainability
- Automatic discovery and upload of all source files via `ff deploy`
