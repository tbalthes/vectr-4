import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// GET /api/accounts
// Returns accounts joined with latest balance and institution meta
export async function GET() {
  try {
    // Use unified SSR client which reads/writes cookies correctly
    const supabase = createSupabaseServerClient();

    // Try to get user info directly from the token instead of using getSession
    const { data: user, error: userError } = await supabase.auth.getUser();

    console.log('User check result:', {
      hasUser: !!user?.user,
      userError: userError?.message,
    });

    if (userError || !user?.user) {
      console.log('User validation failed:', userError?.message || 'No user found');
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
