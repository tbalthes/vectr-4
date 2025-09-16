import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// DELETE /api/accounts/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;

    if (!resolvedParams.id || resolvedParams.id === 'undefined') {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    let authToken = cookieStore.get('sb-htcjadaqeuydztascaqc-auth-token');
    if (!authToken) {
      authToken = allCookies.find(
        (cookie) => cookie.name.includes('auth-token') && cookie.name.startsWith('sb-'),
      );
    }
    if (!authToken) {
      return NextResponse.json({ error: 'No auth token found' }, { status: 401 });
    }
    const tokenValue = authToken.value;
    let accessToken = null;
    try {
      const parsed = JSON.parse(tokenValue);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        accessToken = parsed[0];
      } else if (parsed.access_token) {
        accessToken = parsed.access_token;
      } else {
        accessToken = tokenValue;
      }
    } catch {
      accessToken = tokenValue;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.user.id;
    const accountId = resolvedParams.id;

    // First, delete all transactions for this account
    const { error: transactionDeleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('account_id', accountId)
      .eq('user_id', userId);

    if (transactionDeleteError) {
      console.error('Error deleting transactions:', transactionDeleteError);
      return NextResponse.json({ error: transactionDeleteError.message }, { status: 500 });
    }

    // Then delete the account for this user
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting account:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/accounts/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
