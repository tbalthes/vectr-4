import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/status_logging/logger';

// GET /api/accounts
// Returns accounts joined with latest balance and institution meta
export async function GET() {
  try {
    const cookieStore = await cookies();

    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    logger.debug(
      {
        event: 'accounts.cookies',
        metadata: {
          cookies: allCookies.map((c) => ({ name: c.name, hasValue: !!c.value })),
        },
      },
      'Collected cookies for request',
    );

    // Try to find Supabase auth token with various patterns
    let authToken = null;

    // Pattern 1: Exact match for known project
    authToken = cookieStore.get('sb-htcjadaqeuydztascaqc-auth-token');

    // Pattern 2: Any Supabase auth token
    if (!authToken) {
      authToken = allCookies.find(
        (cookie) => cookie.name.includes('auth-token') && cookie.name.startsWith('sb-'),
      );
    }

    // Pattern 3: Look for any supabase session token
    if (!authToken) {
      authToken = allCookies.find(
        (cookie) =>
          (cookie.name.includes('supabase') || cookie.name.startsWith('sb-')) &&
          (cookie.name.includes('token') || cookie.name.includes('session')),
      );
    }

    // Pattern 4: Try to parse the auth token from a session cookie
    if (!authToken) {
      const sessionCookie = allCookies.find(
        (cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'),
      );
      if (sessionCookie) {
        authToken = sessionCookie;
      }
    }

    if (!authToken) {
      logger.warn({ event: 'accounts.auth.missing_cookie' }, 'No auth token found in cookies');
      return NextResponse.json(
        {
          error: 'No auth token found',
          debug: {
            availableCookies: allCookies.map((c) => c.name),
            message: 'Please ensure you are logged in',
          },
        },
        { status: 401 },
      );
    }

    logger.debug(
      { 
        event: 'accounts.auth.cookie_used', 
        metadata: { cookieName: authToken.name } 
      },
      'Using auth token from cookie',
    );

    // Try to parse the token value if it's a JSON object
    const tokenValue = authToken.value;
    let accessToken = null;
    let refreshToken = null;

    try {
      const parsed = JSON.parse(tokenValue);
      logger.debug(
        { 
          event: 'accounts.auth.token_parsed', 
          metadata: { keys: Object.keys(parsed) } 
        },
        'Parsed token structure',
      );

      // Handle array format (Supabase often stores session as [access_token, refresh_token, ...])
      if (Array.isArray(parsed) && parsed.length >= 2) {
        accessToken = parsed[0];
        refreshToken = parsed[1];
        logger.debug(
          {
            event: 'accounts.auth.tokens_extracted',
            metadata: {
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
            },
          },
          'Extracted tokens from session array',
        );
      } else if (parsed.access_token) {
        accessToken = parsed.access_token;
        refreshToken = parsed.refresh_token;
        logger.debug({ event: 'accounts.auth.token_fields' }, 'Found access_token in parsed JSON');
      } else {
        logger.debug(
          { event: 'accounts.auth.using_raw_token' },
          'No access_token in parsed JSON; using raw cookie value',
        );
        accessToken = tokenValue;
      }
    } catch {
      // Token value is not JSON, use as-is
      logger.debug({ event: 'accounts.auth.token_not_json' }, 'Token not JSON; using raw value');
      accessToken = tokenValue;
    }

    // Create Supabase client with the auth token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false, // Disable auto refresh to avoid refresh token errors
        persistSession: false, // Don't persist session in this context
      },
    });

    // Try to get user info directly from the token instead of using getSession
    const { data: user, error: userError } = await supabase.auth.getUser();

    logger.debug(
      { 
        event: 'accounts.user_check', 
        metadata: { 
          hasUser: !!user?.user, 
          userError: userError?.message 
        } 
      },
      'User check result',
    );

    if (userError || !user?.user) {
      logger.warn(
        {
          event: 'accounts.user_validation_failed',
          metadata: {
            details: userError?.message || 'No user found',
          },
        },
        'User validation failed',
      );
      return NextResponse.json(
        {
          error: 'User validation failed',
          details: userError?.message || 'No user found',
        },
        { status: 401 },
      );
    }

    const userId = user.user.id;

    // Prefer explicit filter by user_id to reduce payload size (RLS still enforced)
    const { data, error } = await supabase
      .from('v_accounts_with_latest_balance')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map account_id to id for frontend compatibility
    const mappedAccounts = (data || []).map((account) => ({
      ...account,
      id: account.account_id, // Map account_id to id
    }));

    return NextResponse.json({ accounts: mappedAccounts });
  } catch (error) {
    console.error('Error in /api/accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
