"""
Enhanced unified transaction processor for both Plaid and CSV data sources.
This processor maintains backward compatibility with existing merchant references
while adding support for Plaid's merchant data enrichment.
"""

from typing import Dict, Any, Optional, Literal
import re
from enum import Enum

class TransactionSource(str, Enum):
    """Enumeration of transaction data sources"""
    PLAID = "plaid"
    CSV = "csv" 
    MANUAL = "manual"

class PlaidTransactionProcessor:
    """
    Unified transaction processor that handles:
    1. Plaid transactions with merchant_name field
    2. CSV uploads with description parsing
    3. Manual entries with user-specified data
    
    Maintains all existing merchant relationships and references.
    """
    
    def __init__(self, data_cache):
        """Initialize with data cache containing merchants, categories, etc."""
        self.data_cache = data_cache
    
    def process_transaction(
        self, 
        transaction_data: Dict[str, Any], 
        source: TransactionSource = TransactionSource.CSV,
        user_rules: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for processing transactions from any source.
        
        Args:
            transaction_data: Raw transaction data
            source: Source of the transaction (plaid, csv, manual)
            user_rules: User-defined rules for categorization
            
        Returns:
            Enriched transaction with merchant_id, category_id, etc.
        """
        try:
            print(f"DEBUG: Processing {source} transaction: {transaction_data.get('description', 'No description')}")
            
            if source == TransactionSource.PLAID:
                return self._process_plaid_transaction(transaction_data, user_rules)
            elif source == TransactionSource.CSV:
                return self._process_csv_transaction(transaction_data, user_rules)
            elif source == TransactionSource.MANUAL:
                return self._process_manual_transaction(transaction_data, user_rules)
            else:
                raise ValueError(f"Unsupported transaction source: {source}")
                
        except Exception as e:
            print(f"ERROR in process_transaction: {e}")
            return self._create_fallback_response(transaction_data, source)
    
    def _process_plaid_transaction(
        self, 
        transaction_data: Dict[str, Any], 
        user_rules: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Process Plaid transaction using merchant_name and category data.
        
        Plaid provides:
        - merchant_name: Clean merchant name 
        - category: Array of category strings
        - account_id: Plaid account ID
        - transaction_id: Plaid transaction ID
        """
        print(f"DEBUG: Processing Plaid transaction")
        
        # Extract Plaid-specific fields
        plaid_merchant_name = transaction_data.get('merchant_name')
        plaid_category = transaction_data.get('category', [])
        plaid_transaction_id = transaction_data.get('transaction_id')
        
        # Use merchant_name if available, otherwise fall back to name/description
        merchant_source = plaid_merchant_name or transaction_data.get('name') or transaction_data.get('description', '')
        
        print(f"DEBUG: Plaid merchant source: {merchant_source}")
        print(f"DEBUG: Plaid category: {plaid_category}")
        
        # Strategy 1: Try to match existing merchant by name
        merchant_match = self._find_or_create_plaid_merchant(
            merchant_name=merchant_source,
            plaid_category=plaid_category,
            plaid_transaction_id=plaid_transaction_id
        )
        
        # Strategy 2: Apply user rules override if present
        if user_rules:
            user_rule_result = self._apply_user_rules(transaction_data, user_rules)
            if user_rule_result:
                if merchant_match:
                    merchant_match.update(user_rule_result)
                    merchant_match['match_method'] = 'user_rule_override'
                else:
                    merchant_match = user_rule_result
                    merchant_match['match_method'] = 'user_rule_override'
        
        # Build final response
        return self._build_transaction_response(
            transaction_data=transaction_data,
            merchant_match=merchant_match,
            source=TransactionSource.PLAID
        )
    
    def _process_csv_transaction(
        self, 
        transaction_data: Dict[str, Any], 
        user_rules: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Process CSV transaction using existing regex matching logic.
        Maintains backward compatibility with current system.
        """
        print(f"DEBUG: Processing CSV transaction")
        
        # Use existing transaction processor logic
        from core.transaction_processor import process_transaction
        
        result = process_transaction(transaction_data, self.data_cache, user_rules)
        
        # Add account_id and user_id from transaction_data to result
        result['account_id'] = transaction_data.get('account_id')
        result['user_id'] = transaction_data.get('user_id')
        
        # Ensure response format consistency
        return self._normalize_transaction_response(result, TransactionSource.CSV)
    
    def _process_manual_transaction(
        self, 
        transaction_data: Dict[str, Any], 
        user_rules: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Process manually entered transaction.
        Allows user to specify merchant and category directly.
        """
        print(f"DEBUG: Processing manual transaction")
        
        # For manual transactions, user may provide:
        # - merchant_name or merchant_id
        # - category_name or category_id
        # - description
        
        merchant_match = None
        
        # Check if user provided merchant_id directly
        if transaction_data.get('merchant_id'):
            merchant_match = self._get_merchant_by_id(transaction_data['merchant_id'])
        
        # Check if user provided merchant_name
        elif transaction_data.get('merchant_name'):
            merchant_match = self._find_merchant_by_name(transaction_data['merchant_name'])
        
        # Fall back to description matching
        else:
            description = transaction_data.get('description', '')
            merchant_match = self._match_merchant_by_regex(description)
        
        # Apply user rules if present
        if user_rules:
            user_rule_result = self._apply_user_rules(transaction_data, user_rules)
            if user_rule_result:
                if merchant_match:
                    merchant_match.update(user_rule_result)
                else:
                    merchant_match = user_rule_result
                merchant_match['match_method'] = 'user_rule_override'
        
        return self._build_transaction_response(
            transaction_data=transaction_data,
            merchant_match=merchant_match,
            source=TransactionSource.MANUAL
        )
    
    def _find_or_create_plaid_merchant(
        self, 
        merchant_name: str, 
        plaid_category: list, 
        plaid_transaction_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Find existing merchant or create new one from Plaid data.
        
        This maintains the merchant database while enriching it with Plaid data.
        """
        if not merchant_name:
            return None
        
        # First, try exact match by name
        existing_merchant = self._find_merchant_by_name(merchant_name)
        
        if existing_merchant:
            print(f"DEBUG: Found existing merchant: {existing_merchant.get('name')}")
            
            # Update merchant with Plaid category if not set
            self._update_merchant_with_plaid_data(existing_merchant, plaid_category)
            
            return existing_merchant
        
        # If no exact match, try fuzzy matching by regex patterns
        fuzzy_match = self._match_merchant_by_regex(merchant_name)
        
        if fuzzy_match:
            print(f"DEBUG: Fuzzy matched to existing merchant: {fuzzy_match.get('merchant_name')}")
            return fuzzy_match
        
        # Create new merchant from Plaid data
        print(f"DEBUG: Creating new merchant from Plaid data: {merchant_name}")
        return self._create_merchant_from_plaid(merchant_name, plaid_category)
    
    def _find_merchant_by_name(self, merchant_name: str) -> Optional[Dict[str, Any]]:
        """Find merchant by exact name match"""
        if not merchant_name or not self.data_cache.merchants:
            return None
        
        merchant_name_lower = merchant_name.lower().strip()
        
        for merchant in self.data_cache.merchants:
            if merchant.get('name', '').lower().strip() == merchant_name_lower:
                return self._format_merchant_response(merchant)
        
        return None
    
    def _get_merchant_by_id(self, merchant_id: str) -> Optional[Dict[str, Any]]:
        """Get merchant by ID"""
        if not merchant_id or not self.data_cache.merchants:
            return None
        
        for merchant in self.data_cache.merchants:
            if str(merchant.get('merchant_id')) == str(merchant_id):
                return self._format_merchant_response(merchant)
        
        return None
    
    def _match_merchant_by_regex(self, description: str) -> Optional[Dict[str, Any]]:
        """Use existing regex matching logic"""
        from core.matching import match_merchant_by_regex
        
        if not description or not self.data_cache.merchants:
            return None
        
        return match_merchant_by_regex(description, self.data_cache.merchants)
    
    def _update_merchant_with_plaid_data(self, merchant: Dict[str, Any], plaid_category: list):
        """
        Update existing merchant with Plaid category data if beneficial.
        This could be done asynchronously in a background task.
        """
        # For now, just log that we could update
        # In production, you might want to update the merchant's metadata
        print(f"DEBUG: Could update merchant {merchant.get('name')} with Plaid category: {plaid_category}")
        
        # Example: Update merchant's plaid_category field
        # merchant['plaid_category'] = plaid_category
        pass
    
    def _create_merchant_from_plaid(self, merchant_name: str, plaid_category: list) -> Dict[str, Any]:
        """
        Create a new merchant entry from Plaid data.
        This should create a new merchant in the database.
        """
        print(f"DEBUG: Would create new merchant: {merchant_name} with category: {plaid_category}")
        
        # Map Plaid category to our category system
        category_id = self._map_plaid_category_to_internal(plaid_category)
        
        # For now, return a temporary merchant object
        # In production, you'd insert into the merchants table
        new_merchant = {
            "merchant_id": None,  # Would be generated by database
            "merchant_name": merchant_name,
            "name": merchant_name,
            "category_id": category_id,
            "confidence": 0.9,  # High confidence for Plaid data
            "match_method": "plaid_new_merchant",
            "logo_url": None,  # Could be enriched later
            "is_plaid_merchant": True
        }
        
        return new_merchant
    
    def _map_plaid_category_to_internal(self, plaid_category: list) -> Optional[str]:
        """
        Map Plaid Personal Finance Category to internal category system.
        
        Plaid categories are hierarchical: ["Food and Drink", "Restaurants", "Coffee Shop"]
        """
        if not plaid_category or not self.data_cache.categories:
            return None
        
        # Try to find category by Plaid category name
        for category_level in plaid_category:
            for internal_category in self.data_cache.categories:
                # Check if internal category name matches any Plaid category level
                internal_name = internal_category.get('name', '').lower()
                plaid_name = category_level.lower()
                
                if internal_name == plaid_name or plaid_name in internal_name:
                    return internal_category.get('category_id')
        
        # Fallback: look for partial matches
        for category_level in plaid_category:
            for internal_category in self.data_cache.categories:
                internal_name = internal_category.get('name', '').lower()
                plaid_name = category_level.lower()
                
                # Check for common category mappings
                if self._categories_are_similar(internal_name, plaid_name):
                    return internal_category.get('category_id')
        
        return None
    
    def _categories_are_similar(self, internal_name: str, plaid_name: str) -> bool:
        """Check if category names are similar enough to map"""
        # Common mappings between Plaid and internal categories
        mappings = {
            'food and drink': ['food', 'dining', 'restaurant', 'grocery'],
            'restaurants': ['dining', 'restaurant', 'food'],
            'coffee shop': ['coffee', 'cafe'],
            'gas stations': ['gas', 'fuel', 'gasoline'],
            'grocery': ['grocery', 'food', 'supermarket'],
            'shopping': ['retail', 'shopping'],
            'entertainment': ['entertainment', 'fun', 'recreation'],
            'transportation': ['transport', 'travel', 'uber', 'lyft']
        }
        
        # Check direct mappings
        if plaid_name in mappings:
            return any(keyword in internal_name for keyword in mappings[plaid_name])
        
        # Check reverse mappings
        for plaid_key, keywords in mappings.items():
            if any(keyword in internal_name for keyword in keywords):
                return plaid_key in plaid_name
        
        return False
    
    def _apply_user_rules(self, transaction_data: Dict[str, Any], user_rules: list) -> Optional[Dict[str, Any]]:
        """Apply user-defined rules to override automatic categorization"""
        if not user_rules:
            return None
        
        from core.transaction_processor import _match_by_user_rules
        
        return _match_by_user_rules(transaction_data, user_rules, self.data_cache.categories)
    
    def _format_merchant_response(self, merchant: Dict[str, Any]) -> Dict[str, Any]:
        """Format merchant data for consistent response structure"""
        category_name = None
        if merchant.get('default_category_id'):
            category = self._get_category_by_id(merchant['default_category_id'])
            category_name = category.get('name') if category else None
        
        return {
            "merchant_id": merchant.get('merchant_id'),
            "merchant_name": merchant.get('name'),
            "category_id": merchant.get('default_category_id'),
            "category_name": category_name,
            "logo_url": merchant.get('logo_url'),
            "confidence": 1.0,
            "match_method": "exact_match"
        }
    
    def _get_category_by_id(self, category_id: str) -> Optional[Dict[str, Any]]:
        """Get category by ID from cache"""
        if not category_id or not self.data_cache.categories:
            return None
        
        for category in self.data_cache.categories:
            if str(category.get('category_id')) == str(category_id):
                return category
        
        return None
    
    def _build_transaction_response(
        self, 
        transaction_data: Dict[str, Any], 
        merchant_match: Optional[Dict[str, Any]], 
        source: TransactionSource
    ) -> Dict[str, Any]:
        """Build standardized transaction response"""
        
        # Handle user_metadata
        user_metadata = transaction_data.get('user_metadata', {})
        if not isinstance(user_metadata, dict):
            user_metadata = {}
        
        # Add source tracking to metadata
        user_metadata['source'] = source.value
        
        # Build clean description
        if merchant_match and merchant_match.get('merchant_name'):
            clean_description = merchant_match['merchant_name']
        else:
            # Fall back to parsing the original description
            from core.transaction_processor import _parse_merchant_name
            raw_desc = transaction_data.get('description', '')
            clean_description = _parse_merchant_name(raw_desc).title() or "Unknown Merchant"
        
        response = {
            # Core transaction fields
            "date": transaction_data.get('date'),
            "transaction_number": transaction_data.get('transaction_number'),
            "description": transaction_data.get('description'),
            "amount": transaction_data.get('amount'),
            "balance": transaction_data.get('balance'),
            "account_id": transaction_data.get('account_id'),
            "user_id": transaction_data.get('user_id'),
            
            # Enriched fields
            "merchant_id": merchant_match.get('merchant_id') if merchant_match else None,
            "merchant_name": merchant_match.get('merchant_name') if merchant_match else None,
            "category_id": merchant_match.get('category_id') if merchant_match else None,
            "category_name": merchant_match.get('category_name') if merchant_match else None,
            "clean_description": clean_description,
            "original_description": transaction_data.get('description'),
            
            # Metadata fields
            "confidence": merchant_match.get('confidence', 0.0) if merchant_match else 0.0,
            "match_method": merchant_match.get('match_method', 'no_match') if merchant_match else 'no_match',
            "needs_review": not merchant_match or merchant_match.get('confidence', 0.0) < 0.9,
            "user_metadata": user_metadata,
            
            # Plaid-specific fields (if applicable)
            "aggregator_transaction_id": transaction_data.get('transaction_id') if source == TransactionSource.PLAID else None,
        }
        
        return response
    
    def _normalize_transaction_response(self, result: Dict[str, Any], source: TransactionSource) -> Dict[str, Any]:
        """Normalize response from existing transaction processor"""
        # Ensure user_metadata includes source
        user_metadata = result.get('user_metadata', {})
        if not isinstance(user_metadata, dict):
            user_metadata = {}
        user_metadata['source'] = source.value
        result['user_metadata'] = user_metadata
        
        # Ensure all required fields are present with defaults
        required_fields = {
            'aggregator_transaction_id': None,
            'account_id': None,
            'user_id': None,
            'transaction_number': None,
            'balance': None,
            'merchant_id': None,
            'merchant_name': None,
            'category_id': None,
            'category_name': None,
            'clean_description': result.get('clean_description', result.get('description', 'Unknown')),
            'original_description': result.get('original_description', result.get('description', '')),
            'confidence': 0.0,
            'match_method': 'no_match',
            'needs_review': True
        }
        
        # Fill in any missing fields
        for field, default_value in required_fields.items():
            if field not in result:
                result[field] = default_value
        
        return result
    
    def _create_fallback_response(self, transaction_data: Dict[str, Any], source: TransactionSource) -> Dict[str, Any]:
        """Create fallback response when processing fails"""
        return {
            "date": transaction_data.get('date'),
            "transaction_number": transaction_data.get('transaction_number'),
            "description": transaction_data.get('description'),
            "amount": transaction_data.get('amount'),
            "balance": transaction_data.get('balance'),
            "account_id": transaction_data.get('account_id'),
            "user_id": transaction_data.get('user_id'),
            "merchant_id": None,
            "merchant_name": None,
            "category_id": None,
            "category_name": None,
            "clean_description": transaction_data.get('description', 'Unknown'),
            "original_description": transaction_data.get('description'),
            "confidence": 0.0,
            "match_method": "error",
            "needs_review": True,
            "user_metadata": {"source": source.value, "error": "processing_failed"},
            "aggregator_transaction_id": transaction_data.get('transaction_id') if source == TransactionSource.PLAID else None,
        }


# Convenience function for backward compatibility
def process_transaction_unified(
    transaction_data: Dict[str, Any], 
    data_cache, 
    source: str = "csv",
    user_rules: Optional[list] = None
) -> Dict[str, Any]:
    """
    Unified transaction processing function.
    
    Args:
        transaction_data: Raw transaction data
        data_cache: Data cache instance
        source: Transaction source ("plaid", "csv", "manual")
        user_rules: User-defined rules
        
    Returns:
        Enriched transaction data
    """
    processor = PlaidTransactionProcessor(data_cache)
    source_enum = TransactionSource(source.lower())
    return processor.process_transaction(transaction_data, source_enum, user_rules)
