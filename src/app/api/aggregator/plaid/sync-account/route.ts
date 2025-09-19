import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/status_logging/logger';
import { runTransactionsSync } from '@/lib/plaid/sync';

// POST /api/aggregator/plaid/sync-account
// Manually trigger a transactions sync for a given item_id.
// This route calls the internal /transactions/sync ONCE and does not paginate here.
// For MVP we await the call; long-term we can enqueue a background job and return immediately.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}) as any);
    const itemId: string | undefined = body.item_id;

    if (!itemId) {
      return NextResponse.json({ ok: false, error: 'item_id is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Validate item exists and is active (optional but recommended)
    const { data: link, error: linkErr } = await supabase
      .from('account_links')
      .select('access_token_encrypted, user_id, cursor, status')
      .eq('item_id', itemId)
      .single();

    if (linkErr || !link) {
      logger.warn(
        { 
          event: 'manual_sync.link_missing', 
          itemId, 
          error: linkErr ? { message: linkErr.message, code: linkErr.code } : undefined 
        },
        'No account link found for item',
      );
      return NextResponse.json({ ok: false, error: 'Account link not found' }, { status: 404 });
    }
    if (link.status !== 'active') {
      logger.warn(
        { 
          event: 'manual_sync.link_inactive', 
          itemId, 
          metadata: { status: link.status } 
        },
        'Account link inactive',
      );
      return NextResponse.json({ ok: false, error: 'Account link is not active' }, { status: 409 });
    }

    logger.info({ event: 'manual_sync.requested', itemId }, 'Manual sync requested');

    // Preferred: call orchestrator directly (single call; no loops here)
    const summary = await runTransactionsSync({
      client: supabase,
      access_token: link.access_token_encrypted,
      user_id: link.user_id,
      item_id: itemId,
      start_cursor: link.cursor || null,
      pageSize: 100,
    });

    logger.info({ 
      event: 'manual_sync.sync_completed', 
      itemId, 
      metadata: { summary } 
    }, 'Manual sync completed');

    // Return 202 Accepted with summary for transparency
    return NextResponse.json({ accepted: true, ...summary }, { status: 202 });

    // If you truly want fire-and-forget (return immediately), comment out the await block above
    // and use this instead (be aware: on serverless, background work may be killed after response):
    //
    // setImmediate(async () => {
    //   try {
    //     const res2 = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/aggregator/plaid/transactions/sync`, {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify(syncBody),
    //     });
    //     const txt = await res2.text();
    //     logger.info({ event: 'manual_sync.bg_result', itemId, status: res2.status, body: txt.slice(0, 2000) }, 'Background sync finished');
    //   } catch (e) {
    //     logger.error({ event: 'manual_sync.bg_error', itemId, error: (e as Error).message }, 'Background sync errored');
    //   }
    // });
    // return NextResponse.json({ ok: true, itemId, accepted: true }, { status: 202 });
  } catch (err) {
    logger.error(
      { 
        event: 'manual_sync.unhandled', 
        error: { 
          message: (err as Error).message,
          stack: (err as Error).stack
        } 
      },
      'Unhandled error in manual sync',
    );
    return NextResponse.json({ ok: false, error: 'Unhandled error' }, { status: 500 });
  }
}
