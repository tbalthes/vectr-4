// Remove the createClient import from the top-level
import { SupabaseClient } from "@supabase/supabase-js"; // Import the type
import { TransactionFromApi } from "@/types/transactions";

// The function now accepts any valid Supabase client
export async function getTransactionsWithDetails(
  supabase: SupabaseClient
): Promise<TransactionFromApi[]> {
  // First, let's check if we have an authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.error("Authentication error:", userError);
    throw new Error("User not authenticated");
  }
  
  console.log("Authenticated user ID:", user.id);

  const { data, error, status } = await supabase
    .from("transactions")
    .select(
      `
      id,
      transaction_number,
      date,
      clean_description,
      amount,
      original_description,
      balance,
      user_metadata,
      needs_review,
      user_id,
      merchants (
        name,
        logo_url,
        categories (
          name,
          icon
        )
      )
    `
    )
    .eq("user_id", user.id)  // Explicitly filter by user_id
    .order("date", { ascending: false });

  if (error) {
    console.error("Supabase Error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      status: status,
    });
    throw new Error("Could not fetch transaction data.");
  }

  console.log(`Fetched ${data?.length || 0} transactions for user ${user.id}`);
  return data as unknown as TransactionFromApi[];
}
