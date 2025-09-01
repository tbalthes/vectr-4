import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    // Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
      }
    );

    // Test connection first
    const { data: testData, error: testError } = await supabase
      .from("auth.users")
      .select("id")
      .limit(1);

    if (testError) {
      return NextResponse.json(
        {
          error: "Database connection failed",
          details: testError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      connectionWorking: true,
      userCount: testData?.length || 0,
      message:
        "Database connection successful. Chat tables likely need manual creation in Supabase dashboard.",
    });
  } catch (error) {
    console.error("Database test error:", error);
    return NextResponse.json(
      {
        error: "Database test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
