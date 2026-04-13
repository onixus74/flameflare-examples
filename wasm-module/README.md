# WASM Module Worker

A worker that imports a precompiled `.wasm` binary module, demonstrating WebAssembly support in multi-module deployments.

## File Structure

```
src/
  worker.mjs   - Entry point (fetch handler, WASM instantiation)
  add.wasm     - Precompiled WebAssembly binary (exports an add function)
```

`worker.mjs` imports the WASM binary and instantiates it at runtime:

```javascript
import wasm from './add.wasm';

const instance = await WebAssembly.instantiate(wasm);
const { add } = instance.exports;
```

All files in `src/` are uploaded together. The `ff deploy` script automatically detects `.wasm` files and sets the `application/wasm` content type.

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
# Default (a=1, b=2)
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/wasm-module/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# Custom values
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/wasm-module/dispatch?a=10&b=20" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

### Expected responses

Default (a=1, b=2):
```json
{
  "operation": "add",
  "inputs": { "a": 1, "b": 2 },
  "result": 3,
  "source": "WebAssembly"
}
```

Custom values (a=10, b=20):
```json
{
  "operation": "add",
  "inputs": { "a": 10, "b": 20 },
  "result": 30,
  "source": "WebAssembly"
}
```

## WASM Source

The `add.wasm` binary (41 bytes) was compiled from this WAT (WebAssembly Text Format):

```wat
(module
  (func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add)
  (export "add" (func $add)))
```

The precompiled binary is checked into the repository — no external toolchain is required to use this example.

## This worker demonstrates

- Importing a `.wasm` file as a module (`import wasm from './add.wasm'`)
- Instantiating WebAssembly via `WebAssembly.instantiate()`
- Calling exported WASM functions from the fetch handler
- Correct `application/wasm` content type handling in `ff deploy`
- Precompiled WASM binary checked into the repo (no toolchain required)