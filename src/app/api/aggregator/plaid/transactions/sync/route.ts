import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// POST /api/aggregator/plaid/transactions/sync
// Implements Plaid's /transactions/sync endpoint with cursor-based pagination
// Following Plaid Academy tutorial best practices
export async function POST(req: Request) {
  // Use createClient for server-side operations to avoid cookies issues
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if this is an internal service call
  const authHeader = req.headers.get("authorization");
  const userIdHeader = req.headers.get("x-user-id");

  let userId: string;

  if (authHeader?.startsWith("Bearer ") && userIdHeader) {
    // Internal service call - validate service key and get user
    const serviceKey = authHeader.substring(7);
    if (serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      userId = userIdHeader;
      console.log(
        "🔧 Internal service call authenticated for user:",
        userIdHeader
      );
    } else {
      return NextResponse.json(
        { error: "Invalid service key" },
        { status: 401 }
      );
    }
  } else {
    // For webhook calls, we need to get the user from the request body
    // Don't call req.json() here yet, we'll parse it once below
    userId = ""; // Will be set from body below
  }

  // Validate required environment variables
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    console.error("Missing required Plaid configuration");
    return NextResponse.json(
      { error: "Plaid configuration missing" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // If userId is empty, get it from the body (webhook case)
  if (!userId) {
    if (!body.user_id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    userId = body.user_id;
  }
  const { access_token, cursor, count = 100 } = body;

  if (!access_token) {
    return NextResponse.json(
      { error: "access_token required" },
      { status: 400 }
    );
  }

  try {
    // Initialize Plaid client
    const configuration = new Configuration({
      basePath:
        PlaidEnvironments[
          process.env.PLAID_ENV as keyof typeof PlaidEnvironments
        ] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
        },
      },
    });

    const client = new PlaidApi(configuration);

    console.log("📥 Starting Plaid /transactions/sync", {
      cursor: cursor ? "provided" : "null",
      count,
    });

    // Fetch all sync data with pagination and error handling
    const allData = await fetchNewSyncData(client, access_token, cursor, 3);

    if (!allData) {
      return NextResponse.json(
        { error: "Failed to fetch transaction data after retries" },
        { status: 500 }
      );
    }

    console.log("📊 Plaid sync completed", {
      added_count: allData.added.length,
      modified_count: allData.modified.length,
      removed_count: allData.removed.length,
      final_cursor: allData.next_cursor ? "present" : "null",
    });

    // Store transactions in database
    let stored_added = 0;
    let stored_modified = 0;
    let stored_removed = 0;

    // Process added transactions
    if (allData.added.length > 0) {
      for (const transaction of allData.added) {
        try {
          // Get the internal account ID - simplified lookup
          console.log(
            `🔍 Looking up account for aggregator_account_id: ${transaction.account_id}`
          );

          const { data: accountData, error: accountError } = await supabase
            .from("accounts")
            .select("id")
            .eq("aggregator_account_id", transaction.account_id)
            .eq("user_id", userId)
            .single();

          let finalAccountId: string;

          if (accountError || !accountData) {
            console.warn(
              `⚠️ Account not found for aggregator_account_id: ${transaction.account_id}`,
              {
                accountError,
                transaction_id: transaction.transaction_id,
              }
            );

            // Try to find account by partial match or create a placeholder
            const { data: fallbackAccount } = await supabase
              .from("accounts")
              .select("id")
              .eq("user_id", userId)
              .limit(1)
              .single();

            if (!fallbackAccount) {
              console.error(`❌ No accounts found for user ${userId}`);
              continue;
            }

            console.log(`🔄 Using fallback account: ${fallbackAccount.id}`);
            finalAccountId = fallbackAccount.id;
          } else {
            console.log(
              `✅ Found matching account: ${accountData.id} for aggregator_account_id: ${transaction.account_id}`
            );
            finalAccountId = accountData.id;
          }

          // Check if transaction already exists (enhanced deduplication)
          // First check by aggregator_transaction_id
          const { data: existingByAggregatorId } = await supabase
            .from("transactions")
            .select("id")
            .eq("aggregator_transaction_id", transaction.transaction_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (existingByAggregatorId) {
            console.log(
              `⏭️ Transaction already exists (by aggregator_transaction_id): ${transaction.transaction_id}`
            );
            continue;
          }

          // Then check by the unique constraint fields to avoid database error
          const { data: existingByConstraint } = await supabase
            .from("transactions")
            .select("id")
            .eq("transaction_number", transaction.transaction_id)
            .eq("date", transaction.date)
            .eq("amount", -transaction.amount)
            .eq("user_id", userId)
            .maybeSingle();

          if (existingByConstraint) {
            console.log(
              `⏭️ Transaction already exists (by unique constraint): ${transaction.transaction_id}`
            );
            continue;
          }

          // Insert new transaction
          const { error: insertError } = await supabase
            .from("transactions")
            .insert({
              user_id: userId,
              account_id: finalAccountId,
              aggregator_transaction_id: transaction.transaction_id,
              amount: -transaction.amount, // Plaid uses negative for outflows
              date: transaction.date,
              original_description: transaction.name,
              clean_description: transaction.merchant_name || transaction.name,
              transaction_number: transaction.transaction_id,
              needs_review: false, // Plaid transactions are generally clean
              // Map Plaid categories to your system
              primary_category_id: await mapPlaidCategoryToSystem(
                supabase,
                transaction.personal_finance_category
              ),
              // Try to find merchant by name/regex
              merchant_id: await findOrCreateMerchant(
                supabase,
                transaction,
                userId
              ),
              user_metadata: {
                plaid_data: {
                  category: transaction.category,
                  category_id: transaction.category_id,
                  account_id: transaction.account_id,
                  authorized_date: transaction.authorized_date,
                  payment_channel: transaction.payment_channel,
                  pending: transaction.pending,
                  merchant_name: transaction.merchant_name,
                  logo_url: transaction.logo_url,
                  merchant_entity_id: transaction.merchant_entity_id,
                  personal_finance_category:
                    transaction.personal_finance_category,
                  personal_finance_category_icon_url:
                    transaction.personal_finance_category_icon_url,
                  pending_transaction_id: transaction.pending_transaction_id,
                },
              },
              created_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(
              `❌ Error inserting transaction ${transaction.transaction_id}:`,
              insertError
            );
          } else {
            stored_added++;
          }
        } catch (txError) {
          console.error(
            `❌ Error processing transaction ${transaction.transaction_id}:`,
            txError
          );
        }
      }
    }

    // Process modified transactions
    if (allData.modified.length > 0) {
      for (const transaction of allData.modified) {
        try {
          const { error: updateError } = await supabase
            .from("transactions")
            .update({
              amount: -transaction.amount,
              date: transaction.date,
              original_description: transaction.name,
              clean_description: transaction.merchant_name || transaction.name,
              user_metadata: {
                plaid_data: {
                  category: transaction.category,
                  category_id: transaction.category_id,
                  account_id: transaction.account_id,
                  authorized_date: transaction.authorized_date,
                  payment_channel: transaction.payment_channel,
                  pending: transaction.pending,
                  merchant_name: transaction.merchant_name,
                  logo_url: transaction.logo_url,
                  merchant_entity_id: transaction.merchant_entity_id,
                  personal_finance_category:
                    transaction.personal_finance_category,
                  personal_finance_category_icon_url:
                    transaction.personal_finance_category_icon_url,
                  pending_transaction_id: transaction.pending_transaction_id,
                },
              },
              updated_at: new Date().toISOString(),
            })
            .eq("aggregator_transaction_id", transaction.transaction_id)
            .eq("user_id", userId);

          if (updateError) {
            console.error(
              `❌ Error updating transaction ${transaction.transaction_id}:`,
              updateError
            );
          } else {
            stored_modified++;
          }
        } catch (txError) {
          console.error(
            `❌ Error processing modified transaction ${transaction.transaction_id}:`,
            txError
          );
        }
      }
    }

    // Process removed transactions
    if (allData.removed.length > 0) {
      for (const removedTx of allData.removed) {
        try {
          const { error: removeError } = await supabase
            .from("transactions")
            .update({
              is_deleted: true,
              deleted_at: new Date().toISOString(),
            })
            .eq("aggregator_transaction_id", removedTx.transaction_id)
            .eq("user_id", userId);

          if (removeError) {
            console.error(
              `❌ Error removing transaction ${removedTx.transaction_id}:`,
              removeError
            );
          } else {
            stored_removed++;
          }
        } catch (txError) {
          console.error(
            `❌ Error processing removed transaction ${removedTx.transaction_id}:`,
            txError
          );
        }
      }
    }

    // Update account links with last sync time and cursor
    if (access_token && allData.next_cursor) {
      await supabase
        .from("account_links")
        .update({
          last_sync_at: new Date().toISOString(),
          cursor: allData.next_cursor,
        })
        .eq("access_token_encrypted", access_token)
        .eq("user_id", userId);
    }

    console.log("✅ Transaction sync complete", {
      stored_added,
      stored_modified,
      stored_removed,
    });

    return NextResponse.json({
      added: stored_added,
      modified: stored_modified,
      removed: stored_removed,
      next_cursor: allData.next_cursor,
      has_more: false, // We've processed all available data
      accounts:
        allData.accounts?.map((acc) => ({
          account_id: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          balances: acc.balances,
        })) || [],
      transactions_update_status: "COMPLETE",
    });
  } catch (error) {
    console.error("❌ Plaid transactions/sync error:", error);

    // Check for specific Plaid errors
    if (error && typeof error === "object" && "response" in error) {
      const plaidError = error as {
        response?: { data?: { error_code?: string } };
      };
      if (
        plaidError.response?.data?.error_code ===
        "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
      ) {
        console.error(
          "⚠️ Sync mutation during pagination - should retry from beginning"
        );
        return NextResponse.json(
          {
            error: "Sync mutation detected - please retry",
            error_code: "SYNC_MUTATION",
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 }
    );
  }
}

/**
 * Fetch new sync data with pagination and error handling
 * Following Plaid Academy tutorial pattern
 */
async function fetchNewSyncData(
  client: PlaidApi,
  access_token: string,
  initialCursor: string | null = null,
  retriesLeft: number = 3
): Promise<{
  added: any[];
  modified: any[];
  removed: any[];
  next_cursor: string | null;
  accounts?: any[];
} | null> {
  try {
    let keepGoing = true;
    const allData = {
      added: [] as any[],
      modified: [] as any[],
      removed: [] as any[],
      next_cursor: initialCursor,
      accounts: undefined as any[] | undefined,
    };

    do {
      console.log(
        `📥 Fetching sync batch with cursor: ${
          allData.next_cursor ? "present" : "null"
        }`
      );

      const syncRequest: {
        access_token: string;
        count: number;
        cursor?: string;
        options?: {
          include_personal_finance_category?: boolean;
        };
      } = {
        access_token,
        count: 500, // Max transactions per request
        options: {
          include_personal_finance_category: true, // Use new improved categories
        },
      };

      if (allData.next_cursor) {
        syncRequest.cursor = allData.next_cursor;
      }

      const response = await client.transactionsSync(syncRequest);
      const { added, modified, removed, next_cursor, has_more, accounts } =
        response.data;

      // Concatenate new data
      allData.added = allData.added.concat(added);
      allData.modified = allData.modified.concat(modified);
      allData.removed = allData.removed.concat(removed);
      allData.next_cursor = next_cursor;

      // Store accounts from first response
      if (!allData.accounts && accounts) {
        allData.accounts = accounts;
      }

      keepGoing = has_more;

      console.log(
        `📊 Batch received: ${added.length} added, ${modified.length} modified, ${removed.length} removed, has_more: ${has_more}`
      );

      // Small delay to be respectful of rate limits
      if (keepGoing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (keepGoing);

    console.log(
      `✅ All sync data fetched: ${allData.added.length} total added, ${allData.modified.length} total modified, ${allData.removed.length} total removed`
    );

    return allData;
  } catch (error) {
    console.error("❌ Error in fetchNewSyncData:", error);

    // Check for sync mutation error
    if (error && typeof error === "object" && "response" in error) {
      const plaidError = error as {
        response?: { data?: { error_code?: string } };
      };
      if (
        plaidError.response?.data?.error_code ===
        "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
      ) {
        console.warn(
          "⚠️ Sync mutation during pagination, retrying from beginning..."
        );

        if (retriesLeft > 0) {
          // Wait a second and retry from the beginning
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return fetchNewSyncData(
            client,
            access_token,
            initialCursor,
            retriesLeft - 1
          );
        }
      }
    }

    // For other errors, retry if we have retries left
    if (retriesLeft > 0) {
      console.warn(`⚠️ Retrying sync (${retriesLeft} retries left)...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchNewSyncData(
        client,
        access_token,
        initialCursor,
        retriesLeft - 1
      );
    }

    console.error("❌ Failed to fetch sync data after all retries");
    return null;
  }
}

/**
 * Map Plaid personal finance category to system category
 */
async function mapPlaidCategoryToSystem(
  supabase: any,
  plaidCategory: any
): Promise<string | null> {
  // Add debug logging
  console.log("🏷️ Mapping Plaid category:", {
    primary: plaidCategory?.primary,
    detailed: plaidCategory?.detailed,
    confidence_level: plaidCategory?.confidence_level,
  });

  if (!plaidCategory?.primary || !plaidCategory?.detailed) {
    console.log("❌ Missing primary or detailed category");
    return null;
  }

  try {
    // Try to find EXACT match for detailed category first (this should work!)
    const { data: exactMatch, error: exactError } = await supabase
      .from("categories")
      .select("category_id, category")
      .eq("category", plaidCategory.detailed) // EXACT match, not ilike
      .is("user_id", null) // System categories only
      .maybeSingle();

    console.log("🔍 Exact detailed match query:", {
      query: plaidCategory.detailed,
      exactMatch,
      exactError,
    });

    if (exactMatch) {
      console.log("✅ Found exact detailed match:", exactMatch.category);
      return exactMatch.category_id;
    }

    // Try exact match for primary category
    const { data: primaryMatch, error: primaryError } = await supabase
      .from("categories")
      .select("category_id, category")
      .eq("category", plaidCategory.primary) // EXACT match, not ilike
      .is("user_id", null) // System categories only
      .maybeSingle();

    console.log("🔍 Primary match query:", {
      query: plaidCategory.primary,
      primaryMatch,
      primaryError,
    });

    if (primaryMatch) {
      console.log("✅ Found primary match:", primaryMatch.category);
      return primaryMatch.category_id;
    }

    // List available categories for debugging
    const { data: allCategories, error: listError } = await supabase
      .from("categories")
      .select("category")
      .is("user_id", null)
      .limit(10);

    console.log("🔍 Categories list query:", { allCategories, listError });
    console.log(
      "⚠️ No category match found. Available categories:",
      allCategories?.map((c: any) => c.category)
    );

    // Default to "UNCATEGORIZED" category (matching your table structure)
    const { data: uncategorizedCategory } = await supabase
      .from("categories")
      .select("category_id")
      .eq("category", "UNCATEGORIZED")
      .is("user_id", null)
      .maybeSingle();

    if (uncategorizedCategory) {
      console.log("🔄 Using fallback 'UNCATEGORIZED' category");
      return uncategorizedCategory.category_id;
    }

    console.log("❌ No 'UNCATEGORIZED' category found either!");
    return null;
  } catch (error) {
    console.warn("Error mapping Plaid category:", error);
    return null;
  }
}

/**
 * Find or create merchant based on transaction data
 */
async function findOrCreateMerchant(
  supabase: any,
  transaction: any,
  _userId: string // Mark as unused with underscore
): Promise<string | null> {
  // First try to find merchant by name
  const merchantName =
    transaction.merchant_name ||
    extractMerchantFromDescription(transaction.name);

  if (!merchantName) {
    return null;
  }

  // Look for existing merchant
  const { data: existingMerchant } = await supabase
    .from("merchants")
    .select("merchant_id")
    .ilike("name", merchantName)
    .single();

  if (existingMerchant) {
    return existingMerchant.merchant_id;
  }

  // Create new merchant if not found
  try {
    const { data: newMerchant, error } = await supabase
      .from("merchants")
      .insert({
        name: merchantName,
        default_category_id: await mapPlaidCategoryToSystem(
          supabase,
          transaction.personal_finance_category
        ),
        logo_url: transaction.logo_url || null, // Store Plaid merchant logo
        regex_match: `.*${merchantName.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}.*`,
        confidence_score: 0.8,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select("merchant_id")
      .single();

    if (error) {
      console.warn("Failed to create merchant:", error);
      return null;
    }

    return newMerchant?.merchant_id || null;
  } catch (createError) {
    console.warn("Error creating merchant:", createError);
    return null;
  }
}

/**
 * Extract merchant name from transaction description
 */
function extractMerchantFromDescription(description: string): string | null {
  if (!description) return null;

  // Clean up common prefixes/suffixes
  const cleaned = description
    .replace(/^(DEBIT|CREDIT|ACH|WIRE|CHECK|ATM)\s+/i, "")
    .replace(/\s+(PAYMENT|PURCHASE|WITHDRAWAL|DEPOSIT|FEE)$/i, "")
    .replace(/\s+\d{4}$/, "") // Remove trailing card numbers
    .replace(/\s+[A-Z]{2}$/, "") // Remove state codes
    .trim();

  // Take first meaningful part
  const parts = cleaned.split(/\s+/);
  const meaningfulParts = parts.filter(
    (part) =>
      part.length > 2 && !/^\d+$/.test(part) && !/^[A-Z]{1,3}$/.test(part)
  );

  return meaningfulParts.slice(0, 2).join(" ") || cleaned;
}
