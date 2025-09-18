import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

import { withErrorHandling, ValidationError } from '@/lib/api/errors';
import { logger } from '@/lib/status_logging/logger';
import { createPerformanceContext } from '@/lib/perf';

/**
 * Balance On-Demand Endpoint
 * as outlined in WBS section 5.1.1
 * 
 * Fetches current balances for Plaid accounts with caching
 */

interface BalanceData {
  account_id: string;
  name: string;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string | null;
    unofficial_currency_code: string | null;
  };
  last_updated: string;
  cache_expires_at?: string;
}

// Simple in-memory cache for balances (replace with Redis in production)
const balanceCache = new Map<string, { data: BalanceData[]; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function handler(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'unknown';
  const perf = createPerformanceContext({ requestId, route: '/api/plaid/balances' });
  
  perf.start('balance_request');

  try {
    // 1. Validate method
    if (req.method !== 'GET') {
      throw new ValidationError('Method not allowed', { method: req.method });
    }

    // 2. Authenticate user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      logger.warn({ 
        event: 'balances.auth_failed', 
        requestId, 
        error: authError ? { 
          message: authError.message,
          code: (authError as any).code,
          stack: authError.stack
        } : undefined 
      }, 'Authentication failed for balance request');
      
      throw new ValidationError('Authentication required');
    }

    const userId = session.user.id;

    // 3. Parse query parameters
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const accountId = url.searchParams.get('account_id');

    logger.info({
      event: 'balances.request_received',
      requestId,
      userId,
      forceRefresh,
      accountId,
    }, 'Balance request received');

    // 4. Check cache unless force refresh is requested
    const cacheKey = `balances:${userId}${accountId ? `:${accountId}` : ''}`;
    
    if (!forceRefresh) {
      const cached = balanceCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        logger.info({
          event: 'balances.cache_hit',
          requestId,
          userId,
          accountId,
        }, 'Returning cached balances');

        perf.end('balance_request', { source: 'cache' });

        return NextResponse.json({
          ok: true,
          data: cached.data,
          cached: true,
          cache_expires_at: new Date(cached.expiresAt).toISOString(),
        }, {
          headers: {
            'X-Request-ID': requestId,
            'Cache-Control': 'private, max-age=300', // 5 minutes
          },
        });
      }
    }

    // 5. Get user's Plaid items
    perf.start('fetch_items');
    
    const itemsQuery = supabase
      .from('account_links')
      .select(`
        id,
        item_id,
        provider,
        status,
        plaid_credentials!inner(access_token)
      `)
      .eq('user_id', userId)
      .eq('provider', 'plaid')
      .eq('status', 'active');

    const { data: items, error: itemsError } = await itemsQuery;

    if (itemsError) {
      logger.error({
        event: 'balances.items_fetch_failed',
        requestId,
        userId,
        error: { 
          message: itemsError.message,
          code: (itemsError as any).code,
          stack: itemsError.stack
        },
      }, 'Failed to fetch user items');
      
      throw new Error('Failed to fetch account information');
    }

    perf.end('fetch_items', { itemCount: items?.length || 0 });

    if (!items || items.length === 0) {
      logger.info({
        event: 'balances.no_items',
        requestId,
        userId,
      }, 'No Plaid items found for user');

      return NextResponse.json({
        ok: true,
        data: [],
        cached: false,
        cache_expires_at: '',
      }, {
        headers: { 'X-Request-ID': requestId },
      });
    }

    // 6. Fetch balances from Plaid for each item
    perf.start('fetch_plaid_balances');
    const allBalances: BalanceData[] = [];

    try {
      const { Configuration, PlaidApi, PlaidEnvironments } = await import('plaid');
      
      const configuration = new Configuration({
        basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
          },
        },
      });

      const plaidClient = new PlaidApi(configuration);

      // Process items in parallel for better performance
      const balancePromises = items.map(async (item: any) => {
        try {
          const response = await plaidClient.accountsBalanceGet({
            access_token: item.plaid_credentials.access_token,
            options: accountId ? { account_ids: [accountId] } : undefined,
          });

          return response.data.accounts.map((account: any) => ({
            account_id: account.account_id,
            name: account.name,
            type: account.type,
            subtype: account.subtype,
            balances: {
              available: account.balances.available,
              current: account.balances.current,
              limit: account.balances.limit,
              iso_currency_code: account.balances.iso_currency_code,
              unofficial_currency_code: account.balances.unofficial_currency_code,
            },
            last_updated: new Date().toISOString(),
            cache_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }));
        } catch (plaidError: any) {
          logger.warn({
            event: 'balances.plaid_item_failed',
            requestId,
            userId,
            itemId: item.item_id,
            error: {
              message: plaidError.message,
              code: plaidError.error_code,
            },
          }, 'Failed to fetch balances for item');
          
          return []; // Return empty array for failed items
        }
      });

      const balanceResults = await Promise.all(balancePromises);
      allBalances.push(...balanceResults.flat());

      perf.end('fetch_plaid_balances', { 
        accountCount: allBalances.length,
        itemCount: items.length 
      });

    } catch (error: any) {
      perf.end('fetch_plaid_balances', { error: error.message });
      
      logger.error({
        event: 'balances.plaid_failed',
        requestId,
        userId,
        error: error.message,
      }, 'Failed to fetch balances from Plaid');

      throw new Error('Failed to fetch current balances. Please try again later.');
    }

    // 7. Cache the results
    balanceCache.set(cacheKey, {
      data: allBalances,
      expiresAt: Date.now() + CACHE_TTL,
    });

    // 8. Log success and return response
    const duration = perf.end('balance_request');
    
    logger.info({
      event: 'balances.completed',
      requestId,
      userId,
      accountCount: allBalances.length,
      duration,
    }, 'Balance request completed');

    return NextResponse.json({
      ok: true,
      data: allBalances,
      cached: false,
      cache_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
    }, {
      headers: {
        'X-Request-ID': requestId,
        'Cache-Control': 'private, max-age=300', // 5 minutes
      },
    });

  } catch (error) {
    perf.end('balance_request', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export const GET = withErrorHandling(handler);