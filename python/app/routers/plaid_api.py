"""
Plaid API integration endpoints for real-time transaction processing.
Handles Plaid webhooks, account linking, and transaction synchronization.
Works with existing institutions and accounts schema.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Body
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import uuid
import json
import requests
from datetime import datetime, date

# Import dependencies
from ..dependencies import get_supabase_client, get_data_cache
from core.plaid_transaction_processor import PlaidTransactionProcessor, TransactionSource

router = APIRouter(
    prefix="/plaid",
    tags=["plaid"],
)

# Plaid webhook models
class PlaidWebhookTransaction(BaseModel):
    """Plaid transaction from webhook"""
    transaction_id: str
    account_id: str
    amount: float
    iso_currency_code: Optional[str] = "USD"
    unofficial_currency_code: Optional[str] = None
    category: Optional[List[str]] = None
    category_id: Optional[str] = None
    check_number: Optional[str] = None
    date: str  # YYYY-MM-DD format
    datetime: Optional[str] = None
    authorized_date: Optional[str] = None
    authorized_datetime: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    name: str
    merchant_name: Optional[str] = None
    payment_meta: Optional[Dict[str, Any]] = None
    payment_channel: Optional[str] = None
    pending: bool = False
    pending_transaction_id: Optional[str] = None
    account_owner: Optional[str] = None
    transaction_type: Optional[str] = None
    website: Optional[str] = None
    personal_finance_category: Optional[Dict[str, Any]] = None

class PlaidWebhookData(BaseModel):
    """Plaid webhook payload structure"""
    webhook_type: str
    webhook_code: str
    item_id: str
    new_transactions: Optional[int] = None
    removed_transactions: Optional[List[str]] = None
    transactions: Optional[List[PlaidWebhookTransaction]] = None
    error: Optional[Dict[str, Any]] = None

class PlaidAccount(BaseModel):
    """Plaid account information"""
    account_id: str
    balances: Dict[str, Any]
    mask: Optional[str] = None
    name: str
    official_name: Optional[str] = None
    type: str
    subtype: Optional[str] = None
    verification_status: Optional[str] = None

class PlaidAccountLinkRequest(BaseModel):
    """Request to link a Plaid account - works with existing institutions table"""
    user_id: str = Field(..., description="Internal user ID")
    item_id: str = Field(..., description="Plaid item ID")
    access_token: str = Field(..., description="Plaid access token")
    institution_id: str = Field(..., description="Plaid institution ID (matches institutions table)")
    accounts: List[PlaidAccount] = Field(..., description="List of linked accounts")

class PlaidTransactionSyncRequest(BaseModel):
    """Request to sync transactions for a user"""
    user_id: str = Field(..., description="Internal user ID")
    account_id: Optional[str] = Field(None, description="Specific account to sync (optional)")
    start_date: Optional[str] = Field(None, description="Start date for sync (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="End date for sync (YYYY-MM-DD)")

class PlaidSyncResponse(BaseModel):
    """Response from transaction sync"""
    success: bool
    transactions_processed: int
    transactions_added: int
    transactions_updated: int
    errors: List[Dict[str, Any]]
    message: str

@router.post(
    "/webhook",
    summary="Plaid webhook endpoint",
    description="Receives and processes Plaid webhooks for real-time transaction updates"
)
async def plaid_webhook(
    request: Request,
    supabase=Depends(get_supabase_client),
    data_cache=Depends(get_data_cache)
):
    """
    Process incoming Plaid webhooks.
    
    Handles:
    - TRANSACTIONS: New transactions, transaction updates, removed transactions
    - ITEM: Item updates, errors
    - ASSETS: Asset report updates
    """
    try:
        # Parse webhook payload
        body = await request.body()
        webhook_data = json.loads(body.decode())
        
        print(f"📥 Received Plaid webhook: {webhook_data.get('webhook_type')}.{webhook_data.get('webhook_code')}")
        
        # Log webhook event
        webhook_event = {
            "webhook_type": webhook_data.get('webhook_type'),
            "webhook_code": webhook_data.get('webhook_code'),
            "item_id": webhook_data.get('item_id'),
            "payload": webhook_data,
            "processed_at": datetime.utcnow().isoformat(),
            "status": "received"
        }
        
        # Store webhook event for audit trail
        supabase.table("webhook_events").insert(webhook_event).execute()
        
        # Process based on webhook type
        if webhook_data.get('webhook_type') == 'TRANSACTIONS':
            return await process_transactions_webhook(webhook_data, supabase, data_cache)
        elif webhook_data.get('webhook_type') == 'ITEM':
            return await process_item_webhook(webhook_data, supabase)
        else:
            print(f"⚠️ Unhandled webhook type: {webhook_data.get('webhook_type')}")
            return {"status": "ignored", "message": f"Webhook type {webhook_data.get('webhook_type')} not implemented"}
        
    except Exception as e:
        print(f"❌ Webhook processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

async def process_transactions_webhook(
    webhook_data: Dict[str, Any], 
    supabase, 
    data_cache
) -> Dict[str, Any]:
    """Process TRANSACTIONS webhook events"""
    
    webhook_code = webhook_data.get('webhook_code')
    item_id = webhook_data.get('item_id')
    
    if webhook_code == 'INITIAL_UPDATE':
        print(f"📊 Initial transaction sync for item {item_id}")
        return {"status": "acknowledged", "message": "Initial update received, manual sync recommended"}
    
    elif webhook_code == 'HISTORICAL_UPDATE':
        print(f"📈 Historical transaction update for item {item_id}")
        return {"status": "acknowledged", "message": "Historical update received"}
    
    elif webhook_code == 'DEFAULT_UPDATE':
        print(f"🔄 New transactions available for item {item_id}")
        new_count = webhook_data.get('new_transactions', 0)
        removed_ids = webhook_data.get('removed_transactions', [])
        
        # Trigger Next.js sync endpoint for this item
        sync_result = await trigger_nextjs_sync(item_id, supabase)
        
        return {
            "status": "processed" if sync_result["success"] else "error", 
            "message": f"New transactions: {new_count}, Removed: {len(removed_ids)}. Sync: {sync_result['message']}"
        }
    
    elif webhook_code == 'INITIAL_UPDATE':
        print(f"� Initial transaction sync for item {item_id}")
        
        # Trigger Next.js sync endpoint for initial sync
        sync_result = await trigger_nextjs_sync(item_id, supabase)
        
        return {
            "status": "processed" if sync_result["success"] else "error",
            "message": f"Initial update sync: {sync_result['message']}"
        }
    
    elif webhook_code == 'HISTORICAL_UPDATE':
        print(f"📈 Historical transaction update for item {item_id}")
        
        # Trigger Next.js sync endpoint for historical sync  
        sync_result = await trigger_nextjs_sync(item_id, supabase)
        
        return {
            "status": "processed" if sync_result["success"] else "error",
            "message": f"Historical update sync: {sync_result['message']}"
        }
    
    elif webhook_code == 'TRANSACTIONS_REMOVED':
        print(f"🗑️ Transactions removed for item {item_id}")
        removed_ids = webhook_data.get('removed_transactions', [])
        
        # Mark transactions as removed/deleted
        if removed_ids:
            try:
                for tx_id in removed_ids:
                    supabase.table("transactions").update({
                        "is_deleted": True,
                        "deleted_at": datetime.utcnow().isoformat()
                    }).eq("aggregator_transaction_id", tx_id).execute()
                
                return {"status": "processed", "message": f"Marked {len(removed_ids)} transactions as deleted"}
            except Exception as e:
                print(f"❌ Error removing transactions: {e}")
                return {"status": "error", "message": f"Failed to remove transactions: {str(e)}"}
    
    return {"status": "ignored", "message": f"Unhandled transaction webhook code: {webhook_code}"}

async def trigger_nextjs_sync(item_id: str, supabase) -> Dict[str, Any]:
    """Trigger Next.js sync endpoint for a Plaid item"""
    try:
        # Get account link for this item to get access token and user ID
        account_link_result = supabase.table("account_links").select(
            "access_token_encrypted, user_id, cursor"
        ).eq("item_id", item_id).eq("status", "active").execute()
        
        if not account_link_result.data:
            return {"success": False, "message": f"No active account link found for item {item_id}"}
        
        account_link = account_link_result.data[0]
        
        # Call Next.js sync endpoint
        sync_response = requests.post(
            "http://localhost:3000/api/aggregator/plaid/transactions/sync",
            headers={"Content-Type": "application/json"},
            json={
                "access_token": account_link["access_token_encrypted"],
                "cursor": account_link.get("cursor"),
                "user_id": account_link["user_id"],
                "count": 500
            },
            timeout=30
        )
        
        if sync_response.status_code == 200:
            result = sync_response.json()
            return {
                "success": True, 
                "message": f"Sync completed: {result.get('added', 0)} added, {result.get('modified', 0)} modified, {result.get('removed', 0)} removed"
            }
        else:
            return {
                "success": False, 
                "message": f"Sync failed with status {sync_response.status_code}: {sync_response.text}"
            }
    
    except Exception as e:
        print(f"❌ Error triggering Next.js sync: {e}")
        return {"success": False, "message": f"Sync error: {str(e)}"}

async def process_item_webhook(webhook_data: Dict[str, Any], supabase) -> Dict[str, Any]:
    """Process ITEM webhook events"""
    
    webhook_code = webhook_data.get('webhook_code')
    item_id = webhook_data.get('item_id')
    
    if webhook_code == 'ERROR':
        error_info = webhook_data.get('error', {})
        print(f"❌ Item error for {item_id}: {error_info}")
        
        # Update item status in account_links table
        try:
            supabase.table("account_links").update({
                "status": "error",
                "error_details": error_info,
                "last_error_at": datetime.utcnow().isoformat()
            }).eq("item_id", item_id).execute()
            
            return {"status": "processed", "message": "Item error recorded"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to update item status: {str(e)}"}
    
    elif webhook_code == 'PENDING_EXPIRATION':
        print(f"⚠️ Item pending expiration: {item_id}")
        
        # Update item status
        try:
            supabase.table("account_links").update({
                "status": "pending_expiration",
                "expires_at": datetime.utcnow().isoformat()  # Should calculate actual expiry
            }).eq("item_id", item_id).execute()
            
            return {"status": "processed", "message": "Item expiration warning recorded"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to update item status: {str(e)}"}
    
    return {"status": "ignored", "message": f"Unhandled item webhook code: {webhook_code}"}

@router.post(
    "/accounts/link",
    response_model=Dict[str, Any],
    summary="Link Plaid accounts",
    description="Link Plaid accounts to a user after successful Plaid Link flow"
)
def link_plaid_accounts(
    request: PlaidAccountLinkRequest,
    supabase=Depends(get_supabase_client)
):
    """
    Link Plaid accounts to a user after successful Plaid Link flow.
    
    This endpoint should be called after the user completes Plaid Link
    on the frontend to store the access token and account information.
    """
    try:
        # Create account link record
        account_link = {
            "user_id": request.user_id,
            "provider": "plaid",
            "item_id": request.item_id,
            "access_token_encrypted": request.access_token,  # TODO: Encrypt this!
            "institution_id": request.institution_id,
            "institution_name": request.institution_name,
            "status": "active",
            "linked_at": datetime.utcnow().isoformat(),
            "last_sync_at": None
        }
        
        # Insert account link
        link_result = supabase.table("account_links").insert(account_link).execute()
        account_link_id = link_result.data[0]["id"] if link_result.data else None
        
        if not account_link_id:
            raise HTTPException(status_code=500, detail="Failed to create account link")
        
        # Create account records
        created_accounts = []
        for plaid_account in request.accounts:
            account_record = {
                "user_id": request.user_id,
                "account_link_id": account_link_id,
                "aggregator_account_id": plaid_account.account_id,
                "provider": "plaid",
                "name": plaid_account.name,
                "official_name": plaid_account.official_name,
                "type": plaid_account.type,
                "subtype": plaid_account.subtype,
                "mask": plaid_account.mask,
                "balances": plaid_account.balances,
                "is_active": True,
                "created_at": datetime.utcnow().isoformat()
            }
            
            account_result = supabase.table("accounts").insert(account_record).execute()
            if account_result.data:
                created_accounts.append(account_result.data[0])
        
        return {
            "success": True,
            "account_link_id": account_link_id,
            "accounts_created": len(created_accounts),
            "accounts": created_accounts,
            "message": f"Successfully linked {len(created_accounts)} accounts"
        }
        
    except Exception as e:
        print(f"❌ Account linking error: {e}")
        raise HTTPException(status_code=500, detail=f"Account linking failed: {str(e)}")

@router.post(
    "/transactions/sync",
    response_model=PlaidSyncResponse,
    summary="Sync Plaid transactions",
    description="Manually sync transactions from Plaid for a user"
)
def sync_plaid_transactions(
    request: PlaidTransactionSyncRequest,
    supabase=Depends(get_supabase_client),
    data_cache=Depends(get_data_cache)
):
    """
    Manually sync transactions from Plaid for a user.
    
    This endpoint fetches transactions from Plaid API and processes them
    through the unified transaction processor.
    """
    try:
        # Get user's Plaid account links
        account_links = supabase.table("account_links").select(
            "*, accounts(*)"
        ).eq("user_id", request.user_id).eq("provider", "plaid").eq("status", "active").execute()
        
        if not account_links.data:
            raise HTTPException(status_code=404, detail="No active Plaid accounts found for user")
        
        processor = PlaidTransactionProcessor(data_cache)
        total_processed = 0
        total_added = 0
        total_updated = 0
        errors = []
        
        for account_link in account_links.data:
            try:
                # TODO: Implement actual Plaid API calls to fetch transactions
                # For now, this is a placeholder showing the structure
                
                print(f"🔄 Syncing transactions for item {account_link['item_id']}")
                
                # Mock Plaid transaction data (replace with actual Plaid API call)
                mock_plaid_transactions = [
                    {
                        "transaction_id": f"plaid_{uuid.uuid4()}",
                        "account_id": account_link['accounts'][0]['aggregator_account_id'] if account_link['accounts'] else "unknown",
                        "name": "STARBUCKS STORE #12345",
                        "merchant_name": "Starbucks",
                        "category": ["Food and Drink", "Restaurants", "Coffee Shop"],
                        "amount": -4.75,
                        "date": "2024-01-15",
                        "description": "STARBUCKS STORE #12345"
                    }
                ]
                
                # Process each transaction through unified processor
                for plaid_tx in mock_plaid_transactions:
                    try:
                        # Add metadata
                        plaid_tx['user_id'] = request.user_id
                        plaid_tx['account_id'] = account_link['accounts'][0]['id'] if account_link['accounts'] else None
                        
                        # Process transaction
                        processed_tx = processor.process_transaction(
                            transaction_data=plaid_tx,
                            source=TransactionSource.PLAID
                        )
                        
                        # Check if transaction already exists
                        existing = supabase.table("transactions").select("id").eq(
                            "aggregator_transaction_id", plaid_tx['transaction_id']
                        ).eq("user_id", request.user_id).execute()
                        
                        if existing.data:
                            # Update existing transaction
                            supabase.table("transactions").update({
                                "merchant_id": processed_tx.get('merchant_id'),
                                "category_id": processed_tx.get('category_id'),
                                "clean_description": processed_tx.get('clean_description'),
                                "needs_review": processed_tx.get('needs_review'),
                                "confidence": processed_tx.get('confidence'),
                                "match_method": processed_tx.get('match_method'),
                                "updated_at": datetime.utcnow().isoformat()
                            }).eq("id", existing.data[0]["id"]).execute()
                            total_updated += 1
                        else:
                            # Insert new transaction
                            transaction_record = {
                                "user_id": request.user_id,
                                "account_id": processed_tx.get('account_id'),
                                "aggregator_transaction_id": plaid_tx['transaction_id'],
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
                        
                        total_processed += 1
                        
                    except Exception as tx_error:
                        errors.append({
                            "transaction_id": plaid_tx.get('transaction_id'),
                            "error": str(tx_error)
                        })
                        print(f"❌ Transaction processing error: {tx_error}")
                
            except Exception as account_error:
                errors.append({
                    "account_link_id": account_link['id'],
                    "error": str(account_error)
                })
                print(f"❌ Account sync error: {account_error}")
        
        # Update last sync time
        supabase.table("account_links").update({
            "last_sync_at": datetime.utcnow().isoformat()
        }).eq("user_id", request.user_id).execute()
        
        return PlaidSyncResponse(
            success=len(errors) == 0,
            transactions_processed=total_processed,
            transactions_added=total_added,
            transactions_updated=total_updated,
            errors=errors,
            message=f"Processed {total_processed} transactions ({total_added} new, {total_updated} updated)"
        )
        
    except Exception as e:
        print(f"❌ Sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Transaction sync failed: {str(e)}")

@router.get(
    "/accounts",
    summary="Get user's Plaid accounts",
    description="Retrieve all Plaid accounts linked to a user"
)
def get_user_plaid_accounts(
    user_id: str,
    supabase=Depends(get_supabase_client)
):
    """Get all Plaid accounts for a user"""
    try:
        account_links = supabase.table("account_links").select(
            "*, accounts(*)"
        ).eq("user_id", user_id).eq("provider", "plaid").execute()
        
        return {
            "user_id": user_id,
            "account_links": account_links.data,
            "total_accounts": sum(len(link.get('accounts', [])) for link in account_links.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get accounts: {str(e)}")

@router.delete(
    "/accounts/{account_link_id}",
    summary="Unlink Plaid account",
    description="Remove a Plaid account link and mark associated accounts as inactive"
)
def unlink_plaid_account(
    account_link_id: str,
    user_id: str,
    supabase=Depends(get_supabase_client)
):
    """Unlink a Plaid account"""
    try:
        # Verify ownership
        account_link = supabase.table("account_links").select("id").eq(
            "id", account_link_id
        ).eq("user_id", user_id).execute()
        
        if not account_link.data:
            raise HTTPException(status_code=404, detail="Account link not found")
        
        # Mark account link as inactive
        supabase.table("account_links").update({
            "status": "inactive",
            "unlinked_at": datetime.utcnow().isoformat()
        }).eq("id", account_link_id).execute()
        
        # Mark associated accounts as inactive
        supabase.table("accounts").update({
            "is_active": False
        }).eq("account_link_id", account_link_id).execute()
        
        return {"success": True, "message": "Account successfully unlinked"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to unlink account: {str(e)}")

@router.get(
    "/status",
    summary="Plaid integration status",
    description="Get status of Plaid integration and connected accounts"
)
def plaid_status(
    user_id: Optional[str] = None,
    supabase=Depends(get_supabase_client)
):
    """Get Plaid integration status"""
    try:
        status = {
            "plaid_enabled": True,
            "webhook_endpoint": "/plaid/webhook",
            "supported_countries": ["US", "CA"],
            "supported_products": ["transactions", "accounts", "identity"]
        }
        
        if user_id:
            # Get user-specific status
            account_links = supabase.table("account_links").select(
                "status, institution_name, last_sync_at"
            ).eq("user_id", user_id).eq("provider", "plaid").execute()
            
            status["user_accounts"] = account_links.data
            status["total_linked_accounts"] = len(account_links.data)
            status["active_accounts"] = len([link for link in account_links.data if link.get('status') == 'active'])
        
        return status
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")
