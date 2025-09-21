import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// POST /api/accounts/sync-all
// Syncs all accounts for the current user (mock implementation for demo)
export async function POST() {
  try {
    const supabase = createSupabaseServerClient();

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
