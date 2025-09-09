import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/debug/force-sync
// Force sync transactions for all users (debug only)
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get all active Plaid account links
    const { data: accountLinks, error: linksError } = await supabase
      .from("account_links")
      .select("*")
      .eq("provider", "plaid")
      .eq("status", "active");

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    console.log(
      `Found ${accountLinks?.length || 0} active Plaid account links`
    );

    const results = [];

    for (const link of accountLinks || []) {
      try {
        console.log(
          `🔄 Forcing sync for account link ${link.id} (item: ${link.item_id})`
        );

        // Call the sync endpoint with service authentication
        const syncResponse = await fetch(
          `http://localhost:3000/api/aggregator/plaid/transactions/sync`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              "X-User-ID": link.user_id,
            },
            body: JSON.stringify({
              access_token: link.access_token_encrypted,
              cursor: link.cursor || undefined,
              count: 500,
            }),
          }
        );

        if (syncResponse.ok) {
          const result = await syncResponse.json();
          results.push({
            account_link_id: link.id,
            item_id: link.item_id,
            success: true,
            added: result.added,
            modified: result.modified,
            removed: result.removed,
            has_more: result.has_more,
          });
          console.log(`✅ Sync completed for ${link.id}:`, {
            added: result.added,
            modified: result.modified,
            removed: result.removed,
          });
        } else {
          const errorText = await syncResponse.text();
          results.push({
            account_link_id: link.id,
            item_id: link.item_id,
            success: false,
            error: errorText,
          });
          console.error(`❌ Sync failed for ${link.id}:`, errorText);
        }
      } catch (error) {
        results.push({
          account_link_id: link.id,
          item_id: link.item_id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(`❌ Sync error for ${link.id}:`, error);
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} account links`,
      results,
    });
  } catch (error) {
    console.error("Force sync error:", error);
    return NextResponse.json(
      { error: "Failed to force sync" },
      { status: 500 }
    );
  }
}
