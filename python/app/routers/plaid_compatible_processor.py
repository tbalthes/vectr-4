"""
Plaid transaction processing - works with existing frontend Plaid setup.
This extends your existing Plaid integration (/api/aggregator/plaid/*) to process 
transactions through the unified transaction processor.
"""

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from ..dependencies import get_supabase_client, get_data_cache
from core.plaid_transaction_processor import PlaidTransactionProcessor
from core.logger import setup_transaction_logger

router = APIRouter(
    prefix="/plaid-processor",
    tags=["plaid-processor"],
)

class PlaidTransactionData(BaseModel):
    """Plaid transaction data from your existing frontend integration"""
    transaction_id: str
    account_id: str  # Plaid account ID
    amount: float
    date: str
    name: str
    merchant_name: Optional[str] = None
    category: Optional[List[str]] = None
    pending: bool = False

class PlaidBatchProcessRequest(BaseModel):
    """Process a batch of Plaid transactions"""
    user_id: str = Field(..., description="User ID")
    internal_account_id: str = Field(..., description="Internal account ID from your accounts table")
    transactions: List[PlaidTransactionData] = Field(..., description="Plaid transactions to process")

class PlaidProcessingResponse(BaseModel):
    """Response from Plaid transaction processing"""
    success: bool
    transactions_processed: int
    transactions_added: int
    transactions_updated: int
    transactions_with_merchants: int
    errors: List[Dict[str, Any]]
    message: str

@router.post(
    "/process-batch",
    response_model=PlaidProcessingResponse,
    summary="Process Plaid transactions through unified processor",
    description="Process Plaid transactions using the unified transaction processor - works with your existing frontend Plaid integration"
)
def process_plaid_transaction_batch(
    request: PlaidBatchProcessRequest,
    supabase=Depends(get_supabase_client),
    data_cache=Depends(get_data_cache)
):
    """
    Process Plaid transactions through the unified transaction processor.
    
    This endpoint works with your existing:
    - /api/aggregator/plaid/create_link_token
    - /api/aggregator/plaid/exchange_public_token  
    - institutions table with Plaid provider
    - accounts table
    """
    logger, log_filename = setup_transaction_logger()
    logger.info(f"Starting Plaid transaction batch processing for user {request.user_id}")
    try:
        processor = PlaidTransactionProcessor(data_cache, supabase)
        
        total_processed = 0
        total_added = 0
        total_updated = 0
        total_with_merchants = 0
        errors = []
        
        # Verify the account belongs to the user
        account_check = supabase.table("accounts").select("account_id, user_id").eq(
            "account_id", request.internal_account_id
        ).eq("user_id", request.user_id).execute()
        
        if not account_check.data:
            raise HTTPException(
                status_code=404, 
                detail="Account not found or access denied"
            )
        
        for tx_data in request.transactions:
            try:
                # Transform Plaid data for unified processor
                transaction_input = {
                    "transaction_id": tx_data.transaction_id,
                    "account_id": request.internal_account_id,  # Internal account ID
                    "user_id": request.user_id,
                    "name": tx_data.name,
                    "merchant_name": tx_data.merchant_name,
                    "category": tx_data.category,
                    "amount": tx_data.amount,
                    "date": tx_data.date,
                    "description": tx_data.name,
                    "pending": tx_data.pending
                }
                
                logger.info(f"Processing transaction {tx_data.transaction_id}")
                # Process through unified processor
                processed_tx = processor.process_transaction(
                    transaction_data=transaction_input
                )
                
                # Check if transaction already exists
                existing = supabase.table("transactions").select("id").eq(
                    "aggregator_transaction_id", tx_data.transaction_id
                ).eq("user_id", request.user_id).execute()
                
                if existing.data:
                    # Update existing transaction
                    update_data = {
                        "merchant_id": processed_tx.get('merchant_id'),
                        "category_id": processed_tx.get('category_id'),
                        "clean_description": processed_tx.get('clean_description'),
                        "needs_review": processed_tx.get('needs_review'),
                        "confidence": processed_tx.get('confidence'),
                        "match_method": processed_tx.get('match_method'),
                        "user_metadata": processed_tx.get('user_metadata'),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    
                    supabase.table("transactions").update(update_data).eq(
                        "id", existing.data[0]["id"]
                    ).execute()
                    
                    total_updated += 1
                    logger.info(f"Updated existing transaction {tx_data.transaction_id}")
                else:
                    # Insert new transaction
                    transaction_record = {
                        "user_id": request.user_id,
                        "account_id": request.internal_account_id,
                        "aggregator_transaction_id": tx_data.transaction_id,
                        "date": processed_tx.get('date'),
                        "amount": processed_tx.get('amount'),
                        "original_description": processed_tx.get('original_description'),
                        "clean_description": processed_tx.get('clean_description'),
                        "merchant_id": processed_tx.get('merchant_id'),
                        "category_id": processed_tx.get('category_id'),
                        "needs_review": processed_tx.get('needs_review'),
                        "user_metadata": processed_tx.get('user_metadata'),
                        "created_at": datetime.utcnow().isoformat()
                    }
                    
                    supabase.table("transactions").insert(transaction_record).execute()
                    total_added += 1
                    logger.info(f"Added new transaction {tx_data.transaction_id}")
                
                total_processed += 1
                
                # Count transactions with merchant matches
                if processed_tx.get('merchant_id'):
                    total_with_merchants += 1
                    logger.info(f"Transaction {tx_data.transaction_id} matched to merchant {processed_tx.get('merchant_id')}")
                
            except Exception as tx_error:
                sentry_sdk.capture_exception(tx_error)
                errors.append({
                    "transaction_id": tx_data.transaction_id,
                    "error": str(tx_error)
                })
                logger.error(f"Transaction processing error for {tx_data.transaction_id}: {tx_error}")
        
        logger.info(f"Finished batch processing. Processed: {total_processed}, Added: {total_added}, Updated: {total_updated}, Errors: {len(errors)}")
        return PlaidProcessingResponse(
            success=len(errors) == 0,
            transactions_processed=total_processed,
            transactions_added=total_added,
            transactions_updated=total_updated,
            transactions_with_merchants=total_with_merchants,
            errors=errors,
            message=f"Processed {total_processed} Plaid transactions ({total_added} new, {total_updated} updated, {total_with_merchants} with merchants)"
        )
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Plaid transaction processing error: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to process Plaid transactions: {str(e)}"
        )

