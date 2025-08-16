# In python/core/transaction_processor.py

import re
from typing import Dict, Any, List, Optional
# Note: Using Any for supabase client type to avoid import conflicts with local supabase module

# --- Helper Function Implementations ---

def _clean_and_normalize_description(memo: str) -> str:
    """
    Performs initial cleaning on the transaction memo text.
    """
    if not isinstance(memo, str):
        return ""
    # Convert to uppercase for consistent matching
    text = memo.upper()
    # Remove special characters, but keep alphanumeric, spaces, and some separators
    text = re.sub(r'[^A-Z0-9\s#\-\.]', '', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def _extract_mcc(text: str) -> Optional[str]:
    """
    Extracts a 4-digit MCC from a string using various patterns.
    """
    patterns = [
        r'\bMC[C]?\s*(\d{4})\b',  # Matches MCC 1234, MC 1234, MCC1234, MC1234
        r'\bM\s*(\d{4})\b'         # Matches M 1234, M1234
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    
    # Last resort: find a 4-digit number that's not clearly part of something else.
    # This is less precise and could have false positives.
    # We will avoid it for now to maintain high accuracy, but it could be added.
    return None

def _parse_merchant_name(text: str) -> str:
    """
    A heuristic-based merchant name parser. This function is a "best-effort"
    starting point for the complex task of name extraction.
    """
    # Remove MCC codes and other known patterns first
    text = re.sub(r'\bMC[C]?\s*\d{4}\b', '', text)
    text = re.sub(r'\b\d{1,2}/\d{1,2}/\d{2,4}\b', '', text) # Dates
    text = re.sub(r'\b\d{10,}\b', '', text) # Long transaction IDs
    text = re.sub(r'#\d+', '', text).strip() # Store numbers

    # Remove common noise words from your transaction data
    noise = [
        'DEBIT CARD', 'WITHDRAWAL', 'DEPOSIT', 'PHOENIX', 'AZ', 'AR', 'DATE', 
        'TYPE', 'PAYMENTS', 'ACH', 'ECC', 'PPD', 'WEB', 'TRACE', 'REF'
    ]
    # Dynamically build a regex to remove whole words
    noise_regex = r'\b(' + '|'.join(noise) + r')\b'
    text = re.sub(noise_regex, '', text)
    
    # Collapse extra whitespace that may have been created
    return re.sub(r'\s+', ' ', text).strip()

def _fetch_category_name(category_id: str, supabase_client: Any) -> Optional[str]:
    """
    Fetches the category name from the category table using the category_id.
    """
    try:
        response = supabase_client.table('categories').select('name').eq('id', category_id).single().execute()
        if response.data:
            return response.data.get('name')
    except Exception as e:
        print(f"Error querying categories table for category_id {category_id}: {e}")
    return None

def _match_by_regex_rules(cleaned_memo: str, supabase_client: Any) -> Optional[Dict[str, Any]]:
    """
    Matches the memo against the `global_regex_rules` table by querying Supabase.
    This is the highest confidence matching method.
    """
    try:
        # This query fetches all rules and joins them with their associated merchant data.
        response = supabase_client.table('global_regex_rules').select(
            'regex_pattern, merchants(id, name, default_category_id)'
        ).execute()

        if not response.data:
            return None

        all_rules = response.data

        for rule in all_rules:
            # Ensure the rule and its merchant data are valid before proceeding
            if re.search(rule['regex_pattern'], cleaned_memo) and rule.get('merchants'):
                merchant = rule['merchants']
                category_id = merchant.get('default_category_id')
                category_name = _fetch_category_name(category_id, supabase_client) if category_id else None
                return {
                    "merchant_id": merchant.get('id'),
                    "merchant_name": merchant.get('name'),
                    "category_id": category_id,
                    "category_name": category_name,
                    "confidence": 1.0,
                    "match_method": "global_regex"
                }
    except Exception as e:
        print(f"Error querying global_regex_rules: {e}")
        return None
        
    return None

def _match_by_mcc_and_parsing(cleaned_memo: str, supabase_client: Any) -> Optional[Dict[str, Any]]:
    """
    Fallback method: Extracts MCC, looks up category in Supabase, and parses merchant name.
    """
    mcc = _extract_mcc(cleaned_memo)
    if not mcc:
        return None

    category_id = None
    try:
        # Query the mcc_category_map table for the extracted MCC
        response = supabase_client.table('mcc_category_map').select('category_id').eq('mcc', int(mcc)).single().execute()
        if response.data:
            category_id = response.data.get('category_id')
    except Exception as e:
        print(f"Error querying mcc_category_map for MCC {mcc}: {e}")
        return None
    
    if not category_id:
        return None

    # If we found a category, now try to parse the merchant name
    parsed_name = _parse_merchant_name(cleaned_memo)
    
    # We prioritize having a category over having a name
    return {
        "merchant_id": None,  # No specific merchant matched, but we can suggest a name
        "merchant_name": parsed_name.title() if parsed_name else "Uncategorized", # Title case
        "category_id": category_id,
        "category_name": _fetch_category_name(category_id, supabase_client) if category_id else None,
        "confidence": 0.7 if parsed_name else 0.5, # Confidence is lower if name parsing fails
        "match_method": "mcc_and_parse" if parsed_name else "mcc_only"
    }


# --- Main Orchestrator Function ---

def process_transaction(transaction_data: Dict[str, Any], supabase_client: Any) -> Dict[str, Any]:
    """
    Processes a single raw transaction to enrich it with merchant and category info.
    
    Args:
        transaction_data: A dict representing a single transaction.
        supabase_client: An initialized Supabase client instance.

    Returns:
        An enriched transaction dictionary, not yet saved to the database.
    """
    original_memo = transaction_data.get('description', '')
    
    # 1. Clean and Normalize the Memo
    cleaned_memo = _clean_and_normalize_description(original_memo)

    # 2. Strategy 1: Attempt to match with high-confidence global regex rules
    match_result = _match_by_regex_rules(cleaned_memo, supabase_client)
    
    # 3. Strategy 2: If no regex match, fall back to MCC parsing
    if not match_result:
        match_result = _match_by_mcc_and_parsing(cleaned_memo, supabase_client)

    # 4. Consolidate the results
    user_metadata = {k: v for k, v in transaction_data.items() 
                     if k not in ['date', 'transaction_number', 'description', 'amount']}

    processed_data = {
        "date": transaction_data.get('date'),
        "transaction_number": transaction_data.get('transaction_number'),
        "amount": transaction_data.get('amount'),
        "original_description": original_memo,
        "user_metadata": user_metadata,

        # Matched data from our strategies
        "merchant_id": match_result.get('merchant_id') if match_result else None,
        "category_id": match_result.get('category_id') if match_result else None,
        "category_name": match_result.get('category_name') if match_result else None,
        "clean_description": (match_result.get('merchant_name') if match_result
                              else _parse_merchant_name(cleaned_memo).title() or "Uncategorized"),
        
        # Confidence and Review Flag
        "confidence": match_result.get('confidence', 0.0) if match_result else 0.0,
        "match_method": match_result.get('match_method', 'no_match') if match_result else 'no_match',
        "needs_review": not match_result or match_result.get('confidence', 0.0) < 0.9
    }
    
    return processed_data