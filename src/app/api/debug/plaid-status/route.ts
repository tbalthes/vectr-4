import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// GET /api/debug/plaid-status
// Debug endpoint to check Plaid account and transaction status
export async function GET() {
  const supabase = createRouteHandlerClient({
    cookies: cookies,
  });

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get account links
    const { data: accountLinks } = await supabase
      .from('account_links')
      .select(
        `
        id,
        provider,
        item_id,
        status,
        linked_at,
  last_synced_at,
        cursor,
        error_details
      `,
      )
      .eq('user_id', session.user.id)
      .eq('provider', 'plaid');

    // Get accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select(
        `
        id,
        name,
        type,
        subtype,
        mask,
        aggregator_account_id,
        last_synced_at
      `,
      )
      .eq('user_id', session.user.id)
      .eq('provider', 'plaid');

    // Get transactions count
    const { data: transactionCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    // Get recent transactions
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select(
        `
        id,
        date,
        amount,
        original_description,
        clean_description,
        aggregator_transaction_id,
        created_at
      `,
      )
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      user_id: session.user.id,
      account_links: accountLinks || [],
      accounts: accounts || [],
      transaction_count: transactionCount?.length || 0,
      recent_transactions: recentTransactions || [],
      debug_info: {
        has_plaid_accounts: (accounts?.length || 0) > 0,
        has_transactions: (transactionCount?.length || 0) > 0,
        last_sync: accountLinks?.[0]?.last_synced_at || 'never',
        cursor_stored: !!accountLinks?.[0]?.cursor,
      },
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Failed to get debug info' }, { status: 500 });
  }
}
