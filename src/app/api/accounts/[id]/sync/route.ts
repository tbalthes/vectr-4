import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// POST /api/accounts/[id]/sync
// Syncs a specific account (mock implementation for demo)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies();

    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    console.log(
      'Sync: All available cookies:',
      allCookies.map((c) => ({ name: c.name, hasValue: !!c.value })),
    );

    // Try to find Supabase auth token
    let authToken = null;

    // Pattern 1: Exact match for known project
    authToken = cookieStore.get('sb-htcjadaqeuydztascaqc-auth-token');

    // Pattern 2: Any Supabase auth token
    if (!authToken) {
      authToken = allCookies.find(
        (cookie) => cookie.name.includes('auth-token') && cookie.name.startsWith('sb-'),
      );
    }

    if (!authToken) {
      console.log('Sync: No auth token found in cookies');
      return NextResponse.json(
        {
          error: 'No auth token found',
          success: false,
          canRetry: false,
        },
        { status: 401 },
      );
    }

    console.log('Sync: Using auth token from cookie:', authToken.name);

    // Try to parse the token value if it's a JSON object
    const tokenValue = authToken.value;
    let accessToken = null;
    let refreshToken = null;

    try {
      const parsed = JSON.parse(tokenValue);
      console.log('Sync: Parsed token structure:', Object.keys(parsed));

      // Handle array format (Supabase often stores session as [access_token, refresh_token, ...])
      if (Array.isArray(parsed) && parsed.length >= 2) {
        console.log('Sync: Token is an array, extracting access and refresh tokens');
        accessToken = parsed[0];
        refreshToken = parsed[1];
        console.log('Sync: Extracted tokens:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
        });
      } else if (parsed.access_token) {
        accessToken = parsed.access_token;
        refreshToken = parsed.refresh_token;
        console.log('Sync: Found access_token in parsed JSON');
      } else {
        console.log('Sync: No access_token found in parsed JSON, using full value');
        accessToken = tokenValue;
      }
    } catch {
      // Token value is not JSON, use as-is
      console.log('Sync: Token is not JSON, using as-is');
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

    console.log('Sync: User check result:', {
      hasUser: !!user?.user,
      userError: userError?.message,
    });

    if (userError || !user?.user) {
      console.log('Sync: User validation failed:', userError?.message || 'No user found');
      return NextResponse.json(
        {
          error: 'User validation failed',
          details: userError?.message || 'No user found',
          success: false,
          canRetry: false,
        },
        { status: 401 },
      );
    }

    const userId = user.user.id;
    const accountId = params.id;

    // Verify the account belongs to the user
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        {
          error: 'Account not found',
          success: false,
          canRetry: false,
        },
        { status: 404 },
      );
    }

    // Mock sync delay (1-3 seconds)
    const delay = 1000 + Math.random() * 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Mock sync results - High success rate for testing
    const success = Math.random() > 0.05; // 95% success rate

    if (success) {
      const newTransactions = Math.floor(Math.random() * 15);

      // Update last sync time
      await supabase
        .from('accounts')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', accountId);

      return NextResponse.json({
        success: true,
        accountName: account.name,
        newTransactions,
        message: `Successfully synced ${account.name}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Provide more realistic error messages for different account types
      const errorMessages = [
        'Temporary connection issue - please try again',
        'Bank maintenance in progress',
        'Account needs re-authentication',
        'Rate limit exceeded - please wait',
      ];

      const randomError = errorMessages[Math.floor(Math.random() * errorMessages.length)];

      return NextResponse.json(
        {
          success: false,
          error: randomError,
          accountName: account.name,
          canRetry: true,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Error in sync endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        canRetry: true,
      },
      { status: 500 },
    );
  }
}
