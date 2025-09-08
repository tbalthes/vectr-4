# Plaid Webhook Configuration

Add these environment variables to your `.env` file:

```bash
# Plaid Webhook Security (Optional for development, Required for production)
PLAID_WEBHOOK_SECRET=your_webhook_secret_from_plaid_dashboard
```

## How to get your webhook secret:

1. **Log into Plaid Dashboard**
2. **Go to Settings → Webhooks**
3. **Create or edit a webhook endpoint**
4. **Copy the webhook secret provided by Plaid**
5. **Add it to your `.env` file**

## Your webhook URL for Plaid Dashboard:

```
Production: https://your-domain.com/api/aggregator/webhook
Development: https://your-ngrok-url.ngrok.io/api/aggregator/webhook
```

## Testing webhooks in development:

Use ngrok to expose your local server:

```bash
ngrok http 3000
```

Then use the ngrok URL in your Plaid webhook configuration.

## Webhook Events Handled:

- **TRANSACTIONS.DEFAULT_UPDATE** - New transactions available
- **TRANSACTIONS.HISTORICAL_UPDATE** - Historical transactions available
- **TRANSACTIONS.TRANSACTIONS_REMOVED** - Transactions were removed
- **ITEM.ERROR** - Item needs user attention
- **ITEM.PENDING_EXPIRATION** - Access token expiring soon

All webhook events are logged to the `webhook_events` table for audit and debugging purposes.
