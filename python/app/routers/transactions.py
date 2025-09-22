# In python/app/routers/transactions.py

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
import uuid

from ..dependencies import get_supabase_client, get_data_cache
from core.transaction_processor import process_transaction

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)

# Pydantic Models for request and response bodies
class Transaction(BaseModel):
    date: str
    original_description: str
    amount: float
    currency: str | None = None
    
    class Config:
        extra = 'allow'

class ProcessedTransaction(BaseModel):
    account_id: str
    date: str
    original_description: str
    amount: float
    currency: str | None = None
    merchant_id: str | None = None
    merchant_name: str | None = None
    category_id: str | None = None
    category_name: str | None = None
    logo_url: str | None = None
    website: str | None = None
    primary_category: str | None = None
    detailed_category: str | None = None
    category_confidence_level: str | None = None
    needs_review: bool | None = None
    
    class Config:
        extra = 'allow'

class ProcessUploadPayload(BaseModel):
    account_id: str
    transactions: List[Transaction]

class TransactionEditPayload(BaseModel):
    merchant_id: str | None = None
    category_id: str | None = None
    notes: str | None = None
    is_hidden: bool | None = None

class TransactionEditResponse(BaseModel):
    success: bool
    transaction_id: str
    updated_at: str
    error: str | None = None

@router.post(
    "/process-upload-local",
    response_model=List[ProcessedTransaction],
    summary="Process a batch of transactions and return enriched results without saving.",
)
def process_upload_and_return_locally(
    payload: ProcessUploadPayload,
    data_cache: Any = Depends(get_data_cache),
):
    """
    Receives a list of transactions, processes them using in-memory cached lookup tables,
    and returns the enriched results without saving them to the database.
    """
    raw_transactions = payload.transactions

    # Optional: Refresh cache if a specific trigger is met
    if any(tx.original_description.strip().lower() == "refresh data tables" for tx in raw_transactions):
        data_cache.refresh()

    processed_results = []
    for raw_tx in raw_transactions:
        tx_dict = raw_tx.dict()
        processed_tx = process_transaction(tx_dict, data_cache)
        processed_tx['account_id'] = payload.account_id
        processed_results.append(processed_tx)

    return [ProcessedTransaction(**tx) for tx in processed_results]

@router.patch("/{transaction_id}", response_model=TransactionEditResponse)
def patch_transaction(
    transaction_id: str,
    payload: TransactionEditPayload,
    supabase=Depends(get_supabase_client),
    current_user: Any = None, # Replace with your actual auth dependency
):
    """
    Update a transaction's merchant, category, notes, or hidden status.
    """
    if not transaction_id:
        raise HTTPException(status_code=400, detail="transaction_id is required")

    try:
        uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction_id format")

    # Prepare the update payload
    update_data = payload.dict(exclude_unset=True)
    update_data["updated_at"] = "now()"

    try:
        # Fetch the user_id from the current_user object
        user_id = current_user.id if current_user else None
        if not user_id:
            # As a fallback, you might want to fetch the user_id from the transaction itself
            # This depends on your security model
            tx_resp = supabase.table("transactions").select("user_id").eq("transaction_id", transaction_id).single().execute()
            if tx_resp.data:
                user_id = tx_resp.data['user_id']
        
        if not user_id:
            raise HTTPException(status_code=403, detail="User not authenticated or transaction does not exist.")

        # Perform the update
        res = supabase.table("transactions").update(update_data).eq("transaction_id", transaction_id).eq("user_id", user_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Transaction not found or user does not have permission to edit.")

        # Create a record in transaction_edits
        edit_record = {
            "transaction_id": transaction_id,
            "user_id": user_id,
            "changes": payload.dict(exclude_unset=True)
        }
        supabase.table("transaction_edits").insert(edit_record).execute()

        return TransactionEditResponse(
            success=True,
            transaction_id=transaction_id,
            updated_at=res.data[0]['updated_at']
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))