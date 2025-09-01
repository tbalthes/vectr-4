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


class TransactionEditPayload(BaseModel):
    merchant_id: str | None = None
    merchant_name: str | None = None
    category_ids: List[str] | None = None
    clean_description: str | None = None
    note: str | None = None
    needs_review: bool | None = None
    edit_note: str | None = None  # User note about why they made this edit


class TransactionEditResponse(BaseModel):
    success: bool
    transaction_id: str
    audit_id: str | None = None
    before: Dict[str, Any] | None = None
    after: Dict[str, Any] | None = None
    updated_at: str | None = None
    error: str | None = None


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

    # Check for special refresh trigger (accepts either 'description' or 'original_description')
    for tx in raw_transactions:
        desc = getattr(tx, 'description', None)
        orig_desc = getattr(tx, 'original_description', None)
        if (desc and desc.strip().lower() == "refresh data tables") or (orig_desc and orig_desc.strip().lower() == "refresh data tables"):
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


@router.patch("/{transaction_id}", response_model=TransactionEditResponse)
def patch_transaction(
    transaction_id: str,
    payload: TransactionEditPayload,
    supabase=Depends(get_supabase_client),
    current_user: Any = None,  # replace with real auth dependency if available
):
    """
    Atomically update a transaction, sync category links, and write audit log.
    
    This endpoint:
    - Updates transaction fields (merchant, description, review status)
    - Replaces category associations 
    - Sets manual_edit=True and edited_at/edited_by
    - Writes detailed audit trail to transaction_edits
    - Prevents merchant creation from UI (must select existing merchant)
    """
    # Basic validation
    if not transaction_id:
        raise HTTPException(status_code=400, detail="transaction_id is required")

    try:
        uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid transaction_id format")

    # Verify transaction exists and obtain fallback user_id
    try:
        tx_resp = supabase.table("transactions").select("id,user_id").eq("id", transaction_id).single().execute()
        if not getattr(tx_resp, "data", None):
            raise HTTPException(status_code=404, detail="transaction not found")
        tx = tx_resp.data
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"transaction not found: {e}")

    # Enforce no merchant creation: merchant_name cannot be used without merchant_id
    if payload.merchant_name and not payload.merchant_id:
        raise HTTPException(
            status_code=400, 
            detail="Creating merchants from transaction edits is not allowed. Please select an existing merchant or leave merchant blank."
        )

    # Validate category_ids format if provided
    if payload.category_ids:
        for cat_id in payload.category_ids:
            try:
                uuid.UUID(cat_id)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"invalid category_id format: {cat_id}")

    # Validate merchant_id format if provided
    if payload.merchant_id:
        try:
            uuid.UUID(payload.merchant_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid merchant_id format")

    # Determine user id for audit: prefer authenticated user, fall back to transaction.user_id
    p_user_id = None
    if current_user:
        # Support dict-like or object with id attribute
        if isinstance(current_user, dict):
            p_user_id = current_user.get("id")
        else:
            p_user_id = getattr(current_user, "id", None)

    if not p_user_id:
        p_user_id = tx.get("user_id")

    # Validate final user id
    if not p_user_id:
        raise HTTPException(status_code=400, detail="authenticated user id required for audit trail")
    try:
        uuid.UUID(str(p_user_id))
    except Exception:
        raise HTTPException(status_code=400, detail="invalid user id for audit trail")

    # Prepare RPC parameters for atomic update
    rpc_params = {
        "p_tx_id": transaction_id,
        "p_merchant_id": payload.merchant_id,
        "p_merchant_name": payload.merchant_name,
        "p_category_ids": payload.category_ids,
        "p_clean_description": payload.clean_description,
        "p_note": payload.note,
        "p_user_id": p_user_id,
        "p_needs_review": payload.needs_review,
        "p_edit_note": payload.edit_note,
    }

    # Call the atomic RPC
    try:
        res = supabase.rpc("patch_transaction_complete", rpc_params).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"atomic update failed: {e}")

    # Check for RPC-level errors
    if getattr(res, "error", None):
        raise HTTPException(status_code=500, detail=f"database error: {res.error}")

    # Parse and validate RPC response
    data = getattr(res, "data", {})
    if not data:
        raise HTTPException(status_code=500, detail="no response from database function")

    # Check if RPC reported success
    if not data.get("success", False):
        error_msg = data.get("error", "unknown database error")
        raise HTTPException(status_code=400, detail=f"update failed: {error_msg}")

    # Return structured response
    return TransactionEditResponse(
        success=data.get("success", False),
        transaction_id=str(data.get("transaction_id", transaction_id)),
        audit_id=str(data.get("audit_id")) if data.get("audit_id") else None,
        before=data.get("before"),
        after=data.get("after"),
        updated_at=str(data.get("updated_at")) if data.get("updated_at") else None,
    )