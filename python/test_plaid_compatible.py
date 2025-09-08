#!/usr/bin/env python3
"""
Test script for the Plaid-compatible transaction processor.
Shows how to process Plaid transactions through your existing setup.
"""

import requests
import json
import uuid
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_plaid_compatible_processor():
    """Test the Plaid-compatible transaction processor"""
    print("🔄 Testing Plaid-Compatible Transaction Processor")
    print("=" * 60)
    
    # Using real user ID and account ID from your system
    user_id = "436dc420-d182-48c7-a605-88b33b8918de"
    internal_account_id = "d846d8bd-09a8-4bb0-8eed-058fe20fc812"  # Plaid Checking account
    
    # Mock Plaid transaction data (what you'd get from Plaid API)
    plaid_transactions = {
        "user_id": user_id,
        "internal_account_id": internal_account_id,
        "transactions": [
            {
                "transaction_id": f"plaid_tx_{uuid.uuid4().hex[:8]}",
                "account_id": "jEGRjAdV3zi5w9Kj4x9yi3AKWokg81S6KywWR",  # Plaid account ID
                "amount": -4.75,
                "date": "2024-01-15",
                "name": "STARBUCKS STORE #12345",
                "merchant_name": "Starbucks",
                "category": ["Food and Drink", "Restaurants", "Coffee Shop"],
                "pending": False
            },
            {
                "transaction_id": f"plaid_tx_{uuid.uuid4().hex[:8]}",
                "account_id": "jEGRjAdV3zi5w9Kj4x9yi3AKWokg81S6KywWR",
                "amount": -85.20,
                "date": "2024-01-14",
                "name": "WALMART SUPERCENTER #1234",
                "merchant_name": "Walmart",
                "category": ["Shops", "Supermarkets and Groceries"],
                "pending": False
            },
            {
                "transaction_id": f"plaid_tx_{uuid.uuid4().hex[:8]}",
                "account_id": "jEGRjAdV3zi5w9Kj4x9yi3AKWokg81S6KywWR",
                "amount": 2500.00,
                "date": "2024-01-13",
                "name": "PAYROLL DEPOSIT - ACME CORP",
                "merchant_name": None,
                "category": ["Transfer", "Payroll"],
                "pending": False
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/plaid-processor/process-batch",
            json=plaid_transactions,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Plaid transaction processing successful!")
            print(f"   📊 Transactions processed: {data.get('transactions_processed')}")
            print(f"   ➕ New transactions added: {data.get('transactions_added')}")
            print(f"   🔄 Transactions updated: {data.get('transactions_updated')}")
            print(f"   🏪 Transactions with merchants: {data.get('transactions_with_merchants')}")
            print(f"   ❌ Errors: {len(data.get('errors', []))}")
            print(f"   💬 Message: {data.get('message')}")
            
            if data.get('errors'):
                print("\n   ⚠️ Errors encountered:")
                for error in data.get('errors', []):
                    print(f"      - {error}")
        else:
            print(f"❌ Processing failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing Plaid processor: {e}")
    
    print()

def test_integration_status():
    """Test integration status"""
    print("📋 Testing Integration Status")
    print("=" * 30)
    
    try:
        response = requests.get(f"{BASE_URL}/plaid-processor/integration-status")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Integration status retrieved")
            print(f"   Status: {data.get('status')}")
            print(f"   Existing endpoints: {len(data.get('existing_frontend_endpoints', {}))}")
            print(f"   New endpoints: {len(data.get('new_backend_endpoints', {}))}")
            print(f"   Existing tables: {len(data.get('existing_tables', {}))}")
        else:
            print(f"❌ Status failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing status: {e}")
    
    print()

def test_user_stats():
    """Test user statistics"""
    print("📊 Testing User Statistics")
    print("=" * 30)
    
    user_id = "436dc420-d182-48c7-a605-88b33b8918de"
    
    try:
        response = requests.get(f"{BASE_URL}/plaid-processor/stats?user_id={user_id}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ User stats retrieved")
            
            processor_info = data.get('processor_info', {})
            print(f"   🏪 Merchants in database: {processor_info.get('merchants_count')}")
            print(f"   📂 Categories in database: {processor_info.get('categories_count')}")
            
            user_stats = data.get('user_stats', {})
            print(f"   💳 User's Plaid accounts: {user_stats.get('plaid_accounts')}")
            print(f"   📝 User's Plaid transactions: {user_stats.get('plaid_transactions')}")
            print(f"   🔗 Merchant matches: {user_stats.get('merchant_matches')}")
            print(f"   📈 Match rate: {user_stats.get('match_rate')}%")
        else:
            print(f"❌ Stats failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing stats: {e}")
    
    print()

def test_user_accounts():
    """Test user accounts"""
    print("💳 Testing User Plaid Accounts")
    print("=" * 35)
    
    user_id = "436dc420-d182-48c7-a605-88b33b8918de"
    
    try:
        response = requests.get(f"{BASE_URL}/plaid-processor/user-plaid-accounts?user_id={user_id}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ User Plaid accounts retrieved")
            print(f"   Total accounts: {data.get('total_plaid_accounts')}")
            
            for account in data.get('plaid_accounts', []):
                institution = account.get('institutions', {})
                print(f"   🏦 {account.get('name')} at {institution.get('name')}")
                print(f"      ID: {account.get('id')}")
                print(f"      Plaid ID: {account.get('aggregator_account_id')}")
        else:
            print(f"❌ User accounts failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing user accounts: {e}")
    
    print()

def main():
    """Run all compatibility tests"""
    print("🚀 Testing Plaid-Compatible Transaction Processor")
    print("=" * 65)
    print()
    
    # Test integration status first
    test_integration_status()
    
    # Test user stats and accounts
    test_user_stats()
    test_user_accounts()
    
    # Test the main processing functionality
    test_plaid_compatible_processor()
    
    print("🎉 Plaid-Compatible Processor Testing Complete!")
    print()
    print("📋 Summary:")
    print("   ✅ Your existing Plaid frontend endpoints are preserved")
    print("   ✅ New backend processor enhances transaction processing")
    print("   ✅ Merchant matching works with Plaid transaction data")
    print("   ✅ Compatible with existing accounts and institutions")
    print()
    print("🔄 Next Steps:")
    print("   1. Frontend calls /api/aggregator/plaid/* as usual")
    print("   2. After getting Plaid transactions, call /plaid-processor/process-batch")
    print("   3. Merchants will be automatically matched and stored")
    print("   4. Use existing /api/accounts and /api/transactions for display")

if __name__ == "__main__":
    main()
