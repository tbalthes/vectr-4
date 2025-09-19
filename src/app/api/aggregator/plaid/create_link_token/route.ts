import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/errors";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createLinkToken } from "@/lib/plaid/accounts";
import { logger } from "@/lib/status_logging/logger";

// POST /api/aggregator/plaid/create_link_token
// Returns a link_token from Plaid for frontend Link component
async function handler(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'unknown';
  
  logger.info({ 
    event: 'link_token.request_start',
    requestId,
    route: '/api/aggregator/plaid/create_link_token'
  }, 'Creating Plaid link token');

  const supabase = createRouteHandlerClient({
    cookies: cookies,
  });
  
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    logger.warn({ 
      event: 'link_token.auth_failed',
      requestId,
      error: sessionError ? {
        message: sessionError.message,
        code: (sessionError as any).code
      } : undefined
    }, 'Authentication failed for link token request');
    
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate required environment variables
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    logger.error({
      event: 'link_token.config_missing',
      requestId,
      userId: session.user.id,
    }, 'Missing required Plaid configuration');
    
    return NextResponse.json({
      error: "Plaid configuration missing. Please set PLAID_CLIENT_ID and PLAID_SECRET environment variables.",
    }, { status: 500 });
  }

  logger.info({
    event: 'link_token.config_verified',
    requestId,
    userId: session.user.id,
    environment: process.env.PLAID_ENV || "sandbox"
  }, 'Plaid configuration verified');

  // Log sandbox instructions for development
  if ((process.env.PLAID_ENV || 'sandbox') === 'sandbox') {
    logger.info({
      event: 'link_token.sandbox_instructions',
      requestId,
      metadata: {
        instructions: {
          phone: '415-555-0010 (new) or 415-555-0011 (returning)',
          otp: '123456',
          credentials: 'user_good / pass_good'
        }
      }
    }, 'Plaid sandbox test instructions');
  }

  try {
    // Use service layer to create link token
    const response = await createLinkToken(session.user.id, {
      webhook: process.env.PLAID_WEBHOOK_URL || 
        `${process.env.NEXT_PUBLIC_APP_URL}/api/aggregator/webhook`,
      daysRequested: 730, // 2 years
    });

    logger.info({
      event: 'link_token.created',
      requestId,
      userId: session.user.id,
      linkTokenCreated: !!response.link_token
    }, 'Link token created successfully');

    return NextResponse.json({
      link_token: response.link_token,
      expiration: response.expiration,
      request_id: response.request_id,
    });
  } catch (error: any) {
    logger.error({
      event: 'link_token.creation_failed',
      requestId,
      userId: session.user.id,
      error: {
        message: error?.message || 'Unknown error',
        code: error?.code,
        stack: error?.stack
      }
    }, 'Failed to create link token');

    return NextResponse.json({
      error: "Failed to create link token",
      details: error?.message,
    }, { status: 500 });
  }
}

export const POST = withErrorHandling(handler);