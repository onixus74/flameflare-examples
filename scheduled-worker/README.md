# Scheduled Worker

Demonstrates Cloudflare Workers cron triggers for scheduled tasks.

## Cron Schedule

This worker is configured to run every 5 minutes (`*/5 * * * *`) as defined in `flameflare.toml`.

## Features

- **HTTP Handler**: Responds to regular HTTP requests
- **Scheduled Handler**: Executes on cron triggers
- **Logging**: Demonstrates console logging for scheduled tasks

## Deploy

See [Environment Setup](../README.md#environment-setup) to configure `FLAMEFLARE_URL`, `FLAMEFLARE_API_KEY`, and `FLAMEFLARE_ACCOUNT_ID`.

```bash
ff deploy
```

## Test

```bash
# Test HTTP functionality
curl "$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/scheduled-worker/dispatch" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"

# The scheduled function will run automatically every 5 minutes
# Check logs in the FlameFlare dashboard to see scheduled execution
```

## Cron Patterns

You can modify the cron pattern in `flameflare.toml`:

- `*/5 * * * *` - Every 5 minutes
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1-5` - 9 AM on weekdays
- `0 0 1 * *` - First day of every month

## Use Cases

- Data cleanup and maintenance
- Sending periodic reports
- Syncing with external APIs
- Cache warming
- Health checks and monitoring

This worker demonstrates:
- Dual HTTP and scheduled event handlers
- Cron trigger configuration
- Scheduled task logging and monitoring
