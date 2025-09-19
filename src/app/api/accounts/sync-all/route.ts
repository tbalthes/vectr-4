import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// POST /api/accounts/sync-all
// Syncs all accounts for the current user (mock implementation for demo)
export async function POST() {
  try {
    const cookieStore = await cookies();

    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    console.log(
      'Bulk Sync: All available cookies:',
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
      console.log('Bulk Sync: No auth token found in cookies');
      return NextResponse.json(
        {
          successful: 0,
          failed: 0,
          failedAccounts: [],
          totalNewTransactions: 0,
          error: 'No auth token found',
        },
        { status: 401 },
      );
    }

    console.log('Bulk Sync: Using auth token from cookie:', authToken.name);

    // Try to parse the token value if it's a JSON object
    const tokenValue = authToken.value;
    let accessToken = null;
    let refreshToken = null;

    try {
      const parsed = JSON.parse(tokenValue);
      console.log('Bulk Sync: Parsed token structure:', Object.keys(parsed));

      // Handle array format (Supabase often stores session as [access_token, refresh_token, ...])
      if (Array.isArray(parsed) && parsed.length >= 2) {
        console.log('Bulk Sync: Token is an array, extracting access and refresh tokens');
        accessToken = parsed[0];
        refreshToken = parsed[1];
        console.log('Bulk Sync: Extracted tokens:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
        });
      } else if (parsed.access_token) {
        accessToken = parsed.access_token;
        refreshToken = parsed.refresh_token;
        console.log('Bulk Sync: Found access_token in parsed JSON');
      } else {
        console.log('Bulk Sync: No access_token found in parsed JSON, using full value');
        accessToken = tokenValue;
      }
    } catch {
      // Token value is not JSON, use as-is
      console.log('Bulk Sync: Token is not JSON, using as-is');
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

    console.log('Bulk Sync: User check result:', {
      hasUser: !!user?.user,
      userError: userError?.message,
    });

    if (userError || !user?.user) {
      console.log('Bulk Sync: User validation failed:', userError?.message || 'No user found');
      return NextResponse.json(
        {
          successful: 0,
          failed: 0,
          failedAccounts: [],
          totalNewTransactions: 0,
          error: 'User validation failed',
          details: userError?.message || 'No user found',
        },
        { status: 401 },
      );
    }

    const userId = user.user.id;

    // Get all user's accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('user_id', userId);

    if (accountsError) {
      return NextResponse.json(
        {
          successful: 0,
          failed: 0,
          failedAccounts: [],
          totalNewTransactions: 0,
          error: accountsError.message,
        },
        { status: 500 },
      );
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        successful: 0,
        failed: 0,
        failedAccounts: [],
        totalNewTransactions: 0,
      });
    }

    // Mock bulk sync results
    const results = {
      successful: 0,
      failed: 0,
      failedAccounts: [] as string[],
      totalNewTransactions: 0,
    };

    // Simulate processing each account
    for (const account of accounts) {
      // Mock sync delay
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

      // 80% success rate
      if (Math.random() > 0.2) {
        results.successful++;
        results.totalNewTransactions += Math.floor(Math.random() * 15);

        // Update last sync time
        await supabase
          .from('accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', account.id);
      } else {
        results.failed++;
        results.failedAccounts.push(account.name);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in bulk sync:', error);
    return NextResponse.json(
      {
        successful: 0,
        failed: 0,
        failedAccounts: [],
        totalNewTransactions: 0,
        error: 'Bulk sync failed',
      },
      { status: 500 },
    );
  }
}
