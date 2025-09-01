import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

interface DetailedTransaction {
  id: string;
  transaction_number: string;
  date: string;
  clean_description: string;
  original_description: string;
  amount: number;
  balance: number | null;
  user_metadata: Record<string, string | number | boolean> | null;
  needs_review: boolean;
  transaction_note: string | null;
  merchant_name: string;
  merchant_logo_url: string | null;
  merchant_id?: string | null;
  category_name: string;
  category_icon: string;
  category_id?: string | null;
  parent_category_name: string | null;
  custom_fields: Record<string, string | number | boolean>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the authenticated user from the client
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
      console.error("Authentication error:", userError);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const { id: transactionId } = (await params) as { id: string };
    console.log(
      "API: Fetching detailed transaction:",
      transactionId,
      "for user:",
      user.id
    );

    // Create a service role client to bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch detailed transaction data with category information
    const { data: transactionData, error: transactionError } =
      await serviceSupabase
        .from("transactions")
        .select(
          `
        id,
        transaction_number,
        date,
        clean_description,
        original_description,
        amount,
        balance,
        user_metadata,
        needs_review,
        transaction_note,
        merchants (
          name,
          logo_url,
          categories (
            id,
            name,
            icon,
            parent_id
          )
        )
      `
        )
        .eq("id", transactionId)
        .eq("user_id", user.id)
        .single();

    if (transactionError || !transactionData) {
      console.error("Transaction fetch error:", transactionError);
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Extract merchant and category data
    const merchant = Array.isArray(transactionData.merchants)
      ? transactionData.merchants[0]
      : transactionData.merchants;

    // Prefer an explicit transaction->category mapping when present. Some
    // deployments store the category mapping in a join table
    // `transaction_categories`. Read that first; if not present fall back to
    // the merchant's categories (legacy behavior) or user_metadata.manual_category.
    let category: {
      id?: string;
      name?: string;
      icon?: string;
      parent_id?: string;
    } | null = null;
    try {
      const { data: txCat, error: txCatErr } = await serviceSupabase
        .from("transaction_categories")
        .select("category_id")
        .eq("transaction_id", transactionId)
        .limit(1)
        .maybeSingle();

      if (
        !txCatErr &&
        txCat &&
        (txCat as Record<string, unknown>).category_id
      ) {
        const cid = String((txCat as Record<string, unknown>).category_id);
        const { data: catRow, error: catErr } = await serviceSupabase
          .from("categories")
          .select("id, name, icon, parent_id")
          .eq("id", cid)
          .limit(1)
          .maybeSingle();

        if (!catErr && catRow) {
          category = catRow as {
            id?: string;
            name?: string;
            icon?: string;
            parent_id?: string;
          };
        }
      }
    } catch (e) {
      console.warn(
        "Failed to fetch transaction_categories mapping or category row, falling back to merchant categories",
        e
      );
    }

    // Fallback to merchant.categories if no explicit mapping found
    if (!category) {
      const mc = Array.isArray(merchant?.categories)
        ? merchant?.categories[0]
        : merchant?.categories;
      category = mc || null;
    }

    let parentCategoryName: string | null = null;

    // If category has a parent_id, fetch the parent category
    if (category?.parent_id) {
      const { data: parentCategory, error: parentError } = await serviceSupabase
        .from("categories")
        .select("name")
        .eq("id", category.parent_id)
        .single();

      if (!parentError && parentCategory) {
        parentCategoryName = parentCategory.name;
      }
    }

    // Process custom fields from user_metadata
    const customFields: Record<string, string | number | boolean> = {};
    if (
      transactionData.user_metadata &&
      typeof transactionData.user_metadata === "object"
    ) {
      Object.entries(transactionData.user_metadata).forEach(([key, value]) => {
        // Skip internal/system fields
        const isSystemField =
          key.startsWith("_") ||
          key.toLowerCase().includes("rowindex") ||
          key.toLowerCase().includes("formattedamount") ||
          key.toLowerCase().includes("index");

        if (
          !isSystemField &&
          value !== null &&
          value !== undefined &&
          value !== ""
        ) {
          // Only include values that match our expected types
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            customFields[key] = value;
          }
        }
      });
    }

