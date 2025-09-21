import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// POST /api/accounts/[id]/sync
// Syncs a specific account (mock implementation for demo)
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

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
    // Extract [id] param from the URL
    const url = new URL(request.url);
    // /api/accounts/[id]/sync → get the [id] segment
    const segments = url.pathname.split('/').filter(Boolean);
    const accountId = segments[segments.length - 2];

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
