from fastapi import APIRouter, Depends, HTTPException, Request, Body, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import uuid
import json
import requests
import os
from datetime import datetime, date

# Import dependencies
from ..dependencies import get_supabase_client
from core.plaid_transaction_processor import PlaidTransactionProcessor, TransactionSource

router = APIRouter(
    prefix="/plaid",
    tags=["plaid"],
)

@router.post(
    "/webhook",
    summary="Plaid webhook endpoint",
    description="Receives and processes Plaid webhooks for real-time transaction updates"
)
async def plaid_webhook(request: Request):
    """Plaid webhook handler that processes transactions through clean processor."""
    try:
        print("🔗 Webhook received - parsing JSON...")
        data = await request.json()
        webhook_type = data.get("webhook_type")
        webhook_code = data.get("webhook_code") 
        item_id = data.get("item_id")
        
        print(f"✅ Webhook parsed: {webhook_type}.{webhook_code} for item {item_id}")
        
        # Only process transaction webhooks
        if webhook_type != "TRANSACTIONS":
            print(f"⏭️ Ignoring {webhook_type} webhook")
            return {"status": "acknowledged", "message": f"Ignored {webhook_type} webhook"}
        
        print("🔌 Creating Supabase client...")
        # Create Supabase client directly (avoid dependency injection for webhooks)
        try:
            from supabase_client.client import get_supabase_client
            supabase = get_supabase_client()
            print("✅ Supabase client created")
        except Exception as client_error:
            print(f"❌ Failed to create Supabase client: {client_error}")
            return {"status": "error", "message": f"Database client failed: {str(client_error)}"}
        
        print(f"🔍 Looking up active account link for item_id: {item_id}")
        # Find user and access token for this item_id, only if status is 'active'
        account_link = supabase.table("account_links").select(
            "user_id, access_token_encrypted"
        ).eq("item_id", item_id).eq("status", "active").execute()

        if not account_link.data:
            # Optionally, check if any link exists for this item_id (but not active)
            inactive_link = supabase.table("account_links").select("id, status").eq("item_id", item_id).execute()
            if inactive_link.data:
                print(f"⚠️ Account link(s) found for item_id {item_id} but not active: {[l['status'] for l in inactive_link.data]}")
            else:
                print(f"❌ No account link found for item_id: {item_id}")
            return {"status": "error", "message": f"No active account link found for item_id: {item_id}"}

        user_id = account_link.data[0]['user_id']
        access_token = account_link.data[0]['access_token_encrypted']

        print(f"✅ Found active user {user_id} for {webhook_code}")
        
        # Call the Next.js sync endpoint to get the actual transactions
        print("📡 Calling Next.js sync endpoint...")
        import requests
        sync_url = "http://localhost:3000/api/aggregator/plaid/transactions/sync"
        
        sync_payload = {
            "user_id": user_id,
            "access_token": access_token,
            "cursor": None,  # Start fresh for webhook-triggered syncs
            "count": 500
        }
        
        # Get the Supabase service role key from environment
        import os
        service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        # Add service authentication headers
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {service_key}",
            "x-user-id": user_id
        }
        
        print(f"Calling sync endpoint for user {user_id}")
        response = requests.post(sync_url, json=sync_payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            sync_result = response.json()
            return {
                "status": "processed",
                "message": f"Successfully synced transactions for {webhook_code}",
                "sync_result": {
                    "transactions_added": sync_result.get("added", 0),
                    "transactions_modified": sync_result.get("modified", 0),
                    "transactions_removed": sync_result.get("removed", 0)
                }
            }
        else:
            print(f"Sync endpoint failed: {response.status_code} - {response.text}")
            return {"status": "error", "message": f"Sync failed: {response.text}"}
        
    except Exception as e:
        print(f"❌ Error processing webhook: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Failed to process webhook: {str(e)}"}


@router.post(
    "/test",
    summary="Test endpoint", 
    description="Test POST endpoint"
)
async def test_endpoint(request: Request):
    """Test POST endpoint."""
    try:
        data = await request.json()
        return {"received": True, "status": "ok", "echo": data}
    except Exception as e:
        return {"error": str(e)}
