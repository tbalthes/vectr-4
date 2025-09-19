import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

import { withErrorHandling, ValidationError, RateLimitedError } from '@/lib/api/errors';
import { logger } from '@/lib/status_logging/logger';
import { addBreadcrumb } from '@/lib/api/sentry';
import { createPerformanceContext } from '@/lib/perf';

/**
 * Manual Refresh Endpoint - Fire-and-forget refresh trigger
 * as outlined in WBS section 4.1.1
 * 
 * This endpoint triggers a refresh of a Plaid item but does not wait for completion.
 * The actual sync will be handled by the webhook flow when Plaid finishes the job.
 */

interface RefreshRequest {
  item_id: string;
}

// In-memory rate limiting (replace with Redis in production)
const refreshLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 5; // 5 requests per 5 minutes per user

async function handler(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'unknown';
  const perf = createPerformanceContext({ requestId, route: '/api/plaid/refresh-item' });
  
  perf.start('refresh_item_request');

  try {
    // 1. Validate request method
    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed', { method: req.method });
    }

    // 2. Authenticate user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      logger.warn({ 
        event: 'refresh.auth_failed', 
        requestId, 
        error: authError ? { 
          message: authError.message,
          code: (authError as any).code,
          stack: authError.stack
        } : undefined 
      }, 'Authentication failed for refresh request');
      
      throw new ValidationError('Authentication required');
    }

    const userId = session.user.id;

    // 3. Rate limiting check
    const now = Date.now();
    const userKey = `refresh:${userId}`;
    const limit = refreshLimiter.get(userKey);

    if (limit && now < limit.resetTime) {
      if (limit.count >= RATE_LIMIT_MAX) {
        throw new RateLimitedError(
          `Too many refresh requests. Try again in ${Math.ceil((limit.resetTime - now) / 1000)} seconds`,
          { remaining: 0, resetTime: limit.resetTime }
        );
      }
      limit.count++;
    } else {
      refreshLimiter.set(userKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }

    // 4. Parse and validate request body
    const body = await req.json();
    const { item_id } = body as RefreshRequest;

    if (!item_id || typeof item_id !== 'string') {
      throw new ValidationError('item_id is required and must be a string');
    }

    logger.info({
      event: 'refresh.request_received',
      requestId,
      userId,
      itemId: item_id,
    }, 'Manual refresh request received');

    // 5. Verify user owns the item
    const { data: item, error: itemError } = await supabase
      .from('account_links')
      .select('id, item_id, provider, status, user_id')
      .eq('item_id', item_id)
      .eq('user_id', userId)
      .single();

    if (itemError || !item) {
      logger.warn({
        event: 'refresh.item_not_found',
        requestId,
        userId,
        itemId: item_id,
        error: itemError ? { 
          message: itemError.message,
          code: (itemError as any).code,
          stack: itemError.stack
        } : undefined,
      }, 'Item not found or unauthorized');
      
      throw new ValidationError('Item not found or unauthorized');
    }

    if (item.status === 'disconnected') {
      throw new ValidationError('Item is disconnected and requires re-authentication');
    }

    // 6. Add Sentry breadcrumb
    await addBreadcrumb(
      'Manual refresh triggered',
      'plaid.refresh',
      'info',
      { itemId: item_id, provider: item.provider }
    );

    // 7. Trigger refresh via Plaid API
    perf.start('plaid_refresh_api');
    
    try {
      // Use dynamic import to avoid bundling Plaid client in client components
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

      // Get access token for the item
      const { data: credentials, error: credError } = await supabase
        .from('plaid_credentials')
        .select('access_token')
        .eq('item_id', item_id)
        .single();

      if (credError || !credentials?.access_token) {
        throw new Error('Failed to retrieve Plaid credentials');
      }

      // Trigger refresh
      await plaidClient.transactionsRefresh({
        access_token: credentials.access_token,
      });

      perf.end('plaid_refresh_api');

      logger.info({
        event: 'refresh.plaid_triggered',
        requestId,
        userId,
        itemId: item_id,
        provider: item.provider,
      }, 'Plaid refresh successfully triggered');

    } catch (plaidError: any) {
      perf.end('plaid_refresh_api', { error: plaidError.message });
      
      logger.error({
        event: 'refresh.plaid_failed',
        requestId,
        userId,
        itemId: item_id,
        error: {
          message: plaidError.message,
          code: plaidError.error_code,
        },
      }, 'Failed to trigger Plaid refresh');

      // Don't expose Plaid API errors to client
      throw new Error('Failed to trigger refresh. Please try again later.');
    }

    // 8. Log success and return response
    const duration = perf.end('refresh_item_request');
    
    logger.info({
      event: 'refresh.completed',
      requestId,
      userId,
      itemId: item_id,
      duration,
    }, 'Manual refresh request completed');

    return NextResponse.json(
      {
        ok: true,
        message: 'Refresh triggered successfully',
        item_id,
        note: 'Data will be updated when Plaid completes the refresh (usually within a few minutes)',
      },
      {
        status: 202, // Accepted - indicates async processing
        headers: {
          'X-Request-ID': requestId,
        },
      }
    );

  } catch (error) {
    perf.end('refresh_item_request', { error: error instanceof Error ? error.message : String(error) });
    throw error; // Let withErrorHandling handle it
  }
}

export const POST = withErrorHandling(handler);