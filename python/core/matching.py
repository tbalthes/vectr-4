import re
from typing import Dict, Any, Optional

def match_merchant_by_regex(transaction_description: str, merchants: list) -> Optional[Dict[str, Any]]:
    """
    Matches transaction description against merchants using their regex_match patterns.
    
    Args:
        transaction_description: The transaction description to match
        merchants: List of merchant dictionaries with regex_match patterns
        
    Returns:
        Dict with merchant info and category if matched, None otherwise
    """
    if not transaction_description or not merchants:
        return None
        
    for merchant in merchants:
        regex_pattern = merchant.get('regex_match')
        if not regex_pattern:
            continue
            
        try:
            # Perform case-insensitive regex matching
            if re.search(regex_pattern, transaction_description, re.IGNORECASE):
                # Update match tracking
                # This could be async updated in background, for now just return match
                return {
                    "merchant_id": merchant.get('merchant_id'),
                    "merchant_name": merchant.get('name'),
                    "category_id": merchant.get('default_category_id'),
                    "logo_url": merchant.get('logo_url'),
                    "confidence": 1.0,
                    "match_method": "merchant_regex"
                }
        except re.error as e:
            # Skip invalid regex patterns and log error
            print(f"Invalid regex pattern in merchant {merchant.get('name', 'Unknown')}: {regex_pattern} - {e}")
            continue
            
    return None

def categorize_transaction(transaction_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main categorization function that processes a transaction using the new Plaid system.
    
    Args:
        transaction_data: Transaction data dictionary
        
    Returns:
        Categorized transaction with merchant and category information
    """
    try:
        print(f"DEBUG: Starting categorization for transaction: {transaction_data.get('description', 'No description')}")
        
        # Import here to avoid circular imports
        from .transaction_processor import process_transaction
        
        # Get cached data using singleton pattern
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
        from data_cache import DataCache
        
        data_cache = DataCache()
        data_cache.load_all_tables()  # Ensure data is loaded
        
        print(f"DEBUG: Data cache loaded. Merchants: {len(data_cache.merchants)}, Categories: {len(data_cache.categories)}")
        
        # Process the transaction using updated logic
        result = process_transaction(transaction_data, data_cache)
        
        print(f"DEBUG: Process transaction result: {result}")
        
        if result is None:
            print("ERROR: process_transaction returned None, creating default response")
            result = {
                "merchant_id": None,
                "merchant_name": None,
                "category_id": None,
                "category_name": None,
                "confidence": 0.0,
                "match_method": "error",
                "clean_description": transaction_data.get('description', 'Unknown'),
                "needs_review": True,
                "original_description": transaction_data.get('description'),
                "user_metadata": None
            }
        
        return result
        
    except Exception as e:
        print(f"ERROR in categorize_transaction: {e}")
        import traceback
        print(f"TRACEBACK: {traceback.format_exc()}")
        # Return a default response structure to match CategorizeResponse
        return {
            "merchant_id": None,
            "merchant_name": None,
            "category_id": None,
            "category_name": None,
            "confidence": 0.0,
            "match_method": "error",
            "clean_description": transaction_data.get('description', 'Unknown'),
            "needs_review": True,
            "original_description": transaction_data.get('description'),
            "user_metadata": None
        }