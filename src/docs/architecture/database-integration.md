# Database Integration Guide

## Overview

This guide covers how the Vectr-4 frontend integrates with the Supabase PostgreSQL database, including authentication patterns, data fetching strategies, real-time features, and type safety implementations.

## Supabase Client Configuration

### Client Setup
The Supabase client is configured in `src/lib/supabaseClient.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})
```

### Environment Configuration
Required environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # Server-side only
```

## Authentication Integration

### Auth Context Provider
`src/contexts/AuthContext.tsx` manages authentication state:

```typescript
interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### Protected Routes
Middleware protects authenticated routes:

```typescript
// src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect /private routes
  if (req.nextUrl.pathname.startsWith('/private') && !session) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/private/:path*']
}
```

## Data Fetching Patterns

### Server Components (Recommended)
For initial page loads, use server components with direct database queries:

```typescript
// src/app/private/transactions/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export default async function TransactionsPage() {
  const supabase = createServerComponentClient({ cookies })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Fetch transactions with RLS automatically applied
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      id,
      date,
      amount,
      clean_description,
      merchant:merchants(name, logo_url),
      category:categories(name, icon)
    `)
    .order('date', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error('Failed to fetch transactions')
  }

  return <TransactionsList initialTransactions={transactions} />
}
```

### Client Components
For interactive features, use client-side hooks:

```typescript
// src/hooks/useTransactions.ts
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Transaction } from '@/types/database'

export function useTransactions(filters?: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTransactions() {
      try {
        setLoading(true)
        
        let query = supabase
          .from('transactions')
          .select(`
            *,
            merchant:merchants(*),
            category:categories(*),
            account:accounts(name, type)
          `)
          .order('date', { ascending: false })

        // Apply filters
        if (filters?.dateFrom) {
          query = query.gte('date', filters.dateFrom)
        }
        if (filters?.dateTo) {
          query = query.lte('date', filters.dateTo)
        }
        if (filters?.categoryIds?.length) {
          query = query.in('primary_category_id', filters.categoryIds)
        }

        const { data, error } = await query

        if (error) throw error
        setTransactions(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [filters])

  return { transactions, loading, error }
}
```

### API Routes (Next.js)
For complex operations or server-side processing:

```typescript
// src/app/api/transactions/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const supabase = createRouteHandlerClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .range(
        parseInt(searchParams.get('from') || '0'),
        parseInt(searchParams.get('to') || '49')
      )

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
```

## Real-time Features

### Live Updates
Subscribe to database changes for real-time UI updates:

```typescript
// src/hooks/useRealtimeTransactions.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export function useRealtimeTransactions(userId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    // Subscribe to INSERT events
    const subscription = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Transaction>) => {
          setTransactions(prev => [payload.new, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Transaction>) => {
          setTransactions(prev =>
            prev.map(t => t.id === payload.new.id ? payload.new : t)
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Transaction>) => {
          setTransactions(prev => prev.filter(t => t.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId])

  return transactions
}
```

### Presence Features
Track online users and collaborative features:

```typescript
// src/hooks/usePresence.ts
export function usePresence(roomId: string) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    const channel = supabase.channel(roomId)

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState()
        setOnlineUsers(Object.values(presenceState).flat())
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers(prev => [...prev, ...newPresences])
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineUsers(prev =>
          prev.filter(user => !leftPresences.some(left => left.id === user.id))
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: session?.user?.id,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [roomId])

  return onlineUsers
}
```

## Type Safety

### Database Types Generation
Generate TypeScript types from your database schema:

```bash
npx supabase gen types typescript --project-id your-project-id > src/types/database.ts
```

### Type Definitions
```typescript
// src/types/database.ts (auto-generated)
export type Database = {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string
          created_at: string
          user_id: string
          account_id: string
          date: string
          amount: number
          clean_description: string | null
          original_description: string
          merchant_id: string | null
          primary_category_id: string | null
          needs_review: boolean
          manual_edit: boolean
          // ... more fields
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          account_id: string
          date: string
          amount: number
          // ... required and optional fields for insert
        }
        Update: {
          id?: string
          date?: string
          amount?: number
          // ... all fields optional for update
        }
      }
      // ... other tables
    }
    Views: {
      // ... database views
    }
    Functions: {
      // ... database functions
    }
    Enums: {
      review_status: 'pending' | 'approved' | 'rejected' | 'needs_attention'
    }
  }
}
```

### Custom Types
Extend generated types with application-specific interfaces:

```typescript
// src/types/transactions.ts
import type { Database } from './database'

export type Transaction = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

