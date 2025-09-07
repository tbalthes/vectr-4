# In python/core/transaction_processor.py
from typing import Dict, Any, Optional
import re

def _match_by_user_rules(transaction_data: Dict[str, Any], user_rules: list, categories: list) -> Optional[Dict[str, Any]]:
    """
    Checks if the transaction matches any user-defined rules.
    """
    print(f"DEBUG: Checking {len(user_rules)} user rules for transaction: {transaction_data.get('description', '')}")
    print(f"DEBUG: Available transaction fields: {list(transaction_data.keys())}")

    # Sort rules by priority (lower number = higher priority)
    sorted_rules = sorted(user_rules, key=lambda r: r.get('priority', 1000))

    def match_operator(op, field_value, rule_value):
        if field_value is None:
            return False
        field_value = str(field_value)
        rule_value = str(rule_value)
        op = (op or 'equals').lower()
        if op == 'equals':
            return field_value.lower() == rule_value.lower()
        elif op == 'contains':
            return rule_value.lower() in field_value.lower()
        elif op == 'startswith':
            return field_value.lower().startswith(rule_value.lower())
        elif op == 'endswith':
            return field_value.lower().endswith(rule_value.lower())
        elif op == 'regex':
            try:
                return re.search(rule_value, field_value, re.IGNORECASE) is not None
            except Exception as e:
                print(f"DEBUG: Invalid regex in rule: {rule_value} ({e})")
                return False
        return False

    for rule in sorted_rules:
        if not rule.get('enabled', True):
            continue
        field = rule.get('match_field')
        value = rule.get('match_value')
        operator = rule.get('match_operator', 'equals')
        amount_min = rule.get('amount_min')
        amount_max = rule.get('amount_max')
        transaction_field_value = transaction_data.get(field, '')
        transaction_amount = transaction_data.get('amount')

        print(f"DEBUG: Rule - field: {field}, value: {value}, operator: {operator}, amount_min: {amount_min}, amount_max: {amount_max}")
        print(f"DEBUG: Transaction field value: {transaction_field_value}, amount: {transaction_amount}")

        # Field/operator match
        field_match = False
        if field and value:
            field_match = match_operator(operator, transaction_field_value, value)
        elif field and not value:
            # If value is not set, skip field match (could be amount-only rule)
            field_match = True
        else:
            field_match = True  # No field specified, allow amount-only rule

        # Amount match
        amount_match = True
        if (amount_min is not None or amount_max is not None):
            if transaction_amount is None:
                amount_match = False
            else:
                try:
                    amt = float(transaction_amount)
                    if amount_min is not None and amt < float(amount_min):
                        amount_match = False
                    if amount_max is not None and amt > float(amount_max):
                        amount_match = False
                except Exception as e:
                    print(f"DEBUG: Error parsing amount for rule: {e}")
                    amount_match = False

        if field_match and amount_match:
            print(f"DEBUG: RULE MATCHED! Applying category: {rule.get('category_id')}")
            category_id = rule.get('category_id')
            category_name = None
            if category_id:
                # Updated for new Plaid categories structure
                category_name = next((c.get('plain_name') or c.get('name') for c in categories if str(c.get('category_id')) == str(category_id)), None)
            return {
                "category_id": category_id,
                "category_name": category_name,
                "confidence": 1.0,
                "match_method": "user_rule"
            }

    print("DEBUG: No user rules matched")
    return None
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

def _fetch_category_name(category_id: str, categories: list) -> Optional[str]:
    """
    Fetches the category name from the in-memory categories list using the category_id.
    Updated for new Plaid categories structure with category_id as primary key.
    """
    for cat in categories:
        # Use category_id as the primary key (new Plaid structure)
        if str(cat.get('category_id')) == str(category_id):
            # Prefer plain_name (display name) over name
            return cat.get('plain_name') or cat.get('name')
    return None
def _match_by_merchant_regex(cleaned_memo: str, merchants: list, categories: list) -> Optional[Dict[str, Any]]:
    """
    Matches the memo against merchant regex patterns from the new merchants table.
    This replaces the old global_regex_rules system.
    """
    if not cleaned_memo or not merchants:
        return None
        
    for merchant in merchants:
        regex_pattern = merchant.get('regex_match')
        if not regex_pattern:
            continue
            
        try:
            # Perform case-insensitive regex matching
            if re.search(regex_pattern, cleaned_memo, re.IGNORECASE):
                merchant_id = merchant.get('merchant_id')
                merchant_name = merchant.get('name')
                category_id = merchant.get('default_category_id')
                logo_url = merchant.get('logo_url')
                
                # Get category name using new category_id field
                category_name = _fetch_category_name(category_id, categories) if category_id else None
                
                return {
                    "merchant_id": merchant_id,
                    "merchant_name": merchant_name,
                    "logo_url": logo_url,
                    "category_id": category_id,
                    "category_name": category_name,
                    "confidence": 1.0,
                    "match_method": "merchant_regex"
                }
        except re.error as e:
            # Skip invalid regex patterns and log error
            print(f"Invalid regex pattern in merchant {merchant.get('name', 'Unknown')}: {regex_pattern} - {e}")
            continue
            
    return None

