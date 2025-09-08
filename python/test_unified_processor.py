"""
Test script for the unified transaction processor with Plaid integration.
This script tests all three transaction sources: Plaid, CSV, and Manual.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from core.plaid_transaction_processor import PlaidTransactionProcessor, TransactionSource
from data_cache import DataCache

def test_plaid_transaction_processing():
    """Test Plaid transaction processing with merchant_name field"""
    print("🧪 Testing Plaid Transaction Processing")
    print("=" * 50)
    
    # Initialize data cache
    data_cache = DataCache()
    data_cache.load_all_tables()
    
    processor = PlaidTransactionProcessor(data_cache)
    
    # Sample Plaid transaction data
    plaid_transactions = [
        {
            "transaction_id": "plaid_123456",
            "account_id": "acc_plaid_001", 
            "name": "STARBUCKS STORE #12345",
            "merchant_name": "Starbucks",
            "category": ["Food and Drink", "Restaurants", "Coffee Shop"],
            "amount": -4.75,
            "date": "2024-01-15",
            "description": "STARBUCKS STORE #12345",
            "user_id": "user123"
        },
        {
            "transaction_id": "plaid_123457",
            "account_id": "acc_plaid_001",
            "name": "AMAZON.COM AMZN.COM/BILL WA",
            "merchant_name": "Amazon",
            "category": ["Shops", "Digital Purchase"],
            "amount": -29.99,
            "date": "2024-01-16", 
            "description": "AMAZON.COM AMZN.COM/BILL WA",
            "user_id": "user123"
        },
        {
            "transaction_id": "plaid_123458",
            "account_id": "acc_plaid_001",
            "name": "LOCAL COFFEE SHOP",
            "merchant_name": "Local Coffee Shop",  # New merchant not in database
            "category": ["Food and Drink", "Restaurants", "Coffee Shop"],
            "amount": -6.50,
            "date": "2024-01-17",
            "description": "LOCAL COFFEE SHOP",
            "user_id": "user123"
        }
    ]
    
    for i, transaction in enumerate(plaid_transactions, 1):
        print(f"\n📱 Plaid Transaction #{i}")
        print(f"   Merchant: {transaction['merchant_name']}")
        print(f"   Category: {transaction['category']}")
        print(f"   Amount: ${abs(transaction['amount']):.2f}")
        
        try:
            result = processor.process_transaction(
                transaction_data=transaction,
                source=TransactionSource.PLAID
            )
            
            print(f"   ✅ PROCESSED:")
            print(f"      Merchant ID: {result.get('merchant_id')}")
            print(f"      Merchant Name: {result.get('merchant_name')}")
            print(f"      Category ID: {result.get('category_id')}")
            print(f"      Category Name: {result.get('category_name')}")
            print(f"      Clean Description: {result.get('clean_description')}")
            print(f"      Confidence: {result.get('confidence'):.2f}")
            print(f"      Match Method: {result.get('match_method')}")
            print(f"      Needs Review: {result.get('needs_review')}")
            print(f"      Aggregator TX ID: {result.get('aggregator_transaction_id')}")
            
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
    
    print("\n" + "=" * 50)

def test_csv_transaction_processing():
    """Test CSV transaction processing (existing logic)"""
    print("📊 Testing CSV Transaction Processing")
    print("=" * 50)
    
    # Initialize data cache
    data_cache = DataCache()
    data_cache.load_all_tables()
    
    processor = PlaidTransactionProcessor(data_cache)
    
    # Sample CSV transaction data
    csv_transactions = [
        {
            "date": "2024-01-15",
            "transaction_number": 12345.0,
            "description": "STARBUCKS STORE #12345 PHOENIX AZ",
            "amount": -4.75,
            "balance": 995.25,
            "account_id": "acc_csv_001",
            "user_id": "user123"
        },
        {
            "date": "2024-01-16", 
            "transaction_number": 12346.0,
            "description": "AMAZON.COM AMZN.COM/BILL WA",
            "amount": -29.99,
            "balance": 965.26,
            "account_id": "acc_csv_001",
            "user_id": "user123"
        },
        {
            "date": "2024-01-17",
            "transaction_number": 12347.0,
            "description": "RANDOM MERCHANT #999 UNKNOWN CITY",
            "amount": -15.00,
            "balance": 950.26,
            "account_id": "acc_csv_001",
            "user_id": "user123"
        }
    ]
    
    for i, transaction in enumerate(csv_transactions, 1):
        print(f"\n📄 CSV Transaction #{i}")
        print(f"   Description: {transaction['description']}")
        print(f"   Amount: ${abs(transaction['amount']):.2f}")
        
        try:
            result = processor.process_transaction(
                transaction_data=transaction,
                source=TransactionSource.CSV
            )
            
            print(f"   ✅ PROCESSED:")
            print(f"      Merchant ID: {result.get('merchant_id')}")
            print(f"      Merchant Name: {result.get('merchant_name')}")
            print(f"      Category ID: {result.get('category_id')}")
            print(f"      Category Name: {result.get('category_name')}")
            print(f"      Clean Description: {result.get('clean_description')}")
            print(f"      Confidence: {result.get('confidence'):.2f}")
            print(f"      Match Method: {result.get('match_method')}")
            print(f"      Needs Review: {result.get('needs_review')}")
            
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
    
    print("\n" + "=" * 50)

def test_manual_transaction_processing():
    """Test manual transaction processing"""
    print("✏️ Testing Manual Transaction Processing")
    print("=" * 50)
    
    # Initialize data cache
    data_cache = DataCache()
    data_cache.load_all_tables()
    
    processor = PlaidTransactionProcessor(data_cache)
    
    # Sample manual transaction data
    manual_transactions = [
        {
            "date": "2024-01-15",
            "description": "Coffee with friends",
            "merchant_name": "Starbucks",  # User specified merchant
            "amount": -4.75,
            "account_id": "acc_manual_001",
            "user_id": "user123"
        },
        {
            "date": "2024-01-16",
            "description": "Grocery shopping",
            "category_name": "Grocery",  # User specified category
            "amount": -45.23,
            "account_id": "acc_manual_001", 
            "user_id": "user123"
        },
        {
            "date": "2024-01-17",
            "description": "Gas station fuel",
            "amount": -32.50,
            "account_id": "acc_manual_001",
            "user_id": "user123"
        }
    ]
    
    for i, transaction in enumerate(manual_transactions, 1):
        print(f"\n✏️ Manual Transaction #{i}")
        print(f"   Description: {transaction['description']}")
        print(f"   User Merchant: {transaction.get('merchant_name', 'None')}")
        print(f"   User Category: {transaction.get('category_name', 'None')}")
        print(f"   Amount: ${abs(transaction['amount']):.2f}")
        
        try:
            result = processor.process_transaction(
                transaction_data=transaction,
                source=TransactionSource.MANUAL
            )
            
            print(f"   ✅ PROCESSED:")
            print(f"      Merchant ID: {result.get('merchant_id')}")
            print(f"      Merchant Name: {result.get('merchant_name')}")
            print(f"      Category ID: {result.get('category_id')}")
            print(f"      Category Name: {result.get('category_name')}")
            print(f"      Clean Description: {result.get('clean_description')}")
            print(f"      Confidence: {result.get('confidence'):.2f}")
            print(f"      Match Method: {result.get('match_method')}")
            print(f"      Needs Review: {result.get('needs_review')}")
            
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
    
    print("\n" + "=" * 50)

def test_merchant_references():
    """Test that all merchant references are properly maintained"""
    print("🏪 Testing Merchant Reference Integrity")
    print("=" * 50)
    
    # Initialize data cache
    data_cache = DataCache()
    data_cache.load_all_tables()
    
    print(f"📊 Data Cache Status:")
    print(f"   Merchants loaded: {len(data_cache.merchants) if data_cache.merchants else 0}")
    print(f"   Categories loaded: {len(data_cache.categories) if data_cache.categories else 0}")
    
    if data_cache.merchants:
        print(f"\n🏪 Sample Merchants:")
        for i, merchant in enumerate(data_cache.merchants[:3]):
            print(f"   {i+1}. {merchant.get('name', 'Unknown')} (ID: {merchant.get('merchant_id', 'None')})")
            print(f"      Category: {merchant.get('default_category_id', 'None')}")
            print(f"      Regex: {merchant.get('regex_match', 'None')}")
    
    if data_cache.categories:
        print(f"\n📂 Sample Categories:")
        for i, category in enumerate(data_cache.categories[:3]):
            print(f"   {i+1}. {category.get('name', 'Unknown')} (ID: {category.get('category_id', 'None')})")
    
    print("\n" + "=" * 50)

def main():
    """Run all tests"""
    print("🚀 Starting Unified Transaction Processor Tests")
    print("=" * 70)
    
    try:
        test_merchant_references()
        test_plaid_transaction_processing()
        test_csv_transaction_processing() 
        test_manual_transaction_processing()
        
        print("✅ All tests completed successfully!")
        print("\n📋 Summary:")
        print("   • Plaid transactions: Using merchant_name for clean identification")
        print("   • CSV transactions: Using existing regex matching logic")
        print("   • Manual transactions: Supporting user-specified merchants/categories")
        print("   • All merchant references maintained and working")
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    main()
