#!/usr/bin/env python3
"""
Test script for Plaid API endpoints.
Tests account linking, webhook processing, and transaction syncing.
"""

import requests
import json
import uuid
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_plaid_status():
    """Test Plaid status endpoint"""
    print("🔍 Testing Plaid Status Endpoint")
    print("=" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/plaid/status")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Status endpoint working")
            print(f"   Plaid enabled: {data.get('plaid_enabled')}")
            print(f"   Webhook endpoint: {data.get('webhook_endpoint')}")
            print(f"   Supported countries: {data.get('supported_countries')}")
            print(f"   Supported products: {data.get('supported_products')}")
        else:
            print(f"❌ Status endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing status: {e}")
    
    print()

def test_account_linking():
    """Test Plaid account linking"""
    print("🔗 Testing Account Linking")
    print("=" * 50)
    
    # Mock account linking request
    link_request = {
        "user_id": "436dc420-d182-48c7-a605-88b33b8918de",  # Use real user ID from your system
        "item_id": f"test_item_{uuid.uuid4().hex[:8]}",
        "access_token": f"access-sandbox-{uuid.uuid4().hex}",
        "institution_id": "ins_109508",  # Chase Bank sandbox ID
        "institution_name": "Chase Bank",
        "accounts": [
            {
                "account_id": f"acc_{uuid.uuid4().hex[:8]}",
                "balances": {
                    "available": 1000.50,
                    "current": 1200.75,
                    "limit": None,
                    "iso_currency_code": "USD"
                },
                "mask": "0000",
                "name": "Plaid Checking",
                "official_name": "Plaid Gold Standard 0% Interest Checking",
                "type": "depository",
                "subtype": "checking"
            },
            {
                "account_id": f"acc_{uuid.uuid4().hex[:8]}",
                "balances": {
                    "available": 5000.00,
                    "current": 5000.00,
                    "limit": None,
                    "iso_currency_code": "USD"
                },
                "mask": "1111",
                "name": "Plaid Saving",
                "official_name": "Plaid Silver Standard 0.1% Interest Saving",
                "type": "depository",
                "subtype": "savings"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/plaid/accounts/link",
            json=link_request,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Account linking successful")
            print(f"   Account link ID: {data.get('account_link_id')}")
            print(f"   Accounts created: {data.get('accounts_created')}")
            print(f"   Message: {data.get('message')}")
            return data.get('account_link_id')
        else:
            print(f"❌ Account linking failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error testing account linking: {e}")
        return None
    
    print()

def test_webhook_processing():
    """Test Plaid webhook processing"""
    print("📥 Testing Webhook Processing")
    print("=" * 50)
    
    # Mock webhook payloads
    webhooks = [
        {
            "name": "TRANSACTIONS.DEFAULT_UPDATE",
            "payload": {
                "webhook_type": "TRANSACTIONS",
                "webhook_code": "DEFAULT_UPDATE",
                "item_id": "test_item_12345678",
                "new_transactions": 3,
                "removed_transactions": []
            }
        },
        {
            "name": "TRANSACTIONS.TRANSACTIONS_REMOVED",
            "payload": {
                "webhook_type": "TRANSACTIONS", 
                "webhook_code": "TRANSACTIONS_REMOVED",
                "item_id": "test_item_12345678",
                "removed_transactions": ["tx_12345", "tx_67890"]
            }
        },
        {
            "name": "ITEM.ERROR",
            "payload": {
                "webhook_type": "ITEM",
                "webhook_code": "ERROR",
                "item_id": "test_item_12345678",
                "error": {
                    "error_type": "ITEM_ERROR",
                    "error_code": "INVALID_CREDENTIALS",
                    "display_message": "The provided credentials are no longer valid."
                }
            }
        }
    ]
    
    for webhook in webhooks:
        try:
            print(f"🔄 Testing {webhook['name']} webhook...")
            
            response = requests.post(
                f"{BASE_URL}/plaid/webhook",
                json=webhook['payload'],
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ {webhook['name']}: {data.get('status')} - {data.get('message')}")
            else:
                print(f"   ❌ {webhook['name']}: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"   ❌ Error testing {webhook['name']}: {e}")
    
    print()

def test_transaction_sync():
    """Test Plaid transaction sync"""
    print("🔄 Testing Transaction Sync")
    print("=" * 50)
    
    sync_request = {
        "user_id": "436dc420-d182-48c7-a605-88b33b8918de",  # Use real user ID
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/plaid/transactions/sync",
            json=sync_request,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Transaction sync completed")
            print(f"   Success: {data.get('success')}")
            print(f"   Processed: {data.get('transactions_processed')}")
            print(f"   Added: {data.get('transactions_added')}")
            print(f"   Updated: {data.get('transactions_updated')}")
            print(f"   Errors: {len(data.get('errors', []))}")
            print(f"   Message: {data.get('message')}")
        else:
            print(f"❌ Transaction sync failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing transaction sync: {e}")
    
    print()

def test_get_user_accounts():
    """Test getting user's Plaid accounts"""
    print("📊 Testing Get User Accounts")
    print("=" * 50)
    
    user_id = "436dc420-d182-48c7-a605-88b33b8918de"
    
    try:
        response = requests.get(f"{BASE_URL}/plaid/accounts?user_id={user_id}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ User accounts retrieved")
            print(f"   User ID: {data.get('user_id')}")
            print(f"   Account links: {len(data.get('account_links', []))}")
            print(f"   Total accounts: {data.get('total_accounts')}")
            
            for link in data.get('account_links', []):
                print(f"   📁 {link.get('institution_name')} - {link.get('status')}")
                for account in link.get('accounts', []):
                    print(f"      💳 {account.get('name')} ({account.get('type')})")
        else:
            print(f"❌ Get user accounts failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing get user accounts: {e}")
    
    print()

def test_plaid_status_with_user():
    """Test Plaid status with user-specific info"""
    print("👤 Testing Plaid Status (User-Specific)")
    print("=" * 50)
    
    user_id = "436dc420-d182-48c7-a605-88b33b8918de"
    
    try:
        response = requests.get(f"{BASE_URL}/plaid/status?user_id={user_id}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ User-specific status retrieved")
            print(f"   Plaid enabled: {data.get('plaid_enabled')}")
            print(f"   Total linked accounts: {data.get('total_linked_accounts')}")
            print(f"   Active accounts: {data.get('active_accounts')}")
            
            for account in data.get('user_accounts', []):
                print(f"   🏦 {account.get('institution_name')} - {account.get('status')}")
                if account.get('last_sync_at'):
                    print(f"      Last sync: {account.get('last_sync_at')}")
        else:
            print(f"❌ User status failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing user status: {e}")
    
    print()

def main():
    """Run all Plaid API tests"""
    print("🚀 Starting Plaid API Tests")
    print("=" * 70)
    print()
    
    # Test basic status
    test_plaid_status()
    
    # Test account linking (this will create test data)
    account_link_id = test_account_linking()
    
    # Test webhook processing
    test_webhook_processing()
    
    # Test transaction sync
    test_transaction_sync()
    
    # Test getting user accounts
    test_get_user_accounts()
    
    # Test user-specific status
    test_plaid_status_with_user()
    
    print("🎉 Plaid API testing complete!")
    print()
    print("📋 Next Steps:")
    print("   1. Set up actual Plaid credentials in .env")
    print("   2. Implement real Plaid API calls in sync endpoint")
    print("   3. Add Plaid Link component to frontend")
    print("   4. Set up webhook URL with Plaid dashboard")
    print("   5. Test with real Plaid sandbox accounts")

if __name__ == "__main__":
    main()
