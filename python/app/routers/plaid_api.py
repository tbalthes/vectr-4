from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Any
import os
import requests

# Import dependencies
from ..dependencies import get_supabase_client

router = APIRouter(
    prefix="/plaid",
    tags=["plaid"],
)

@router.post(
    "/webhook",
    summary="Plaid webhook endpoint",
    description="Receives and processes Plaid webhooks for real-time transaction updates"
)
async def plaid_webhook(request: Request, supabase=Depends(get_supabase_client)):
    """
    Plaid webhook handler that processes transactions by calling the Next.js sync endpoint.
    """
    try:
        data = await request.json()
        webhook_type = data.get("webhook_type")
        webhook_code = data.get("webhook_code")
        item_id = data.get("item_id")

        if webhook_type != "TRANSACTIONS":
            return {"status": "acknowledged", "message": f"Ignoring {webhook_type} webhook"}

        # Find user and access token for this item_id
        account_link_resp = supabase.table("account_links").select(
            "user_id, access_token_encrypted"
        ).eq("item_id", item_id).single().execute()

        if not account_link_resp.data:
            raise HTTPException(status_code=404, detail=f"No account link found for item_id: {item_id}")

        user_id = account_link_resp.data['user_id']
        access_token = account_link_resp.data['access_token_encrypted']

        # Call the Next.js sync endpoint to get the actual transactions
        sync_url = os.getenv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000") + "/api/aggregator/plaid/transactions/sync"
        
        sync_payload = {
            "user_id": user_id,
            "access_token": access_token,
            "cursor": None,  # Start fresh for webhook-triggered syncs
        }
        
        service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {service_key}",
            "x-user-id": str(user_id)
        }
        
        response = requests.post(sync_url, json=sync_payload, headers=headers, timeout=30)
        response.raise_for_status()  # Raise an exception for bad status codes

        sync_result = response.json()
        return {
            "status": "processed",
            "message": f"Successfully synced transactions for {webhook_code}",
            "sync_result": {
                "added": sync_result.get("added", 0),
                "modified": sync_result.get("modified", 0),
                "removed": sync_result.get("removed", 0)
            }
        }
        
    except Exception as e:
        # Log the error for debugging
        print(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process webhook: {str(e)}")
