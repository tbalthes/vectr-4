# In python/app/routers/transactions.py

from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any
# Assuming these dependencies provide your Supabase client and authenticated user
from ..dependencies import get_supabase_client
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
    # Allows for any other custom columns
    class Config:
        extra = 'allow'

class ProcessUploadPayload(BaseModel):
    account_id: str
    transactions: List[Transaction]


@router.post("/process-upload-local", response_model=List[Dict[str, Any]])
def process_upload_and_return_locally(
    payload: ProcessUploadPayload,
    supabase_client: Any = Depends(get_supabase_client),
    # user: dict = Depends(get_current_user) # Uncomment when auth is ready
):
    """
    Receives a list of transactions, processes them using live Supabase data,
    and returns the enriched results without saving them to the database.
    """
    raw_transactions = payload.transactions
    
    processed_results = []
    for raw_tx in raw_transactions:
        # Pydantic models need to be converted to dicts for processing
        processed_tx = process_transaction(raw_tx.dict(), supabase_client)
        
        # You can still add user and account info to the local result
        # processed_tx['user_id'] = user.get('id')
        processed_tx['account_id'] = payload.account_id
        processed_results.append(processed_tx)

    # The processed data is returned directly in the response.
    # The write-back operation is omitted as requested.
    #
    # PRODUCTION CODE TO WRITE TO DB WOULD LOOK LIKE THIS:
    #
    # try:
    #     response = supabase_client.table('transactions').upsert(processed_results).execute()
    #     if response.get('error'):
    #         raise HTTPException(status_code=500, detail=response['error']['message'])
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"Database error: {e}")

    return processed_results