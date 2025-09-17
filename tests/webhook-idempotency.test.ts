import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:3001/api/aggregator/webhook';

const basePayload = {
  webhook_type: 'TRANSACTIONS',
  item_id: 'test-item-123',
  env_ts: Date.now(),
  request_id: 'test-req-1',
};

async function sendWebhook(label: string, webhookCode: string, override?: any) {
  const body = { ...basePayload, webhook_code: webhookCode, ...override };
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-aggregator-provider': 'plaid',
      'x-request-id': body.request_id,
      // 'plaid-verification': 'mocked-jwt' // skip for local test
    },
    body: JSON.stringify(body),
  });
  const resp = await res.json();
  console.log(`[${label}]`, res.status, resp);
  return { status: res.status, body: resp };
}

(async () => {
  console.log('=== Testing Sync Trigger Reduction ===');

  // Test webhook codes that should NOT trigger sync (should be skipped)
  console.log('\n--- Testing webhook codes that should be SKIPPED ---');
  await sendWebhook('INITIAL_UPDATE (should skip)', 'INITIAL_UPDATE');
  await sendWebhook('HISTORICAL_UPDATE (should skip)', 'HISTORICAL_UPDATE');
  await sendWebhook('DEFAULT_UPDATE (should skip)', 'DEFAULT_UPDATE');
  await sendWebhook('TRANSACTIONS_REMOVED (should skip)', 'TRANSACTIONS_REMOVED', {
    removed_transactions: ['tx1', 'tx2'],
  });

  // Test webhook code that SHOULD trigger sync
  console.log('\n--- Testing webhook code that should TRIGGER sync ---');
  await sendWebhook('SYNC_UPDATES_AVAILABLE (should trigger)', 'SYNC_UPDATES_AVAILABLE');

  // Test idempotency with SYNC_UPDATES_AVAILABLE
  console.log('\n--- Testing idempotency ---');
  await sendWebhook('SYNC_UPDATES_AVAILABLE replay', 'SYNC_UPDATES_AVAILABLE');

  // Test concurrent SYNC_UPDATES_AVAILABLE
  console.log('\n--- Testing concurrent requests ---');
  await Promise.all([
    sendWebhook('SYNC concurrent-1', 'SYNC_UPDATES_AVAILABLE', {
      request_id: 'test-req-concurrent-1',
    }),
    sendWebhook('SYNC concurrent-2', 'SYNC_UPDATES_AVAILABLE', {
      request_id: 'test-req-concurrent-2',
    }),
  ]);

  // Test error handling
  console.log('\n--- Testing error handling ---');
  await sendWebhook('failure test', 'FORCE_ERROR', { request_id: 'test-req-error' });

  console.log('\n=== Test completed ===');
  console.log('Expected behavior:');
  console.log(
    '- INITIAL_UPDATE, HISTORICAL_UPDATE, DEFAULT_UPDATE, TRANSACTIONS_REMOVED should log "skipping sync trigger"',
  );
  console.log('- Only SYNC_UPDATES_AVAILABLE should trigger actual sync calls');
  console.log('- All webhooks should return 200 status for proper acknowledgment');
})().catch(console.error);
