import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Integration test for webhook verification and routing flow
 * Tests complete flow from webhook receipt to processing
 * as outlined in WBS section 2.2.3
 */

// Mock environment variables
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  NODE_ENV: 'test',
  SKIP_PLAID_SIGNATURE: '1' // Skip signature verification for testing
};

describe('Webhook Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Mock Supabase client
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        from: vi.fn(() => ({
          insert: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: { id: 'test-event-id', status: 'received' }, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: { id: 'test-event-id', status: 'processing' }, error: null })) })) })) })),
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: { id: 'test-event-id', status: 'received' }, error: null })) })) }))
        }))
      }))
    }));

    // Mock logger
    vi.doMock('@/lib/status_logging/logger', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    }));
  });

  it('should handle SYNC_UPDATES_AVAILABLE webhook correctly', async () => {
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'SYNC_UPDATES_AVAILABLE',
      item_id: 'test-item-123',
      env_ts: Date.now(),
      request_id: 'test-req-sync-123'
    };

    // Create a mock request
    const mockHeaders = new Map([
      ['content-type', 'application/json'],
      ['x-aggregator-provider', 'plaid'],
      ['x-request-id', 'test-req-sync-123']
    ]);

    const mockRequest = {
      headers: {
        get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        entries: () => mockHeaders.entries()
      },
      text: () => Promise.resolve(JSON.stringify(webhookPayload))
    } as unknown as Request;

    // Dynamically import the webhook handler to get the mocked dependencies
    const { POST } = await import('@/app/api/aggregator/webhook/route');
    
    const response = await POST(mockRequest);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.ok).toBe(true);
    expect(responseData.provider).toBe('plaid');
    expect(responseData.eventType).toBe('TRANSACTIONS');
    expect(responseData.webhookCode).toBe('SYNC_UPDATES_AVAILABLE');
  });

  it('should skip non-triggering webhook codes', async () => {
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'HISTORICAL_UPDATE', // Should be skipped
      item_id: 'test-item-123',
      env_ts: Date.now(),
      request_id: 'test-req-hist-123'
    };

    const mockHeaders = new Map([
      ['content-type', 'application/json'],
      ['x-aggregator-provider', 'plaid'],
      ['x-request-id', 'test-req-hist-123']
    ]);

    const mockRequest = {
      headers: {
        get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        entries: () => mockHeaders.entries()
      },
      text: () => Promise.resolve(JSON.stringify(webhookPayload))
    } as unknown as Request;

    const { POST } = await import('@/app/api/aggregator/webhook/route');
    
    const response = await POST(mockRequest);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.ok).toBe(true);
    expect(responseData.webhookCode).toBe('HISTORICAL_UPDATE');
  });

  it('should handle duplicate webhook delivery via idempotency', async () => {
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'SYNC_UPDATES_AVAILABLE',
      item_id: 'test-item-123',
      env_ts: 1234567890, // Fixed timestamp for reproducible dedupe key
      request_id: 'test-req-dup-123'
    };

    const mockHeaders = new Map([
      ['content-type', 'application/json'],
      ['x-aggregator-provider', 'plaid'],
      ['x-request-id', 'test-req-dup-123']
    ]);

    const mockRequest = {
      headers: {
        get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        entries: () => mockHeaders.entries()
      },
      text: () => Promise.resolve(JSON.stringify(webhookPayload))
    } as unknown as Request;

    // Mock Supabase to simulate duplicate key error on second insert
    let insertCallCount = 0;
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        from: vi.fn(() => ({
          insert: vi.fn(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
              // First call succeeds
              return { 
                select: vi.fn(() => ({ 
                  maybeSingle: vi.fn(() => ({ 
                    data: { id: 'test-event-id', status: 'received' }, 
                    error: null 
                  })) 
                })) 
              };
            } else {
              // Second call fails with duplicate key
              return { 
                select: vi.fn(() => ({ 
                  maybeSingle: vi.fn(() => ({ 
                    data: null, 
                    error: { 
                      code: '23505', 
                      message: 'duplicate key value violates unique constraint'
                    } 
                  })) 
                })) 
              };
            }
          }),
          update: vi.fn(() => ({ 
            eq: vi.fn(() => ({ 
              select: vi.fn(() => ({ 
                maybeSingle: vi.fn(() => ({ 
                  data: { id: 'test-event-id', status: 'processing' }, 
                  error: null 
                })) 
              })) 
            })) 
          })),
          select: vi.fn(() => ({ 
            eq: vi.fn(() => ({ 
              single: vi.fn(() => ({ 
                data: { id: 'test-event-id', status: 'processed' }, 
                error: null 
              })) 
            })) 
          }))
        }))
      }))
    }));

    const { POST } = await import('@/app/api/aggregator/webhook/route');
    
    // First request should succeed
    const response1 = await POST(mockRequest);
    const responseData1 = await response1.json();
    expect(response1.status).toBe(200);
    expect(responseData1.ok).toBe(true);

    // Second request should also return 200 but indicate duplicate
    const response2 = await POST(mockRequest);
    const responseData2 = await response2.json();
    expect(response2.status).toBe(200);
    expect(responseData2.ok).toBe(true);
    expect(responseData2.message).toContain('Duplicate or already claimed');
  });

  it('should return 400 for invalid JSON payload', async () => {
    const invalidPayload = 'invalid json';

    const mockHeaders = new Map([
      ['content-type', 'application/json'],
      ['x-aggregator-provider', 'plaid'],
      ['x-request-id', 'test-req-invalid']
    ]);

    const mockRequest = {
      headers: {
        get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        entries: () => mockHeaders.entries()
      },
      text: () => Promise.resolve(invalidPayload)
    } as unknown as Request;

    const { POST } = await import('@/app/api/aggregator/webhook/route');
    
    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    
    const responseData = await response.json();
    expect(responseData.error).toBe('Invalid JSON');
  });

  it('should return 401 when signature verification fails', async () => {
    // Test with signature verification enabled
    process.env.SKIP_PLAID_SIGNATURE = '0';
    
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'SYNC_UPDATES_AVAILABLE',
      item_id: 'test-item-123',
      env_ts: Date.now(),
      request_id: 'test-req-auth-fail'
    };

    const mockHeaders = new Map([
      ['content-type', 'application/json'],
      ['x-aggregator-provider', 'plaid'],
      ['x-request-id', 'test-req-auth-fail']
      // Missing plaid-verification header
    ]);

    const mockRequest = {
      headers: {
        get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        entries: () => mockHeaders.entries()
      },
      text: () => Promise.resolve(JSON.stringify(webhookPayload))
    } as unknown as Request;

    const { POST } = await import('@/app/api/aggregator/webhook/route');
    
    const response = await POST(mockRequest);
    expect(response.status).toBe(401);
    
    const responseData = await response.json();
    expect(responseData.ok).toBe(false);
    expect(responseData.error).toBe('Webhook verification failed');
  });
});

describe('Error Handling Integration', () => {
  it('should handle errors with standardized format', async () => {
    // Test our error handling wrapper
    const { withErrorHandling, ValidationError } = await import('@/lib/api/errors');
    
    const testHandler = withErrorHandling(() => {
      throw new ValidationError('Test validation error');
    });

    const mockRequest = {
      nextUrl: { pathname: '/api/test' },
      headers: {
        get: (key: string) => key === 'x-request-id' ? 'test-req-123' : null
      }
    } as any;

    const response = await testHandler(mockRequest);
    expect(response.status).toBe(400);
    
    const responseData = await response.json();
    expect(responseData.ok).toBe(false);
    expect(responseData.error.code).toBe('validation_error');
    expect(responseData.error.message).toBe('Test validation error');
  });
});