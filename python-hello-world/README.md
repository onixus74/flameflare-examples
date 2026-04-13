# Python Hello World Worker

A Hello World worker running on the Python runtime, demonstrating the Python worker API convention with structured request/response handling.

## Worker API Convention

Python workers use a function-based API pattern:
```python
def on_fetch(request, env):
    """Handle incoming HTTP requests."""
    return {
        "status": 200,
        "headers": {"content-type": "text/plain"},
        "body": "Response body"
    }
```

The `request` parameter contains request data as a dictionary, and the function should return a dictionary with `status`, `headers`, and `body` fields.

## Requirements

- Python 3.8 or higher
- FlameFlare environment configured

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/python-hello-world/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

This worker demonstrates:
- Python runtime specification with `runtime = "python"`
- Function-based `on_fetch(request, env)` API
- Dictionary-based request/response handling
- Path extraction from request data
- Structured response format