import { createClient } from "@supabase/supabase-js";

import type { TransactionFromApi } from "@/types/transactions";

// This assumes you have your Supabase URL and Key in environment variables
// NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getTransactionsWithDetails(): Promise<
  TransactionFromApi[]
> {
  const { data, error } = await supabase
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
      accounts (
        id,
        name,
        mask,
        type
      ),
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
    .order("date", { ascending: false }); // Order by most recent

  if (error) {
    console.error("Error fetching transactions:", error);
    throw new Error("Could not fetch transaction data.");
  }

  // The 'data' is typed by Supabase; convert to unknown first and then to our type.
  const asUnknown = data as unknown;
  return asUnknown as TransactionFromApi[];
}
