import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.NODE_ENV = 'test';
process.env.SKIP_PLAID_SIGNATURE = '1';
process.env.SKIP_WEBHOOK_VERIFICATION = 'true';

// Mock fetch globally for tests
global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  status: 200,
} as Response));

// Mock server-only to prevent import errors in tests
vi.mock('server-only', () => ({}));

// Mock next/server
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
      headers: new Map(),
    })),
    next: vi.fn(() => ({
      headers: new Map(),
    })),
  },
  NextRequest: vi.fn(),
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ 
        select: vi.fn(() => ({ 
          maybeSingle: vi.fn(() => ({ 
            data: { id: 'test-event-id', status: 'received' }, 
            error: null 
          })) 
        })) 
      })),
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
            data: { id: 'test-event-id', status: 'received' }, 
            error: null 
          })) 
        })) 
      }))
    }))
  }))
}));