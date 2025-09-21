import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// POST /api/aggregator/plaid/sync-account
// Manually trigger transaction sync for a specific account
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: userError?.message || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { account_link_id, force_full_sync = false } = body;

  if (!account_link_id) {
    return NextResponse.json({ error: 'account_link_id required' }, { status: 400 });
  }

  try {
    // Get account link
    const { data: accountLink, error: linkError } = await supabase
      .from('account_links')
      .select('access_token_encrypted, cursor, status, item_id')
      .eq('id', account_link_id)
      .eq('user_id', userData.user.id)
      .single();

    if (linkError || !accountLink) {
      return NextResponse.json({ error: 'Account link not found' }, { status: 404 });
    }

    if (accountLink.status !== 'active') {
      return NextResponse.json({ error: 'Account link is not active' }, { status: 400 });
    }

    console.log(`🔄 Manual sync requested for account link ${account_link_id}`);

    // Call sync endpoint
    const syncResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/aggregator/plaid/transactions/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          access_token: accountLink.access_token_encrypted,
          cursor: force_full_sync ? undefined : accountLink.cursor,
          count: 500,
        }),
      },
    );

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      return NextResponse.json({ error: `Sync failed: ${errorText}` }, { status: 500 });
    }

    const result = await syncResponse.json();

    // Continue syncing if there's more data
    let totalAdded = result.added;
    let totalModified = result.modified;
    let totalRemoved = result.removed;
    let currentCursor = result.next_cursor;
    let syncCount = 1;

    while (result.has_more && currentCursor && syncCount < 10) {
      // Limit to prevent infinite loops
      console.log(`🔄 Continuing sync (batch ${syncCount + 1})...`);

      const nextSyncResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/aggregator/plaid/transactions/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            access_token: accountLink.access_token_encrypted,
            cursor: currentCursor,
            count: 500,
          }),
        },
      );

      if (nextSyncResponse.ok) {
        const nextResult = await nextSyncResponse.json();
        totalAdded += nextResult.added;
        totalModified += nextResult.modified;
        totalRemoved += nextResult.removed;
        currentCursor = nextResult.next_cursor;

        if (!nextResult.has_more) {
          break;
        }
      } else {
        console.warn(`⚠️ Batch ${syncCount + 1} failed, stopping sync`);
        break;
      }

      syncCount++;

      // Small delay to be respectful of rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`✅ Manual sync complete for account link ${account_link_id}:`, {
      totalAdded,
      totalModified,
      totalRemoved,
      batches: syncCount,
    });

    return NextResponse.json({
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
      batches_processed: syncCount,
      force_full_sync,
      accounts: result.accounts?.length || 0,
    });
  } catch (error) {
    console.error('❌ Manual sync error:', error);
    return NextResponse.json({ error: 'Failed to sync account' }, { status: 500 });
  }
}
