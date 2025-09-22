import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// DELETE /api/accounts/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id === 'undefined') {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }
    const supabase = createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = userData.user.id;
    const accountId = id;

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
