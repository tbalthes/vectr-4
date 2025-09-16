// Simple test to verify webhook dedupe key generation
// This is a basic functional test without external dependencies

import crypto from 'crypto';

/**
 * Generate deterministic dedupe key for webhook idempotency
 */
function generateDedupeKey(
  provider: string,
  webhookType: string | undefined,
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown,
): string {
  // Create a deterministic key based on webhook content
  // Include timestamp from webhook payload if available for uniqueness
  let timestamp = '';
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    // Try to get timestamp from various common webhook fields
    timestamp = (obj.timestamp || obj.created_at || obj.sent_at || '') as string;
  }
  
  // Create deterministic string from key webhook properties
  const keyComponents = [
    provider,
    webhookType || 'unknown',
    webhookCode || 'unknown',
    itemId || 'unknown',
    timestamp,
  ].join('|');

  // Generate SHA256 hash for deterministic dedupe key
  return crypto.createHash('sha256').update(keyComponents).digest('hex');
}

// Test cases
function testDedupeKeyGeneration() {
  console.log('Testing webhook dedupe key generation...');

  // Test 1: Identical webhooks should generate same key
  const payload1 = {
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'DEFAULT_UPDATE',
    item_id: 'test-item-123',
    timestamp: '2023-01-01T00:00:00Z'
  };

  const key1a = generateDedupeKey('plaid', 'TRANSACTIONS', 'DEFAULT_UPDATE', 'test-item-123', payload1);
  const key1b = generateDedupeKey('plaid', 'TRANSACTIONS', 'DEFAULT_UPDATE', 'test-item-123', payload1);
  
  console.log('✅ Test 1 - Identical webhooks:', key1a === key1b ? 'PASS' : 'FAIL');

  // Test 2: Different webhooks should generate different keys
  const payload2 = {
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'INITIAL_UPDATE',
    item_id: 'test-item-123',
    timestamp: '2023-01-01T00:00:00Z'
  };

  const key2 = generateDedupeKey('plaid', 'TRANSACTIONS', 'INITIAL_UPDATE', 'test-item-123', payload2);
  
  console.log('✅ Test 2 - Different webhooks:', key1a !== key2 ? 'PASS' : 'FAIL');

  // Test 3: Different timestamps should generate different keys
  const payload3 = {
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'DEFAULT_UPDATE',
    item_id: 'test-item-123',
    timestamp: '2023-01-01T01:00:00Z'
  };

  const key3 = generateDedupeKey('plaid', 'TRANSACTIONS', 'DEFAULT_UPDATE', 'test-item-123', payload3);
  
  console.log('✅ Test 3 - Different timestamps:', key1a !== key3 ? 'PASS' : 'FAIL');

  // Test 4: Undefined values should work consistently
  const key4a = generateDedupeKey('plaid', undefined, undefined, undefined, {});
  const key4b = generateDedupeKey('plaid', undefined, undefined, undefined, {});
  
  console.log('✅ Test 4 - Undefined values:', key4a === key4b ? 'PASS' : 'FAIL');

  console.log('Sample dedupe keys:');
  console.log('Key 1:', key1a);
  console.log('Key 2:', key2);
  console.log('Key 3:', key3);
  console.log('Key 4:', key4a);
}

// Run tests if this file is executed directly
testDedupeKeyGeneration();

export { generateDedupeKey, testDedupeKeyGeneration };