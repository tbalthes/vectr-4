import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/force-sync
// Force sync transactions for all users (debug only)
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // Get all active Plaid account links
    const { data: accountLinks, error: linksError } = await supabase
      .from('account_links')
      .select('*')
      .eq('provider', 'plaid')
      .eq('status', 'active');

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    console.log(`Found ${accountLinks?.length || 0} active Plaid account links`);

    // Process only the first link to avoid looping calls to the sync endpoint.
    const link = accountLinks?.[0];
    if (!link) {
      return NextResponse.json({ message: 'No active Plaid account links' });
    }
    console.log(`🔄 Forcing sync for account link ${link.id} (item: ${link.item_id})`);
    // Call the sync endpoint with service authentication
    // Do not loop — the sync endpoint paginates internally.
    const syncResponse = await fetch(
      `http://localhost:3000/api/aggregator/plaid/transactions/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'X-User-ID': link.user_id,
        },
        body: JSON.stringify({
          access_token: link.access_token_encrypted,
          cursor: link.cursor || undefined,
          count: 500,
        }),
      },
    );
    if (syncResponse.ok) {
      const result = await syncResponse.json();
      return NextResponse.json({
        message: `Processed 1 account link`,
        result: {
          account_link_id: link.id,
          item_id: link.item_id,
          success: true,
          added: result.added,
          modified: result.modified,
          removed: result.removed,
          has_more: result.has_more,
        },
      });
    } else {
      const errorText = await syncResponse.text();
      return NextResponse.json(
        {
          message: `Processed 1 account link with error`,
          result: {
            account_link_id: link.id,
            item_id: link.item_id,
            success: false,
            error: errorText,
          },
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error('Force sync error:', error);
    return NextResponse.json({ error: 'Failed to force sync' }, { status: 500 });
  }
}
