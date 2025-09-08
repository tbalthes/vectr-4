"""
Enhanced transaction processing router with Plaid integration.
Maintains backward compatibility with existing CSV upload functionality.
"""

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
import uuid

# Import dependencies
from ..dependencies import get_supabase_client, get_data_cache
from core.plaid_transaction_processor import PlaidTransactionProcessor, TransactionSource

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)

# Enhanced models for multi-source transaction processing
class BaseTransaction(BaseModel):
    """Base transaction model with common fields"""
    date: str
    description: str
    amount: float
    balance: Optional[float] = None
    
    class Config:
        extra = 'allow'  # Allow additional fields for CSV flexibility

class PlaidTransaction(BaseTransaction):
    """Plaid-specific transaction model"""
    transaction_id: str = Field(..., description="Plaid transaction ID")
    account_id: str = Field(..., description="Plaid account ID") 
    merchant_name: Optional[str] = Field(None, description="Plaid merchant name")
    category: Optional[List[str]] = Field(None, description="Plaid category hierarchy")
    name: str = Field(..., description="Plaid transaction name")

class CSVTransaction(BaseTransaction):
    """CSV upload transaction model"""
    transaction_number: float = Field(..., description="Bank transaction number")

class ManualTransaction(BaseTransaction):
    """Manually entered transaction model"""
    transaction_number: Optional[float] = None
    merchant_id: Optional[str] = Field(None, description="Specific merchant ID")
    merchant_name: Optional[str] = Field(None, description="Merchant name")
    category_id: Optional[str] = Field(None, description="Category ID")
    category_name: Optional[str] = Field(None, description="Category name")

class EnrichedTransaction(BaseModel):
    """Standardized enriched transaction response"""
    # Core fields
    date: str
    description: str
    amount: float
    balance: Optional[float] = None
    account_id: Optional[str] = None
    user_id: Optional[str] = None
    transaction_number: Optional[float] = None
    
    # Enriched fields
    merchant_id: Optional[str] = None
    merchant_name: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    clean_description: str
    original_description: str
    
    # Metadata
    confidence: float
    match_method: str
    needs_review: bool
    user_metadata: Optional[Dict[str, Any]] = None
    aggregator_transaction_id: Optional[str] = None

# Request/Response models for batch processing
class PlaidTransactionBatch(BaseModel):
    """Batch of Plaid transactions"""
    account_id: str = Field(..., description="Internal account ID for mapping")
    user_id: str = Field(..., description="User ID")
    transactions: List[PlaidTransaction]

class CSVTransactionBatch(BaseModel):
    """Batch of CSV transactions (existing format)"""
    account_id: str
    user_id: str
    transactions: List[CSVTransaction]

class ManualTransactionBatch(BaseModel):
    """Batch of manual transactions"""
    account_id: str
    user_id: str
    transactions: List[ManualTransaction]

class BatchProcessResponse(BaseModel):
    """Response for batch processing"""
    processed_count: int
    success_count: int
    error_count: int
    transactions: List[EnrichedTransaction]
    errors: List[Dict[str, Any]]

@router.post(
    "/process-plaid-batch",
    response_model=BatchProcessResponse,
    summary="Process a batch of Plaid transactions",
    description="Process transactions from Plaid with merchant name and category enrichment"
)
def process_plaid_transactions(
    batch: PlaidTransactionBatch,
    data_cache=Depends(get_data_cache),
    supabase=Depends(get_supabase_client)
):
    """
    Process a batch of Plaid transactions.
    
    This endpoint:
    1. Uses Plaid's merchant_name for cleaner merchant identification
    2. Maps Plaid categories to internal categories
    3. Creates new merchants from Plaid data when needed
    4. Maintains transaction audit trail with aggregator_transaction_id
    """
    try:
        processor = PlaidTransactionProcessor(data_cache)
        
        processed_transactions = []
        errors = []
        success_count = 0
        
        for i, transaction in enumerate(batch.transactions):
            try:
                # Add batch metadata
                transaction_data = transaction.dict()
                transaction_data['account_id'] = batch.account_id
                transaction_data['user_id'] = batch.user_id
                
                # Process with Plaid source
                result = processor.process_transaction(
                    transaction_data=transaction_data,
                    source=TransactionSource.PLAID
                )
                
                processed_transactions.append(EnrichedTransaction(**result))
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "index": i,
                    "transaction_id": transaction.transaction_id,
                    "error": str(e)
                })
        
        return BatchProcessResponse(
            processed_count=len(batch.transactions),
            success_count=success_count,
            error_count=len(errors),
            transactions=processed_transactions,
            errors=errors
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process Plaid transactions: {str(e)}"
        )