def _match_by_mcc_and_parsing(cleaned_memo: str, mcc_category_map: list, categories: list) -> Optional[Dict[str, Any]]:
    """
    Fallback method: Extracts MCC, looks up category in the in-memory mcc_category_map, and parses merchant name.
    """
    mcc = _extract_mcc(cleaned_memo)
    if not mcc:
        return None

    category_id = None
    for row in mcc_category_map:
        if str(row.get('mcc')) == str(mcc):
            category_id = row.get('category_id')
            break

    if not category_id:
        return None

    # If we found a category, now try to parse the merchant name
    parsed_name = _parse_merchant_name(cleaned_memo)
    
    # We prioritize having a category over having a name
    return {
        "merchant_id": None,  # No specific merchant matched, but we can suggest a name
        "merchant_name": parsed_name.title() if parsed_name else "Uncategorized", # Title case
        "category_id": category_id,
        "category_name": _fetch_category_name(category_id, categories) if category_id else None,
        "confidence": 0.7 if parsed_name else 0.5, # Confidence is lower if name parsing fails
        "match_method": "mcc_and_parse" if parsed_name else "mcc_only"
    }


# --- Main Orchestrator Function ---

def process_transaction(transaction_data: Dict[str, Any], data_cache: Any, user_rules: Optional[list] = None) -> Dict[str, Any]:
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

    if user_rules is None:
        user_rules = []

    # 2. Strategy 1: Attempt to match with merchant regex patterns (replaces global_regex_rules)
    match_result = _match_by_merchant_regex(
        cleaned_memo,
        data_cache.merchants,
        data_cache.categories
    )

    # 3. Strategy 2: If no regex match, fall back to MCC parsing
    if not match_result:
        match_result = _match_by_mcc_and_parsing(
            cleaned_memo,
            data_cache.mcc_category_map,
            data_cache.categories
        )

    # 4. Consolidate the results
    # Only include fields not already mapped to standard fields
    user_metadata = {k: v for k, v in transaction_data.items()
                     if k not in ['date', 'transaction_number', 'description', 'amount', 'balance', 'user_metadata']}

    # If user_metadata was provided as a nested object, use that instead
    if 'user_metadata' in transaction_data and isinstance(transaction_data['user_metadata'], dict):
        user_metadata = transaction_data['user_metadata']

    # Filter out system fields from user_metadata to only keep actual custom fields
    if user_metadata:
        filtered_metadata = {}
        for key, value in user_metadata.items():
            # Skip system fields that shouldn't be custom fields
            is_system_field = (
                key.startswith("_") or
                key.lower().startswith("system") or
                key.lower() in ["formattedamount", "formatted_amount"] or
                key.lower().endswith("index") or
                key.lower().endswith("rowindex") or
                value is None or
                value == "" or
                (isinstance(value, str) and len(value.strip()) == 0)
            )

            if not is_system_field:
                filtered_metadata[key] = value

        user_metadata = filtered_metadata if filtered_metadata else None

    processed_data = {
        "date": transaction_data.get('date'),
        "transaction_number": transaction_data.get('transaction_number'),
        "description": transaction_data.get('description'),
        "amount": transaction_data.get('amount'),
        "balance": transaction_data.get('balance'),  # Pass-through balance field
        "original_description": original_memo,
        "user_metadata": user_metadata,

        # Matched data from our strategies
        "merchant_id": match_result.get('merchant_id') if match_result else None,
        "merchant_name": match_result.get('merchant_name') if match_result else None,
        "logo_url": match_result.get('logo_url') if match_result and 'logo_url' in match_result else None,
        "category_id": match_result.get('category_id') if match_result else None,
        "category_name": match_result.get('category_name') if match_result else None,
        "clean_description": (match_result.get('merchant_name') if match_result
                              else _parse_merchant_name(cleaned_memo).title() or "Uncategorized"),
        
        # Confidence and Review Flag
        "confidence": match_result.get('confidence', 0.0) if match_result else 0.0,
        "match_method": match_result.get('match_method', 'no_match') if match_result else 'no_match',
        "needs_review": not match_result or match_result.get('confidence', 0.0) < 0.9
    }
    
    # FINAL CHECK: User rules override everything else
    user_rule_result = _match_by_user_rules(processed_data, user_rules, data_cache.categories)
    if user_rule_result:
        print(f"DEBUG: User rule override applied! New category: {user_rule_result.get('category_name')}")
        processed_data.update({
            "category_id": user_rule_result.get('category_id'),
            "category_name": user_rule_result.get('category_name'),
            "confidence": 1.0,
            "match_method": "user_rule_override"
        })
    
    return processed_data