// Enhanced types with relations
export interface TransactionWithRelations extends Transaction {
  merchant?: {
    id: string
    name: string
    logo_url: string | null
  }
  category?: {
    id: string
    name: string
    icon: string | null
  }
  account: {
    id: string
    name: string
    type: string
  }
}

// UI-specific formatted types
export interface FormattedTransaction {
  id: string
  date: string
  description: string
  amount: number
  merchantName: string | null
  categoryName: string | null
  categoryIcon: string | null
  needsReview: boolean
  manualEdit: boolean
}
```

## Performance Optimization

### Query Optimization
```typescript
// Efficient relationship loading
const { data } = await supabase
  .from('transactions')
  .select(`
    id,
    date,
    amount,
    clean_description,
    merchant:merchant_id(name, logo_url),
    category:primary_category_id(name, icon)
  `)
  .eq('user_id', userId)
  .range(0, 49)

// Use specific column selection instead of *
const { data } = await supabase
  .from('transactions')
  .select('id, date, amount, clean_description')
  .eq('user_id', userId)
```

### Caching Strategies
```typescript
// React Query integration
import { useQuery, useQueryClient } from '@tanstack/react-query'

export function useTransactionsQuery(filters?: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Optimistic updates
export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTransaction,
    onMutate: async (updatedTransaction) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['transactions'])

      // Snapshot previous value
      const previousTransactions = queryClient.getQueryData(['transactions'])

      // Optimistically update
      queryClient.setQueryData(['transactions'], (old: Transaction[]) =>
        old.map(t => t.id === updatedTransaction.id ? { ...t, ...updatedTransaction } : t)
      )

      return { previousTransactions }
    },
    onError: (err, updatedTransaction, context) => {
      // Rollback on error
      queryClient.setQueryData(['transactions'], context?.previousTransactions)
    },
    onSettled: () => {
      // Refetch after success or error
      queryClient.invalidateQueries(['transactions'])
    },
  })
}
```

## Error Handling

### Database Error Handling
```typescript
// Centralized error handling
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: string
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export async function handleDatabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: any }>
): Promise<T> {
  try {
    const { data, error } = await operation()

    if (error) {
      throw new DatabaseError(
        error.message || 'Database operation failed',
        error.code,
        error.details
      )
    }

    if (!data) {
      throw new DatabaseError('No data returned from database')
    }

    return data
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    throw new DatabaseError('Unexpected database error')
  }
}
```

### RLS Policy Errors
```typescript
// Handle RLS-related errors
export function handleRLSError(error: any): string {
  if (error.code === 'PGRST116') {
    return 'You do not have permission to access this data'
  }
  if (error.code === '42501') {
    return 'Insufficient privileges for this operation'
  }
  return error.message || 'Database operation failed'
}
```

## Security Best Practices

### Row Level Security
- All user data tables have RLS enabled
- Policies enforce user isolation automatically
- No need to manually filter by user_id in queries

### Service Role Usage
```typescript
// Use service role for admin operations only
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Only use in server-side API routes
export async function adminCreateUser(userData: any) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true
  })

  if (error) throw error
  return data
}
```

### Input Validation
```typescript
// Validate data before database operations
import { z } from 'zod'

const TransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().min(-999999.99).max(999999.99),
  description: z.string().min(1).max(255),
  account_id: z.string().uuid(),
})

export async function createTransaction(data: unknown) {
  const validatedData = TransactionSchema.parse(data)
  
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert(validatedData)
    .select()
    .single()

  if (error) throw error
  return transaction
}
```

## Testing Database Integration

### Mock Supabase Client
```typescript
// src/lib/__mocks__/supabaseClient.ts
export const supabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
}
```

### Integration Tests
```typescript
// Test with actual database (use test environment)
describe('Transaction CRUD', () => {
  beforeEach(async () => {
    // Setup test user and clean database
    await setupTestUser()
    await cleanTestData()
  })

  it('should create transaction with RLS', async () => {
    const transaction = await createTransaction({
      date: '2024-01-01',
      amount: -10.50,
      description: 'Coffee Shop',
      account_id: testAccountId,
    })

    expect(transaction.user_id).toBe(testUserId)
  })
})
```

## Related Documentation

- [Database Schema Details](../../python/docs/system/database-details.md) - Complete database structure
- [Authentication System](../core-features/authentication.md) - Auth implementation
- [System Architecture](./system-design.md) - Overall architecture overview
- [Transaction Processing API](../../python/docs/core-apis/transaction-processing.md) - Backend processing

---

*Updated: September 1, 2025*