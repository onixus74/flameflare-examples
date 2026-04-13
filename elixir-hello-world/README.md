# Elixir Hello World Worker

A Hello World worker running on the Elixir runtime, demonstrating the module-based worker API convention with pattern matching and functional response handling.

## Worker API Convention

Elixir workers use a module with a `handle_fetch/2` function:
```elixir
defmodule Worker do
  def handle_fetch(request, env) do
    # Return {status, headers, body} tuple
    {200, %{"content-type" => "text/plain"}, "Response body"}
  end
end
```

The `request` parameter contains request data as a map, and the function should return a tuple with `{status, headers, body}`.

## Requirements

- Elixir 1.16 or higher
- Erlang/OTP 26 or higher
- FlameFlare environment configured

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/elixir-hello-world/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

This worker demonstrates:
- Elixir runtime specification with `runtime = "elixir"`
- Module-based `handle_fetch/2` API
- Map-based request data access
- Tuple-based response format `{status, headers, body}`
- Pattern matching and functional programming patterns