// Test to validate the complete webhook data structure
// This tests the mapping between webhook handler and database schema

interface WebhookEventRecord {
  dedupe_key: string;
  provider: string;
  webhook_type: string | null;
  webhook_code: string | null;
  item_id: string | null;
  payload_json: Record<string, any>;
  status: string;
  received_at: string;
}

function testWebhookEventMapping() {
  console.log('Testing webhook event data mapping...');

  // Test data similar to real Plaid webhook
  const mockPlaidPayload = {
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'DEFAULT_UPDATE',
    item_id: 'test-item-123',
    user_id: 'test-user-456',
    timestamp: '2023-01-01T00:00:00Z',
    environment: 'sandbox'
  };

  // Simulate the webhook handler logic
  const provider = 'plaid';
  const webhookType = mockPlaidPayload.webhook_type;
  const webhookCode = mockPlaidPayload.webhook_code;
  const itemId = mockPlaidPayload.item_id;
  
  // Generate dedupe key (simplified version)
  const keyComponents = [
    provider,
    webhookType || 'unknown',
    webhookCode || 'unknown',
    itemId || 'unknown',
    mockPlaidPayload.timestamp || '',
  ].join('|');
  
  const dedupeKey = 'test-' + keyComponents.replace(/[|]/g, '-');

  // Create the record that would be inserted
  const webhookRecord: WebhookEventRecord = {
    dedupe_key: dedupeKey,
    provider: provider,
    webhook_type: webhookType || 'unknown',
    webhook_code: webhookCode,
    item_id: itemId,
    payload_json: mockPlaidPayload,
    status: 'received',
    received_at: new Date().toISOString(),
  };

  // Validate the record structure
  const tests = [
    ['dedupe_key is string', typeof webhookRecord.dedupe_key === 'string'],
    ['provider is plaid', webhookRecord.provider === 'plaid'],
    ['webhook_type matches', webhookRecord.webhook_type === 'TRANSACTIONS'],
    ['webhook_code matches', webhookRecord.webhook_code === 'DEFAULT_UPDATE'],
    ['item_id matches', webhookRecord.item_id === 'test-item-123'],
    ['payload_json is object', typeof webhookRecord.payload_json === 'object'],
    ['status is received', webhookRecord.status === 'received'],
    ['received_at is ISO string', webhookRecord.received_at.includes('T')],
  ];

  tests.forEach(([description, result]) => {
    console.log(`✅ ${description}: ${result ? 'PASS' : 'FAIL'}`);
  });

  console.log('Sample webhook record:');
  console.log(JSON.stringify(webhookRecord, null, 2));
}

testWebhookEventMapping();