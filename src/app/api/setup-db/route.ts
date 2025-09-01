import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try to query existing tables
    const { data: existingTables, error: queryError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .in("table_name", ["chat_sessions", "chat_messages"]);

    if (queryError) {
      console.error("Error querying tables:", queryError);
    }

    // If we can query tables, check if our chat tables exist
    const foundTables =
      existingTables?.map((t: { table_name: string }) => t.table_name) || [];
    const hasSessionsTable = foundTables.includes("chat_sessions");
    const hasMessagesTable = foundTables.includes("chat_messages");

    return NextResponse.json({
      success: true,
      hasSessionsTable,
      hasMessagesTable,
      foundTables,
      queryError: queryError?.message,
      needsMigration: !hasSessionsTable || !hasMessagesTable,
    });
  } catch (error) {
    console.error("Database setup error:", error);
    return NextResponse.json(
      {
        error: "Database setup failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