@router.get(
    "/stats",
    summary="Get Plaid processing statistics",
    description="Get statistics about Plaid transaction processing with your existing setup"
)
def get_plaid_processing_stats(
    user_id: Optional[str] = None,
    supabase=Depends(get_supabase_client),
    data_cache=Depends(get_data_cache)
):
    """Get statistics about Plaid transaction processing."""
    try:
        stats = {
            "processor_info": {
                "merchants_count": len(data_cache.merchants) if data_cache.merchants else 0,
                "categories_count": len(data_cache.categories) if data_cache.categories else 0,
                "version": "2.0.0"
            },
            "integration_status": {
                "frontend_plaid_endpoints": "✅ Active",
                "backend_processor": "✅ Active", 
                "merchant_matching": "✅ Active",
                "existing_institutions": "✅ Compatible"
            }
        }
        
        if user_id:
            # Get user's Plaid accounts using your existing structure
            plaid_accounts = supabase.table("accounts").select(
                "account_id, name, provider, aggregator_account_id, institution_id"
            ).eq("user_id", user_id).eq("provider", "plaid").execute()
            
            # Get Plaid transactions count
            plaid_transactions = supabase.table("transactions").select(
                "id", count="exact"
            ).eq("user_id", user_id).not_.is_("aggregator_transaction_id", "null").execute()
            
            # Get merchant matches for Plaid transactions
            merchant_matches = supabase.table("transactions").select(
                "id", count="exact"
            ).eq("user_id", user_id).not_.is_("aggregator_transaction_id", "null").not_.is_("merchant_id", "null").execute()
            
            stats["user_stats"] = {
                "plaid_accounts": len(plaid_accounts.data) if plaid_accounts.data else 0,
                "plaid_transactions": plaid_transactions.count or 0,
                "merchant_matches": merchant_matches.count or 0,
                "match_rate": round((merchant_matches.count or 0) / max(plaid_transactions.count or 1, 1) * 100, 2)
            }
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

@router.get(
    "/user-plaid-accounts",
    summary="Get user's Plaid accounts",
    description="Get Plaid accounts for a user using existing accounts table"
)
def get_user_plaid_accounts(
    user_id: str,
    supabase=Depends(get_supabase_client)
):
    """Get user's Plaid accounts using your existing accounts table structure."""
    try:
        # Get Plaid accounts with institution info using your existing structure
        accounts = supabase.table("accounts").select(
            """
            account_id,
            name,
            provider,
            aggregator_account_id,
            institution_id,
            created_at
            """
        ).eq("user_id", user_id).eq("provider", "plaid").execute()
        
        return {
            "user_id": user_id,
            "plaid_accounts": accounts.data or [],
            "total_plaid_accounts": len(accounts.data) if accounts.data else 0,
            "note": "Compatible with existing /api/accounts endpoint structure"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get accounts: {str(e)}")

@router.get(
    "/integration-status", 
    summary="Plaid integration status",
    description="Get status of Plaid integration (compatible with existing setup)"
)
def plaid_integration_status():
    """Get Plaid integration status - compatible with your existing setup."""
    return {
        "status": "✅ Compatible with existing Plaid setup",
        "existing_frontend_endpoints": {
            "create_link_token": "/api/aggregator/plaid/create_link_token",
            "exchange_public_token": "/api/aggregator/plaid/exchange_public_token",
            "webhook": "/api/aggregator/webhook",
            "accounts": "/api/accounts"
        },
        "new_backend_endpoints": {
            "process_batch": "/plaid-processor/process-batch",
            "stats": "/plaid-processor/stats", 
            "user_accounts": "/plaid-processor/user-plaid-accounts"
        },
        "existing_tables": {
            "institutions": "✅ Already supports Plaid provider",
            "accounts": "✅ Already has aggregator_account_id",
            "transactions": "✅ Already has aggregator_transaction_id",
            "merchants": "✅ Ready for enhanced matching"
        },
        "unified_processor": {
            "enabled": True,
            "merchant_matching": True,
            "category_mapping": True,
            "supported_sources": ["plaid", "csv", "manual"]
        },
        "next_steps": [
            "Call /plaid-processor/process-batch after getting Plaid transactions",
            "Merchants will be automatically matched and stored", 
            "Use existing /api/accounts endpoint for account display",
            "Use existing /api/transactions for transaction display"
        ]
    }