    const detailedTransaction: DetailedTransaction = {
      id: transactionData.id,
      transaction_number: transactionData.transaction_number,
      date: transactionData.date,
      clean_description: transactionData.clean_description,
      original_description: transactionData.original_description,
      amount: transactionData.amount,
      balance: transactionData.balance,
      user_metadata: transactionData.user_metadata,
      needs_review: transactionData.needs_review,
      transaction_note: transactionData.transaction_note,
      merchant_name: merchant?.name || "Unknown",
      merchant_logo_url: merchant?.logo_url || null,
      category_name: category?.name || "Uncategorized",
      category_icon: category?.icon || "HelpCircle",
      parent_category_name: parentCategoryName,
      custom_fields: customFields,
    };

    console.log(
      "API: Successfully fetched detailed transaction:",
      transactionId
    );

    return NextResponse.json({ data: detailedTransaction });
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the authenticated user from the client
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
      console.error("Authentication error:", userError);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const { id: transactionId } = (await params) as { id: string };
    const updateData = await request.json();

    console.log(
      "API: Updating transaction:",
      transactionId,
      "for user:",
      user.id,
      "with data:",
      updateData
    );

    // Create a service role client to bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the existing transaction to ensure it belongs to the authenticated user
    const { data: existingTx, error: existingTxErr } = await serviceSupabase
      .from("transactions")
      .select("id, user_id")
      .eq("id", transactionId)
      .limit(1)
      .maybeSingle();

