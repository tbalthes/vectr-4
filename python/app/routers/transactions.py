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
    transaction_number: str
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
    transactions: List[Transaction]


@router.post(
    "/process-upload-local",
    response_model=List[ProcessedTransaction],
    tags=["transactions"],
    summary="Process a batch of bank transactions and return enriched results",
    description="""
    Receives a list of transactions, processes them using in-memory cached lookup tables, and returns the enriched results without saving them to the database. If any transaction has original_description == 'refresh data tables', refreshes the cache first.
    """
)
def process_upload_and_return_locally(
    payload: ProcessUploadPayload,
    data_cache: Any = Depends(get_data_cache),
):
    """
    Receives a list of transactions, processes them using in-memory cached lookup tables,
    and returns the enriched results without saving them to the database.
    If any transaction has original_description == "refresh data tables", refreshes the cache first.
    """
    raw_transactions = payload.transactions

    # Check for special refresh trigger
    for tx in raw_transactions:
        if (getattr(tx, 'original_description', None) or getattr(tx, 'description', None)) == "refresh data tables":
            data_cache.refresh()
            break

    processed_results = []
    for raw_tx in raw_transactions:
        tx_dict = raw_tx.dict()
        processed_tx = process_transaction(tx_dict, data_cache)
        processed_tx['account_id'] = payload.account_id
        processed_results.append(processed_tx)

    # Convert dicts to ProcessedTransaction instances for FastAPI response validation
    return [ProcessedTransaction(**tx) for tx in processed_results]