import { type NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { withErrorHandling, ValidationError, InternalError } from '@/lib/api/errors';
import { createPlaidClientFromEnv } from '@/lib/plaid/client';
import { logger } from '@/lib/status_logging/logger';


const ExchangeTokenSchema = z.object({
  public_token: z.string().min(1, 'public_token is required'),
});

// POST /api/aggregator/plaid/exchange_public_token
// Body: { public_token: string }
async function handler(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'unknown';
  
  logger.info({
    event: 'exchange_token.request_start',
    requestId,
    route: '/api/aggregator/plaid/exchange_public_token'
  }, 'Exchanging public token');

  const supabase = createRouteHandlerClient({
    cookies: cookies,
  });
  
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    logger.warn({
      event: 'exchange_token.auth_failed',
      requestId,
      error: sessionError ? {
        message: sessionError.message,
        code: (sessionError as any).code
      } : undefined
    }, 'Authentication failed for token exchange');
    
    throw new ValidationError('Authentication required');
  }

  const body = await req.json().catch(() => ({}));
  const { public_token } = ExchangeTokenSchema.parse(body);

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    logger.error({
      event: 'exchange_token.config_missing',
      requestId,
      userId: session.user.id,
    }, 'Missing Plaid configuration');
    
    throw new InternalError('Plaid configuration missing');
  }

  try {
    const client = createPlaidClientFromEnv();
    const response = await client.exchangePublicToken(public_token);

    logger.info({
      event: 'exchange_token.success',
      requestId,
      userId: session.user.id,
      itemId: response.item_id
    }, 'Token exchange successful');

    // Store the access token and item info in database
    const { error: insertError } = await supabase
      .from('account_links')
      .insert({
        user_id: session.user.id,
        item_id: response.item_id,
        access_token_encrypted: response.access_token, // Should encrypt in production
        status: 'active',
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      logger.error({
        event: 'exchange_token.db_error',
        requestId,
        userId: session.user.id,
        itemId: response.item_id,
        error: {
          message: insertError.message,
          code: (insertError as any).code
        }
      }, 'Failed to store account link');
      
      throw new InternalError('Failed to store account information');
    }

    return NextResponse.json({
      item_id: response.item_id,
      access_token: response.access_token,
      request_id: response.request_id,
    });
  } catch (error: any) {
    logger.error({
      event: 'exchange_token.failed',
      requestId,
      userId: session.user.id,
      error: {
        message: error?.message || 'Unknown error',
        code: error?.code,
        stack: error?.stack
      }
    }, 'Failed to exchange public token');

    throw new InternalError('Failed to exchange public token');
  }
}

export const POST = withErrorHandling(handler);
