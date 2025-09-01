# In python/app/routers/transactions.py

from fastapi import APIRouter, Depends, HTTPException, Body
import uuid
from typing import List, Dict, Any
# Assuming these dependencies provide your Supabase client and authenticated user
from ..dependencies import get_supabase_client, get_data_cache
from core.transaction_processor import process_transaction
from typing import Any

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)

# Define a Pydantic model for stronger type validation (optional but recommended)
from pydantic import BaseModel


class Transaction(BaseModel):
    date: str
    transaction_number: float  # Changed from str to float to match DB
    description: str
    amount: float
    balance: float | None = None  # Pass-through field for bank-provided balance
    # Allows for any other custom columns
    class Config:
        extra = 'allow'

class ProcessedTransaction(Transaction):
    merchant_id: str | None = None
    merchant_name: str | None = None
    category_id: str | None = None
    category_name: str | None = None
    confidence: float | None = None
    match_method: str | None = None
    clean_description: str | None = None
    needs_review: bool | None = None
    account_id: str | None = None
    original_description: str | None = None
    user_metadata: dict | None = None


class ProcessUploadPayload(BaseModel):
    account_id: str
    user_id: str
    transactions: List[Transaction] = []


@router.post(
    "/transaction-upload",
    response_model=Dict[str, Any],
    tags=["transactions"],
    summary="Process a batch of bank transactions, write to Supabase, and return a summary",
    description="""
    Receives a list of transactions, processes them using in-memory cached lookup tables, writes the enriched results to Supabase, and returns a summary of the operation. If any transaction has original_description == 'refresh data tables', refreshes the cache first.
    """
)
def transaction_upload(
    payload: ProcessUploadPayload,
    data_cache: Any = Depends(get_data_cache),
    supabase=Depends(get_supabase_client),
):
    """
    Processes and enriches a batch of transactions, writes them to Supabase, and returns a summary.
    """
    raw_transactions = payload.transactions

    errors = []
    success_count = 0
    # Refresh cache if needed
    for tx in raw_transactions:
        if (getattr(tx, 'original_description', None) or getattr(tx, 'description', None)) == "refresh data tables":
            data_cache.refresh()
            break


    # Validate required UUID inputs to avoid passing empty strings to UUID columns
    if not payload.user_id or str(payload.user_id).strip() == "":
        raise HTTPException(status_code=400, detail="user_id is required and must be a valid UUID")
    try:
        uuid.UUID(str(payload.user_id))
    except Exception:
        raise HTTPException(status_code=400, detail="user_id must be a valid UUID")

    if not payload.account_id or str(payload.account_id).strip() == "":
        raise HTTPException(status_code=400, detail="account_id is required and must be a valid UUID")
    try:
        uuid.UUID(str(payload.account_id))
    except Exception:
        raise HTTPException(status_code=400, detail="account_id must be a valid UUID")

    # Fetch user rules once for this user (sorted by priority - lower number = higher precedence)
    user_rules = supabase.table("user_rules").select("*").eq("user_id", payload.user_id).eq("enabled", True).order("priority", desc=False).execute().data or []
    print(f"DEBUG: Fetched {len(user_rules)} user rules for user {payload.user_id}")
    for rule in user_rules:
        print(f"DEBUG: Rule - {rule.get('match_field')}={rule.get('match_value')} -> category {rule.get('category_id')}")

    # Prepare all payloads for upsert
    upsert_payloads = []
    category_links = []
    for raw_tx in raw_transactions:
        tx_dict = raw_tx.dict()
        processed_tx = process_transaction(tx_dict, data_cache, user_rules)
        processed_tx['account_id'] = payload.account_id
        processed_tx['user_id'] = payload.user_id
        # Normalize transaction_number: ensure numeric (float) or None
        tx_num = processed_tx.get("transaction_number")
        if tx_num is None:
            tx_num_cast = None
        else:
            try:
                tx_num_cast = float(tx_num)
            except Exception:
                # if not castable, set to None so DB upsert will fail-fast or treat as unmatched
                tx_num_cast = None

        # Normalize needs_review: accept boolean, string values, or infer from confidence/merchant match
        def parse_bool_like(v):
            if v is None:
                return None
            if isinstance(v, bool):
                return v
            s = str(v).strip().lower()
            if s in ("true", "t", "1", "yes", "y"):
                return True
            if s in ("false", "f", "0", "no", "n"):
                return False
            return None

        needs_review_val = parse_bool_like(processed_tx.get("needs_review"))

        # If processor returned a confidence score, flag needs_review when confidence < 1
        conf = processed_tx.get("confidence")
        try:
            conf_val = float(conf) if conf is not None else None
        except Exception:
            conf_val = None

        # If merchant not matched, mark needs_review
        merchant_id = processed_tx.get("merchant_id")

        if needs_review_val is None:
            # infer from confidence or missing merchant
            if (conf_val is not None and conf_val < 1) or (merchant_id is None):
                needs_review_val = True
            else:
                needs_review_val = False

        # reflect normalized values back
        processed_tx['transaction_number'] = tx_num_cast
        processed_tx['needs_review'] = needs_review_val

        upsert_payload = {
            "amount": processed_tx.get("amount"),
            "original_description": processed_tx.get("original_description"),
            "clean_description": processed_tx.get("clean_description"),
            "date": processed_tx.get("date"),
            "merchant_id": processed_tx.get("merchant_id"),
            "transaction_number": processed_tx.get("transaction_number"),
            "balance": processed_tx.get("balance"),
            "user_metadata": processed_tx.get("user_metadata"),
            "account_id": processed_tx.get("account_id"),
            "user_id": processed_tx.get("user_id"),
            "needs_review": processed_tx.get("needs_review"),
        }
        upsert_payloads.append(upsert_payload)
        # Save for category link after upsert
        category_id = processed_tx.get("category_id")
        if category_id:
            category_links.append((upsert_payload, category_id))


    # Batch upsert
    response = supabase.table("transactions").upsert(
        upsert_payloads,
        on_conflict="transaction_number,date,amount"
    ).execute()

    # Count inserted (new) rows
    inserted_count = len(response.data) if getattr(response, "data", None) else 0
    success_count = inserted_count


    # Insert into transaction_categories for new transactions only, using upsert to avoid duplicate key errors
    category_inserted = 0
    category_duplicates = 0
    # Use DB RPC to insert category links, set primary if unset, and write audit rows.
    for row in (response.data or []):
        # Find the matching category_id
        for upsert_payload, category_id in category_links:
            # Match on all unique fields
            if (
                row.get("account_id") == upsert_payload["account_id"] and
                row.get("transaction_number") == upsert_payload["transaction_number"] and
                row.get("date") == upsert_payload["date"] and
                row.get("amount") == upsert_payload["amount"]
            ):
                transaction_id = row.get("id") or row.get("transaction_id")
                if transaction_id:
                    try:
                        rpc_resp = supabase.rpc(
                            "add_transaction_category_v2",
                            {
                                "p_tx_id": transaction_id,
                                "p_cat_id": category_id,
                                "p_user_id": payload.user_id,
                            },
                        ).execute()
                    except Exception as e:
                        errors.append({"transaction_id": transaction_id, "error": str(e)})
                        break

                    if getattr(rpc_resp, "error", None):
                        errors.append({"transaction_id": transaction_id, "error": str(rpc_resp.error)})
                    else:
                        category_inserted += 1
                break

    return {
        "success_count": success_count,
        "error_count": len(errors),
        "category_links_inserted": category_inserted,
        "category_links_duplicates": category_duplicates
    }