    if (existingTxErr || !existingTx) {
      console.error(
        "Transaction not found or access denied for id:",
        transactionId,
        existingTxErr
      );
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Prepare the update object with only allowed fields that actually exist on the
    // transactions table. The DB stores merchant/category as *_id columns, so
    // accept merchant_name/category_name from the client and resolve them below
    // into merchant_id/category_id. Do NOT attempt to update non-existent
    // "merchant_name"/"category_name" columns directly.
    const allowedFields = [
      "date",
      "clean_description",
      "original_description",
      "amount",
      "balance",
      "transaction_note",
      "needs_review",
      "merchant_id",
      "category_id",
    ];

    const updateObject: Record<string, string | number | boolean | null> = {};

    // Map direct updatable scalar fields first
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateObject[field] = updateData[field];
      }
    }

    // If the client provided merchant_name, try to resolve it to merchant_id
    if (updateData.merchant_name !== undefined) {
      const name = String(updateData.merchant_name || "").trim();
      if (name === "") {
        updateObject.merchant_id = null;
      } else {
        try {
          // Try exact match first, then case-insensitive match
          type IdRow = { id?: string | number | null } | null;
          const { data: merchantExact } = (await serviceSupabase
            .from("merchants")
            .select("id")
            .eq("name", name)
            .limit(1)
            .maybeSingle()) as { data: IdRow };

          if (merchantExact && merchantExact.id) {
            updateObject.merchant_id = merchantExact.id as string;
          } else {
            const { data: merchantLike } = (await serviceSupabase
              .from("merchants")
              .select("id")
              .ilike("name", name)
              .limit(1)
              .maybeSingle()) as { data: IdRow };

            if (merchantLike && merchantLike.id) {
              updateObject.merchant_id = merchantLike.id as string;
            } else {
              // No matching merchant found; set null so transaction is uncoupled
              updateObject.merchant_id = null;
            }
          }
        } catch (lookupErr) {
          console.error(
            "Error resolving merchant_name -> merchant_id:",
            lookupErr
          );
          updateObject.merchant_id = null;
        }
      }
    }

    // Debug helper to capture category lookup attempts for client inspection
    let debugCategoryLookup: Record<string, unknown> | null = null;

    // If the client provided category_name, try to resolve it to category_id
    if (updateData.category_name !== undefined) {
      const cname = String(updateData.category_name || "").trim();
      debugCategoryLookup = {
        raw: updateData.category_name,
        trimmed: cname,
        length: cname.length,
      };
      if (cname === "") {
        updateObject.category_id = null;
      } else {
        try {
          // Try exact match first, then case-insensitive, then wildcard ilike.
          // Do NOT auto-create categories here; an explicit match is required.
          type IdRow = { id?: string | number | null } | null;

          console.log(
            "API: resolving category_name -> id for:",
            JSON.stringify(cname)
          );

          const { data: catExact, error: catExactErr } = (await serviceSupabase
            .from("categories")
            .select("id, name")
            .eq("name", cname)
            .limit(1)
            .maybeSingle()) as { data: IdRow; error?: unknown };

          console.log("API: category exact lookup result:", {
            catExact,
            catExactErr,
          });
          debugCategoryLookup ||= {};
          (debugCategoryLookup as Record<string, unknown>).exact =
            catExact ?? null;

          if (catExact?.id != null) {
            updateObject.category_id = String((catExact as IdRow).id!);
          } else {
            // try ilike without wildcard first (case-insensitive exact)
            const { data: catLike, error: catLikeErr } = (await serviceSupabase
              .from("categories")
              .select("id, name")
              .ilike("name", cname)
              .limit(1)
              .maybeSingle()) as { data: IdRow; error?: unknown };

            console.log("API: category ilike lookup result (no wildcard):", {
              catLike,
              catLikeErr,
            });
            (debugCategoryLookup as Record<string, unknown>).ilike =
              catLike ?? null;

            if (catLike?.id != null) {
              updateObject.category_id = String((catLike as IdRow).id!);
            } else {
              // final attempt: wildcard ilike
              const safe = cname.replace(/%/g, "").trim();
              const pattern = `%${safe}%`;
              const { data: catLikeWildcard, error: catLikeWildcardErr } =
                (await serviceSupabase
                  .from("categories")
                  .select("id, name")
                  .ilike("name", pattern)
                  .limit(1)
                  .maybeSingle()) as { data: IdRow; error?: unknown };

              console.log("API: category ilike lookup result (wildcard):", {
                catLikeWildcard,
                catLikeWildcardErr,
                pattern,
              });
              (debugCategoryLookup as Record<string, unknown>).wildcard = {
                row: catLikeWildcard ?? null,
                pattern,
              };

              if (catLikeWildcard?.id != null) {
                updateObject.category_id = String(
                  (catLikeWildcard as IdRow).id!
                );
              } else {
                // No match found; explicitly unset mapping (do not create new category)
                console.log(
                  "API: no category match found for name, will unset category mapping for transaction"
                );
                (debugCategoryLookup as Record<string, unknown>).matched = null;
                updateObject.category_id = null;
              }
            }
          }
        } catch (lookupErr) {
          console.error(
            "Error resolving category_name -> category_id:",
            lookupErr
          );
          updateObject.category_id = null;
        }
      }
    }

    // Two-stage update to avoid attempting to write columns that may not exist
    // 1) Update safe scalar fields
    // 2) Attempt to update merchant_id/category_id (if present). If that fails,
    //    persist the provided names into user_metadata.manual_* as a fallback.

    const scalarFields = [
      "date",
      "clean_description",
      "original_description",
      "amount",
      "balance",
      "transaction_note",
      "needs_review",
    ];

    const baseUpdate: Record<string, unknown> = {};
    for (const k of scalarFields) {
      if (updateObject[k] !== undefined) baseUpdate[k] = updateObject[k];
    }

    // Apply base update
    const { data: baseUpdated, error: baseError } = await serviceSupabase
      .from("transactions")
      .update(baseUpdate)
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (baseError) {
      console.error("Transaction base update error:", baseError);
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 400 }
      );
    }

    let updatedTransaction = baseUpdated;

    // Attempt to update merchant_id on transactions (if present). We do NOT
    // attempt to update a transactions.category_id column because this schema
    // uses a join table `transaction_categories` to map transactions -> categories.
    const idUpdate: Record<string, unknown> = {};
    if (updateObject.merchant_id !== undefined)
      idUpdate.merchant_id = updateObject.merchant_id;

    if (Object.keys(idUpdate).length > 0) {
      try {
        const { data: idUpdated, error: idErr } = await serviceSupabase
          .from("transactions")
          .update(idUpdate)
          .eq("id", transactionId)
          .eq("user_id", user.id)
          .select()
          .maybeSingle();

        if (idErr) {
          throw idErr;
        }

        updatedTransaction = idUpdated || updatedTransaction;
      } catch (idErr) {
        console.warn(
          "Merchant ID update failed, falling back to merging names into user_metadata:",
          idErr
        );
        try {
          const { data: existingRow } = await serviceSupabase
            .from("transactions")
            .select("user_metadata")
            .eq("id", transactionId)
            .limit(1)
            .maybeSingle();

          type MetaRow = {
            user_metadata?: Record<string, unknown> | null;
          } | null;
          let existingMetaRecord: Record<string, unknown> = {};
          if (existingRow) {
            const er = existingRow as MetaRow;
            if (
              er &&
              er.user_metadata &&
              typeof er.user_metadata === "object"
            ) {
              existingMetaRecord = er.user_metadata as Record<string, unknown>;
            }
          }

          const mergedMeta = {
            ...existingMetaRecord,
            manual_merchant:
              updateData.merchant_name ?? existingMetaRecord.manual_merchant,
            manual_category:
              updateData.category_name ?? existingMetaRecord.manual_category,
          };

          const { data: metaUpdated, error: metaErr } = await serviceSupabase
            .from("transactions")
            .update({ user_metadata: mergedMeta })
            .eq("id", transactionId)
            .eq("user_id", user.id)
            .select()
            .maybeSingle();

          if (metaErr) {
            console.error("Failed to persist fallback user_metadata:", metaErr);
            return NextResponse.json(
              { error: "Failed to update transaction" },
              { status: 400 }
            );
          }

          updatedTransaction = metaUpdated || updatedTransaction;
        } catch (metaEx) {
          console.error("Error during metadata fallback:", metaEx);
          return NextResponse.json(
            { error: "Failed to update transaction" },
            { status: 400 }
          );
        }
      }
    }

    // Handle category mapping via the join table `transaction_categories` and primary_category_id.
    if (updateObject.category_id !== undefined) {
      try {
        console.log("API: category_id to apply:", updateObject.category_id);

        if (updateObject.category_id !== null) {
          // First, remove existing mappings to avoid duplicates
          const { error: delErr } = await serviceSupabase
            .from("transaction_categories")
            .delete()
            .eq("transaction_id", transactionId);

          if (delErr) {
            console.error(
              "API: error deleting existing transaction_categories rows:",
              delErr
            );
            // Don't throw here, continue with the insert
          }

          // Use the RPC function to properly handle both join table and primary_category_id
          const { data: rpcResult, error: rpcErr } = await serviceSupabase.rpc(
            "add_transaction_category_v2",
            {
              p_tx_id: transactionId,
              p_cat_id: updateObject.category_id,
              p_user_id: user.id,
            }
          );

          if (rpcErr) {
            console.error(
              "API: error calling add_transaction_category_v2 RPC:",
              rpcErr
            );
            throw rpcErr;
          }

          console.log("API: add_transaction_category_v2 result:", rpcResult);

          // Also ensure primary_category_id is updated even if it was already set
          const { error: primaryErr } = await serviceSupabase
            .from("transactions")
            .update({ primary_category_id: updateObject.category_id })
            .eq("id", transactionId)
            .eq("user_id", user.id);

          if (primaryErr) {
            console.warn(
              "API: warning updating primary_category_id:",
              primaryErr
            );
            // Don't throw here, the join table is the main thing
          }
        } else {
          // Remove existing mappings for this transaction if category_id is null
          const { error: delErr } = await serviceSupabase
            .from("transaction_categories")
            .delete()
            .eq("transaction_id", transactionId);

          if (delErr) {
            console.error(
              "API: error deleting existing transaction_categories rows:",
              delErr
            );
            throw delErr;
          }

          // Also clear primary_category_id when removing category
          const { error: clearErr } = await serviceSupabase
            .from("transactions")
            .update({ primary_category_id: null })
            .eq("id", transactionId)
            .eq("user_id", user.id);

          if (clearErr) {
            console.error("API: error clearing primary_category_id:", clearErr);
            throw clearErr;
          }
        }

        // Re-fetch a fresh transactions row to reflect any changes
        const { data: refetched } = await serviceSupabase
          .from("transactions")
          .select("*")
          .eq("id", transactionId)
          .eq("user_id", user.id)
          .maybeSingle();

        updatedTransaction = refetched || updatedTransaction;
        // Also fetch the mapping to include in the response for debugging/confirmation
        try {
          const { data: mappingRows, error: mappingErr } = await serviceSupabase
            .from("transaction_categories")
            .select("category_id, categories(id, name, icon)")
            .eq("transaction_id", transactionId);

          if (!mappingErr) {
            console.log(
              "API: transaction_categories mapping rows after update:",
              mappingRows
            );
          } else {
            console.warn(
              "API: failed to fetch transaction_categories mapping after update:",
              mappingErr
            );
          }
        } catch (e) {
          console.warn(
            "API: exception fetching transaction_categories mapping after update:",
            e
          );
        }
      } catch (catErr) {
        console.warn(
          "Category mapping update failed, falling back to merging names into user_metadata:",
          catErr
        );
        try {
          const { data: existingRow } = await serviceSupabase
            .from("transactions")
            .select("user_metadata")
            .eq("id", transactionId)
            .limit(1)
            .maybeSingle();

          type MetaRow = {
            user_metadata?: Record<string, unknown> | null;
          } | null;
          let existingMetaRecord: Record<string, unknown> = {};
          if (existingRow) {
            const er = existingRow as MetaRow;
            if (
              er &&
              er.user_metadata &&
              typeof er.user_metadata === "object"
            ) {
              existingMetaRecord = er.user_metadata as Record<string, unknown>;
            }
          }

          const mergedMeta = {
            ...existingMetaRecord,
            manual_merchant:
              updateData.merchant_name ?? existingMetaRecord.manual_merchant,
            manual_category:
              updateData.category_name ?? existingMetaRecord.manual_category,
          };

          const { data: metaUpdated, error: metaErr } = await serviceSupabase
            .from("transactions")
            .update({ user_metadata: mergedMeta })
            .eq("id", transactionId)
            .eq("user_id", user.id)
            .select()
            .maybeSingle();

          if (metaErr) {
            console.error("Failed to persist fallback user_metadata:", metaErr);
            return NextResponse.json(
              { error: "Failed to update transaction" },
              { status: 400 }
            );
          }

          updatedTransaction = metaUpdated || updatedTransaction;
        } catch (metaEx) {
          console.error(
            "Error during metadata fallback for category mapping:",
            metaEx
          );
          return NextResponse.json(
            { error: "Failed to update transaction" },
            { status: 400 }
          );
        }
      }
    }

    if (!updatedTransaction) {
      console.error("Transaction update error: no updated row returned");
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 400 }
      );
    }

    console.log("API: Successfully updated transaction:", transactionId);

    // For debugging, attempt to fetch any transaction_categories rows to return
    let mappingRows: unknown = null;
    try {
      const { data: mr } = await serviceSupabase
        .from("transaction_categories")
        .select("category_id, categories(id, name, icon)")
        .eq("transaction_id", transactionId);
      mappingRows = mr;
    } catch (e) {
      console.warn("API: failed to fetch mapping rows for response:", e);
    }

    return NextResponse.json({
      data: updatedTransaction,
      mapping: mappingRows,
      debug: debugCategoryLookup,
      message: "Transaction updated successfully",
    });
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the authenticated user from the client
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
      console.error("Authentication error:", userError);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const transactionId = params.id;
    console.log(
      "API: Deleting transaction:",
      transactionId,
      "for user:",
      user.id
    );

    // Create a service role client to bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Delete the transaction
    const { error: deleteError } = await serviceSupabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Transaction delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete transaction" },
        { status: 400 }
      );
    }

    console.log("API: Successfully deleted transaction:", transactionId);

    return NextResponse.json({
      message: "Transaction deleted successfully",
    });
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