@router.post(
    "/process-csv-batch", 
    response_model=BatchProcessResponse,
    summary="Process a batch of CSV transactions",
    description="Process CSV transactions using existing regex matching logic"
)
def process_csv_transactions(
    batch: CSVTransactionBatch,
    data_cache=Depends(get_data_cache)
):
    """
    Process a batch of CSV transactions using existing logic.
    Maintains full backward compatibility.
    """
    try:
        processor = PlaidTransactionProcessor(data_cache)
        
        processed_transactions = []
        errors = []
        success_count = 0
        
        for i, transaction in enumerate(batch.transactions):
            try:
                # Add batch metadata
                transaction_data = transaction.dict()
                transaction_data['account_id'] = batch.account_id
                transaction_data['user_id'] = batch.user_id
                
                # Process with CSV source
                result = processor.process_transaction(
                    transaction_data=transaction_data,
                    source=TransactionSource.CSV
                )
                
                processed_transactions.append(EnrichedTransaction(**result))
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "index": i,
                    "transaction_number": transaction.transaction_number,
                    "error": str(e)
                })
        
        return BatchProcessResponse(
            processed_count=len(batch.transactions),
            success_count=success_count,
            error_count=len(errors),
            transactions=processed_transactions,
            errors=errors
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process CSV transactions: {str(e)}"
        )

@router.post(
    "/process-manual-batch",
    response_model=BatchProcessResponse, 
    summary="Process manually entered transactions",
    description="Process transactions entered manually by users"
)
def process_manual_transactions(
    batch: ManualTransactionBatch,
    data_cache=Depends(get_data_cache)
):
    """
    Process manually entered transactions.
    Allows users to specify merchants and categories directly.
    """
    try:
        processor = PlaidTransactionProcessor(data_cache)
        
        processed_transactions = []
        errors = []
        success_count = 0
        
        for i, transaction in enumerate(batch.transactions):
            try:
                # Add batch metadata
                transaction_data = transaction.dict()
                transaction_data['account_id'] = batch.account_id
                transaction_data['user_id'] = batch.user_id
                
                # Process with manual source
                result = processor.process_transaction(
                    transaction_data=transaction_data,
                    source=TransactionSource.MANUAL
                )
                
                processed_transactions.append(EnrichedTransaction(**result))
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "index": i,
                    "description": transaction.description,
                    "error": str(e)
                })
        
        return BatchProcessResponse(
            processed_count=len(batch.transactions),
            success_count=success_count,
            error_count=len(errors),
            transactions=processed_transactions,
            errors=errors
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process manual transactions: {str(e)}"
        )

@router.post(
    "/process-single",
    response_model=EnrichedTransaction,
    summary="Process a single transaction",
    description="Process a single transaction from any source"
)
def process_single_transaction(
    transaction: Dict[str, Any] = Body(...),
    source: Literal["plaid", "csv", "manual"] = Query("csv", description="Transaction source"),
    account_id: str = Query(..., description="Account ID"),
    user_id: str = Query(..., description="User ID"),
    data_cache=Depends(get_data_cache)
):
    """
    Process a single transaction from any source.
    Useful for testing and individual transaction processing.
    """
    try:
        processor = PlaidTransactionProcessor(data_cache)
        
        # Add required metadata
        transaction['account_id'] = account_id
        transaction['user_id'] = user_id
        
        # Process transaction
        result = processor.process_transaction(
            transaction_data=transaction,
            source=TransactionSource(source)
        )
        
        return EnrichedTransaction(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process transaction: {str(e)}"
        )

# Legacy endpoint for backward compatibility
@router.post(
    "/process-upload-local",
    response_model=List[EnrichedTransaction],
    summary="Legacy CSV processing endpoint",
    description="Backward compatible endpoint for existing CSV upload functionality"
)
def process_upload_local_legacy(
    payload: CSVTransactionBatch,
    data_cache=Depends(get_data_cache)
):
    """
    Legacy endpoint that maintains exact compatibility with existing CSV upload.
    Routes to the new CSV batch processor.
    """
    batch_response = process_csv_transactions(payload, data_cache)
    return batch_response.transactions

@router.get(
    "/processing-stats",
    summary="Get transaction processing statistics",
    description="Get statistics about merchant matching and categorization performance"
)
def get_processing_stats(
    data_cache=Depends(get_data_cache)
):
    """
    Get statistics about the transaction processing system.
    Useful for monitoring merchant match rates and categorization accuracy.
    """
    try:
        stats = {
            "merchants_count": len(data_cache.merchants) if data_cache.merchants else 0,
            "categories_count": len(data_cache.categories) if data_cache.categories else 0,
            "regex_rules_count": len(data_cache.global_regex_rules) if hasattr(data_cache, 'global_regex_rules') and data_cache.global_regex_rules else 0,
            "mcc_mappings_count": len(data_cache.mcc_category_map) if hasattr(data_cache, 'mcc_category_map') and data_cache.mcc_category_map else 0,
        }
        
        return {
            "status": "active",
            "cache_stats": stats,
            "supported_sources": ["plaid", "csv", "manual"],
            "version": "2.0.0"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get processing stats: {str(e)}"
        )
