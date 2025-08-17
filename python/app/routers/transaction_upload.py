# In python/app/routers/transactions.py

from fastapi import APIRouter, Depends, HTTPException, Body
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
    transactions: List[Transaction]


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

    # Prepare all payloads for upsert
    upsert_payloads = []
    category_links = []
    for raw_tx in raw_transactions:
        tx_dict = raw_tx.dict()
        processed_tx = process_transaction(tx_dict, data_cache)
        processed_tx['account_id'] = payload.account_id
        processed_tx['user_id'] = payload.user_id
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
        }
        upsert_payloads.append(upsert_payload)
        # Save for category link after upsert
        category_id = processed_tx.get("category_id")
        if category_id:
            category_links.append((upsert_payload, category_id))

    print("UPSERT PAYLOADS:", upsert_payloads)
    print("TYPES:", [(type(tx['transaction_number']), type(tx['date']), type(tx['amount'])) for tx in upsert_payloads])

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
                    # Use upsert to avoid duplicate key errors
                    cat_link_resp = supabase.table("transaction_categories").upsert({
                        "transaction_id": transaction_id,
                        "category_id": category_id
                    }, on_conflict="transaction_id,category_id").execute()
                    # Count inserted vs. duplicate (if possible)
                    if getattr(cat_link_resp, "status_code", 200) < 400:
                        category_inserted += 1
                    else:
                        category_duplicates += 1
                    if getattr(cat_link_resp, "status_code", 200) >= 400:
                        errors.append({"transaction_id": transaction_id, "error": f"category link: {cat_link_resp}"})
                break

    return {
        "success_count": success_count,
        "error_count": len(errors),
        "category_links_inserted": category_inserted,
        "category_links_duplicates": category_duplicates
    }