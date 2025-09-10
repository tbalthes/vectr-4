import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  CleanPlaidTransactionProcessor,
  type PlaidTransaction,
} from "../clean-processor";

export const dynamic = "force-dynamic";

/**
 * Clean Plaid Transaction Processing Route
 * Processes Plaid transactions with 1:1 mapping to database schema
 *
 * This route doesn't interfere with CSV processing which uses
 * the existing python/core/transaction_processor.py logic
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Starting clean Plaid transaction processing");

    // Authenticate user
    const requestCookies = await cookies();
    const supabase = createRouteHandlerClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cookies: () => requestCookies as any,
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("❌ Authentication error:", userError);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { transactions } = body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "Invalid or empty transactions array" },
        { status: 400 }
      );
    }

    console.log(
      `📊 Processing ${transactions.length} Plaid transactions for user ${user.id}`
    );

    // Initialize clean processor
    const processor = new CleanPlaidTransactionProcessor();
    const results = {
      processed: 0,
      errors: 0,
      new_merchants: 0,
      matched_merchants: 0,
      categories_mapped: 0,
    };

    // Process each transaction
    for (const plaidTransaction of transactions as PlaidTransaction[]) {
      try {
        console.log(
          `🔄 Processing transaction: ${plaidTransaction.transaction_id}`
        );

        // Process with clean 1:1 mapping
        const processedTransaction = await processor.processTransaction(
          plaidTransaction
        );

        // Save to database
        const saved = await processor.saveTransaction(
          processedTransaction,
          user.id
        );

        if (saved) {
          results.processed++;

          // Track metrics
          if (processedTransaction.merchant_id) {
            results.matched_merchants++;
          }
          if (processedTransaction.category_id) {
            results.categories_mapped++;
          }

          console.log(
            `✅ Successfully processed: ${plaidTransaction.transaction_id}`
          );
        } else {
          results.errors++;
          console.error(
            `❌ Failed to save: ${plaidTransaction.transaction_id}`
          );
        }
      } catch (error) {
        results.errors++;
        console.error(
          `❌ Error processing transaction ${plaidTransaction.transaction_id}:`,
          error
        );
      }
    }

    console.log("📈 Processing complete:", results);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} transactions successfully`,
      results,
    });
  } catch (error) {
    console.error("❌ Error in clean transaction processing:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint for the clean processor
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    processor: "clean-plaid-transaction-processor",
    version: "1.0.0",
    description: "Clean 1:1 mapping from Plaid transactions to database schema",
    features: [
      "VERY_HIGH confidence merchant regex matching",
      "LOW confidence combined description parsing",
      "Automatic merchant creation with Plaid data",
      "Direct category mapping from Plaid detailed categories",
      "Preserves CSV processing compatibility",
    ],
  });
}
