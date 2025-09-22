"""
Updated Plaid Transaction Processor for Merchant-Centric Data Model
This version prioritizes merchant_name + merchant_id over clean_description
"""

from enum import Enum
from typing import Dict, Any, Optional, List
import uuid
from datetime import datetime


class TransactionSource(Enum):
    PLAID = "plaid"
    CSV = "csv" 
    MANUAL = "manual"


class MerchantCentricProcessor:
    """
    Refactored transaction processor that eliminates clean_description dependency
    in favor of proper merchant table relationships and merchant_name fields.
    """
    
    def __init__(self, data_cache):
        self.data_cache = data_cache
    
    def process_transaction(
        self, 
        transaction_data: Dict[str, Any], 
        source: TransactionSource = TransactionSource.PLAID,
        user_rules: Optional[List] = None
    ) -> Dict[str, Any]:
        """
        Process transaction with merchant-centric approach.
        
        Priority order:
        1. Plaid merchant data (merchant_name from counterparties)
        2. Existing merchant_id lookup
        3. User rules override
        4. Fallback to parsed description
        """
        try:
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
        user_rules: Optional[List] = None
    ) -> Dict[str, Any]:
        """
        Process Plaid transaction prioritizing merchant data over descriptions.
        
        Plaid provides rich merchant data in counterparties array:
        - entity_id: Plaid's merchant identifier
        - name: Clean merchant name
        - logo_url: Merchant logo
        - website: Merchant website
        - confidence_level: Plaid's confidence in the match
        """
        print(f"DEBUG: Processing Plaid transaction with merchant-first approach")
        
        # Extract Plaid merchant data from counterparties
        merchant_data = self._extract_plaid_merchant_data(transaction_data)
        
        if merchant_data:
            print(f"DEBUG: Found Plaid merchant data: {merchant_data['name']}")
            
            # Find or create merchant in our database
            merchant_result = self._find_or_create_merchant(
                merchant_name=merchant_data['name'],
                aggregator_merchant_id=merchant_data.get('entity_id'),
                logo_url=merchant_data.get('logo_url'),
                website=merchant_data.get('website'),
                confidence_level=merchant_data.get('confidence_level'),
                user_id=transaction_data.get('user_id')
            )
        else:
            # Fallback to transaction name field for merchant data
            transaction_name = transaction_data.get('name', '')
            print(f"DEBUG: No counterparties found, using transaction name: {transaction_name}")
            
            merchant_result = self._parse_merchant_from_description(
                description=transaction_name,
                user_id=transaction_data.get('user_id')
            )
        
        # Apply user rules if present (can override merchant matching)
        if user_rules:
            user_rule_result = self._apply_user_rules(transaction_data, user_rules)
            if user_rule_result:
                # User rules override automatic merchant detection
                merchant_result = self._merge_merchant_data(merchant_result, user_rule_result)
                merchant_result['match_method'] = 'user_rule_override'
        
        return self._build_merchant_centric_response(
            transaction_data=transaction_data,
            merchant_result=merchant_result,
            source=TransactionSource.PLAID
        )
    
    def _extract_plaid_merchant_data(self, transaction_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Extract merchant data from Plaid counterparties array.
        
        Plaid structure:
        {
          "counterparties": [
            {
              "confidence_level": "VERY_HIGH",
              "entity_id": "Do7pjknKqXrQkMr7qdV9JXrQ3Em8nzny5rOE1",
              "logo_url": "https://plaid-merchant-logos.plaid.com/sweetgreen_986.png",
              "name": "Sweetgreen",
              "type": "merchant",
              "website": "sweetgreen.com"
            }
          ]
        }
        """
        counterparties = transaction_data.get('counterparties', [])
        
        if not counterparties:
            return None
        
        # Find the first merchant-type counterparty
        for counterparty in counterparties:
            if counterparty.get('type') == 'merchant':
                return {
                    'name': counterparty.get('name'),
                    'entity_id': counterparty.get('entity_id'),
                    'logo_url': counterparty.get('logo_url'),
                    'website': counterparty.get('website'),
                    'confidence_level': counterparty.get('confidence_level'),
                    'phone_number': counterparty.get('phone_number')
                }
        
        # If no merchant type found, use the first counterparty
        if counterparties:
            first = counterparties[0]
            return {
                'name': first.get('name'),
                'entity_id': first.get('entity_id'),
                'logo_url': first.get('logo_url'),
                'website': first.get('website'),
                'confidence_level': first.get('confidence_level'),
                'phone_number': first.get('phone_number')
            }
        
        return None
    
    def _find_or_create_merchant(
        self,
        merchant_name: str,
        aggregator_merchant_id: Optional[str] = None,
        logo_url: Optional[str] = None,
        website: Optional[str] = None,
        confidence_level: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Find existing merchant or create new one with Plaid data.
        """
        if not merchant_name or not merchant_name.strip():
            return self._create_unknown_merchant()
        
        merchant_name = merchant_name.strip()
        
        # 1. Try exact match by aggregator_merchant_id (Plaid entity_id)
        if aggregator_merchant_id:
            existing_merchant = self._find_merchant_by_aggregator_id(aggregator_merchant_id)
            if existing_merchant:
                print(f"DEBUG: Found merchant by aggregator ID: {existing_merchant.get('merchant_name')}")
                return self._format_merchant_result(existing_merchant, 'aggregator_id_match')
        
        # 2. Try exact match by merchant name for this user
        existing_merchant = self._find_merchant_by_name(merchant_name, user_id)
        if existing_merchant:
            print(f"DEBUG: Found merchant by name: {existing_merchant.get('merchant_name')}")
            
            # Update merchant with Plaid data if we have it
            self._update_merchant_plaid_data(existing_merchant, {
                'aggregator_merchant_id': aggregator_merchant_id,
                'logo_url': logo_url,
                'website': website,
                'confidence_level': confidence_level
            })
            
            return self._format_merchant_result(existing_merchant, 'name_match')
        
        # 3. Try fuzzy matching against existing merchants
        fuzzy_match = self._fuzzy_match_merchant(merchant_name, user_id)
        if fuzzy_match:
            print(f"DEBUG: Fuzzy matched to: {fuzzy_match.get('merchant_name')}")
            return self._format_merchant_result(fuzzy_match, 'fuzzy_match')
        
        # 4. Create new merchant
        print(f"DEBUG: Creating new merchant: {merchant_name}")
        new_merchant = self._create_new_merchant({
            'merchant_name': merchant_name,
            'aggregator_merchant_id': aggregator_merchant_id or f"auto_{uuid.uuid4()}",
            'logo_url': logo_url,
            'website': website,
            'confidence_level': confidence_level,
            'user_id': user_id
        })
        
        return self._format_merchant_result(new_merchant, 'new_merchant')
    
    def _find_merchant_by_aggregator_id(self, aggregator_id: str) -> Optional[Dict[str, Any]]:
        """Find merchant by external aggregator ID (Plaid entity_id)"""
        if not self.data_cache.merchants:
            return None
        
        for merchant in self.data_cache.merchants:
            if merchant.get('aggregator_merchant_id') == aggregator_id:
                return merchant
        
        return None
    
    def _find_merchant_by_name(self, merchant_name: str, user_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Find merchant by exact name match for the user"""
        if not self.data_cache.merchants or not merchant_name:
            return None
        
        name_lower = merchant_name.lower().strip()
        
        for merchant in self.data_cache.merchants:
            merchant_name_field = merchant.get('merchant_name', '')
            merchant_user_id = merchant.get('user_id')
            
            if (merchant_name_field.lower().strip() == name_lower and 
                (user_id is None or merchant_user_id == user_id)):
                return merchant
        
        return None
    
    def _fuzzy_match_merchant(self, merchant_name: str, user_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Use existing regex/fuzzy matching logic for merchant detection.
        This maintains compatibility with current merchant matching patterns.
        """
        if not merchant_name or not self.data_cache.merchants:
            return None
        
        # Use existing matching logic from the original transaction processor
        try:
            from core.merchant_regex_matching import match_merchant_by_regex
            return match_merchant_by_regex(merchant_name, self.data_cache.merchants)
        except ImportError:
            # Fallback to simple substring matching
            return self._simple_fuzzy_match(merchant_name, user_id)
    
    def _simple_fuzzy_match(self, merchant_name: str, user_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Simple fuzzy matching fallback"""
        name_lower = merchant_name.lower().strip()
        
        for merchant in self.data_cache.merchants:
            merchant_name_field = merchant.get('merchant_name', '').lower().strip()
            merchant_user_id = merchant.get('user_id')
            
            # Check if user matches (if user_id provided)
            if user_id and merchant_user_id != user_id:
                continue
            
            # Simple substring matching
            if (len(merchant_name_field) >= 3 and 
                (merchant_name_field in name_lower or name_lower in merchant_name_field)):
                return merchant
        
        return None
    
    def _create_new_merchant(self, merchant_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new merchant record. In production, this would insert into database.
        For now, return a formatted merchant object.
        """
        new_merchant = {
            'merchant_id': str(uuid.uuid4()),  # Would be generated by database
            'merchant_name': merchant_data['merchant_name'],
            'aggregator_merchant_id': merchant_data.get('aggregator_merchant_id'),
            'logo_url': merchant_data.get('logo_url'),
            'website': merchant_data.get('website'),
            'confidence_level': merchant_data.get('confidence_level'),
            'user_id': merchant_data.get('user_id'),
            'created_at': datetime.utcnow().isoformat(),
            'merchant_type': 'merchant',
            'is_plaid_merchant': True
        }
        
        # In production, insert into merchants table:
        # INSERT INTO merchants (merchant_name, aggregator_merchant_id, logo_url, ...)
        # VALUES (...)
        
        return new_merchant
    
    def _update_merchant_plaid_data(self, merchant: Dict[str, Any], plaid_data: Dict[str, Any]):
        """
        Update existing merchant with Plaid data if beneficial.
        This could be done asynchronously.
        """
        # For now, just log the potential update
        # In production, you might want to UPDATE merchants SET ... WHERE merchant_id = ...
        
        updates = {}
        
        if plaid_data.get('aggregator_merchant_id') and not merchant.get('aggregator_merchant_id'):
            updates['aggregator_merchant_id'] = plaid_data['aggregator_merchant_id']
        
        if plaid_data.get('logo_url') and not merchant.get('logo_url'):
            updates['logo_url'] = plaid_data['logo_url']
        
        if plaid_data.get('website') and not merchant.get('website'):
            updates['website'] = plaid_data['website']
        
        if updates:
            print(f"DEBUG: Would update merchant {merchant.get('merchant_name')} with: {updates}")
            # merchant.update(updates)  # Uncomment for in-memory updates
    
    def _parse_merchant_from_description(self, description: str, user_id: Optional[str]) -> Dict[str, Any]:
        """
        Fallback: Parse merchant name from transaction description.
        This is used when Plaid doesn't provide counterparties data.
        """
        if not description or not description.strip():
            return self._create_unknown_merchant()
        
        # Use existing transaction processor logic for parsing
        try:
            from core.transaction_processor import _parse_merchant_name
            parsed_name = _parse_merchant_name(description)
            
            if parsed_name and parsed_name.strip():
                return self._find_or_create_merchant(
                    merchant_name=parsed_name.strip().title(),
                    user_id=user_id
                )
        except Exception as e:
            print(f"DEBUG: Error parsing merchant from description: {e}")
        
        return self._create_unknown_merchant()
    
    def _create_unknown_merchant(self) -> Dict[str, Any]:
        """Create placeholder for unknown merchant"""
        return {
            'merchant_id': None,
            'merchant_name': 'Unknown Merchant',
            'logo_url': None,
            'website': None,
            'confidence': 0.1,
            'match_method': 'unknown'
        }
    
    def _format_merchant_result(self, merchant: Dict[str, Any], match_method: str) -> Dict[str, Any]:
        """Format merchant data for consistent response structure"""
        
        # Get category information if merchant has default category
        category_info = self._get_merchant_category(merchant.get('default_category_id'))
        
        return {
            'merchant_id': merchant.get('merchant_id'),
            'merchant_name': merchant.get('merchant_name'),
            'logo_url': merchant.get('logo_url'),
            'website': merchant.get('website'),
            'phone': merchant.get('merchant_phone'),
            'category_id': category_info.get('category_id') if category_info else None,
            'category_name': category_info.get('category_name') if category_info else None,
            'confidence': self._calculate_confidence(match_method),
            'match_method': match_method,
            'aggregator_merchant_id': merchant.get('aggregator_merchant_id')
        }
    
    def _get_merchant_category(self, category_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Get category information for merchant"""
        if not category_id or not self.data_cache.categories:
            return None
        
        for category in self.data_cache.categories:
            if str(category.get('category_id')) == str(category_id):
                return {
                    'category_id': category.get('category_id'),
                    'category_name': category.get('category_name'),
                    'category_icon': category.get('category_icon')
                }
        
        return None
    
    def _calculate_confidence(self, match_method: str) -> float:
        """Calculate confidence score based on match method"""
        confidence_map = {
            'aggregator_id_match': 0.95,  # Plaid entity ID match
            'name_match': 0.90,           # Exact name match
            'fuzzy_match': 0.70,          # Fuzzy/regex match
            'new_merchant': 0.85,         # New merchant from Plaid
            'user_rule_override': 0.99,   # User rule override
            'unknown': 0.10               # Fallback
        }
        
        return confidence_map.get(match_method, 0.50)
    
    def _apply_user_rules(self, transaction_data: Dict[str, Any], user_rules: List) -> Optional[Dict[str, Any]]:
        """Apply user-defined rules for merchant/category override"""
        if not user_rules:
            return None
        
        # Use existing user rules logic
        try:
            from core.transaction_processor import _match_by_user_rules
            return _match_by_user_rules(transaction_data, user_rules, self.data_cache.categories)
        except ImportError:
            print("DEBUG: User rules matching not available")
            return None
    
    def _merge_merchant_data(self, merchant_result: Dict[str, Any], user_rule_result: Dict[str, Any]) -> Dict[str, Any]:
        """Merge user rule results with merchant detection results"""
        merged = merchant_result.copy()
        
        # User rules can override merchant and category
        if user_rule_result.get('merchant_id'):
            merged['merchant_id'] = user_rule_result['merchant_id']
        
        if user_rule_result.get('merchant_name'):
            merged['merchant_name'] = user_rule_result['merchant_name']
        
        if user_rule_result.get('category_id'):
            merged['category_id'] = user_rule_result['category_id']
            merged['category_name'] = user_rule_result.get('category_name')
        
        merged['confidence'] = max(merged.get('confidence', 0), user_rule_result.get('confidence', 0))
        
        return merged
    
    def _build_merchant_centric_response(
        self, 
        transaction_data: Dict[str, Any], 
        merchant_result: Dict[str, Any],
        source: TransactionSource
    ) -> Dict[str, Any]:
        """
        Build final transaction response with merchant-centric data.
        
        Key change: NO MORE clean_description field!
        Instead, we use:
        - merchant_name: The clean merchant name
        - original_description: Raw transaction description from bank/Plaid
        """
        
        # Get category from merchant result or transaction data
        category_id = merchant_result.get('category_id')
        category_name = merchant_result.get('category_name')
        
        # Handle user metadata
        user_metadata = transaction_data.get('user_metadata', {})
        if not isinstance(user_metadata, dict):
            user_metadata = {}
        user_metadata['source'] = source.value
        user_metadata['processing_version'] = 'merchant_centric_v1'
        
        response = {
            # Core transaction fields
            'transaction_id': transaction_data.get('transaction_id'),
            'user_id': transaction_data.get('user_id'),
            'account_id': transaction_data.get('account_id'),
            'amount': transaction_data.get('amount'),
            'date': transaction_data.get('date'),
            'authorized_date': transaction_data.get('authorized_date'),
            'transaction_date': transaction_data.get('date') or transaction_data.get('authorized_date'),
            'balance': transaction_data.get('balance'),
            'transaction_number': transaction_data.get('transaction_number'),
            
            # MERCHANT-CENTRIC FIELDS (new approach)
            'merchant_id': merchant_result.get('merchant_id'),
            'merchant_name': merchant_result.get('merchant_name'),  # Replaces clean_description
            
            # DESCRIPTION FIELDS (simplified)
            'original_description': transaction_data.get('name') or transaction_data.get('description'),  # Raw from bank
            'name': transaction_data.get('name'),  # Plaid's name field
            
            # Category fields
            'category_id': category_id,
            'category_name': category_name,
            'primary_category': transaction_data.get('personal_finance_category', {}).get('primary'),
            'detailed_category': transaction_data.get('personal_finance_category', {}).get('detailed'),
            
            # Plaid-specific fields
            'aggregator_transaction_id': transaction_data.get('transaction_id') if source == TransactionSource.PLAID else None,
            'plaid_entity_id': merchant_result.get('aggregator_merchant_id'),
            'logo_url': merchant_result.get('logo_url'),
            'website_url': merchant_result.get('website'),
            'payment_channel': transaction_data.get('payment_channel'),
            'transaction_type': transaction_data.get('transaction_type'),
            'pending': transaction_data.get('pending'),
            'iso_currency_code': transaction_data.get('iso_currency_code'),
            'location': transaction_data.get('location'),
            'payment_meta': transaction_data.get('payment_meta'),
            
            # Processing metadata
            'confidence': merchant_result.get('confidence', 0.0),
            'match_method': merchant_result.get('match_method', 'no_match'),
            'needs_review': merchant_result.get('confidence', 0.0) < 0.8,
            'user_metadata': user_metadata,
            
            # Audit fields
            'created_at': datetime.utcnow().isoformat(),
            'manual_edit': False,
            'review_status': 'unreviewed'
        }
        
        return response
    
    def _process_csv_transaction(self, transaction_data: Dict[str, Any], user_rules: Optional[List] = None) -> Dict[str, Any]:
        """Process CSV transaction with merchant-centric approach"""
        # For CSV transactions, we rely more on description parsing and user rules
        description = transaction_data.get('description', '')
        
        merchant_result = self._parse_merchant_from_description(
            description=description,
            user_id=transaction_data.get('user_id')
        )
        
        # Apply user rules
        if user_rules:
            user_rule_result = self._apply_user_rules(transaction_data, user_rules)
            if user_rule_result:
                merchant_result = self._merge_merchant_data(merchant_result, user_rule_result)
                merchant_result['match_method'] = 'user_rule_override'
        
        return self._build_merchant_centric_response(
            transaction_data=transaction_data,
            merchant_result=merchant_result,
            source=TransactionSource.CSV
        )
    
    def _process_manual_transaction(self, transaction_data: Dict[str, Any], user_rules: Optional[List] = None) -> Dict[str, Any]:
        """Process manually entered transaction"""
        # For manual transactions, user may provide merchant_id or merchant_name directly
        
        merchant_result = None
        
        if transaction_data.get('merchant_id'):
            # User provided merchant_id directly
            merchant_result = self._get_merchant_by_id(transaction_data['merchant_id'])
        elif transaction_data.get('merchant_name'):
            # User provided merchant_name
            merchant_result = self._find_or_create_merchant(
                merchant_name=transaction_data['merchant_name'],
                user_id=transaction_data.get('user_id')
            )
        else:
            # Fallback to description parsing
            description = transaction_data.get('description', '')
            merchant_result = self._parse_merchant_from_description(
                description=description,
                user_id=transaction_data.get('user_id')
            )
        
        if not merchant_result:
            merchant_result = self._create_unknown_merchant()
        
        return self._build_merchant_centric_response(
            transaction_data=transaction_data,
            merchant_result=merchant_result,
            source=TransactionSource.MANUAL
        )
    
    def _get_merchant_by_id(self, merchant_id: str) -> Optional[Dict[str, Any]]:
        """Get merchant by ID from data cache"""
        if not merchant_id or not self.data_cache.merchants:
            return None
        
        for merchant in self.data_cache.merchants:
            if str(merchant.get('merchant_id')) == str(merchant_id):
                return self._format_merchant_result(merchant, 'id_lookup')
        
        return None
    
    def _create_fallback_response(self, transaction_data: Dict[str, Any], source: TransactionSource) -> Dict[str, Any]:
        """Create fallback response when processing fails"""
        return {
            'transaction_id': transaction_data.get('transaction_id'),
            'user_id': transaction_data.get('user_id'),
            'account_id': transaction_data.get('account_id'),
            'amount': transaction_data.get('amount'),
            'date': transaction_data.get('date'),
            'authorized_date': transaction_data.get('authorized_date'),
            'merchant_id': None,
            'merchant_name': 'Processing Error',
            'original_description': transaction_data.get('description', 'Unknown'),
            'category_id': None,
            'category_name': None,
            'confidence': 0.0,
            'match_method': 'error',
            'needs_review': True,
            'user_metadata': {
                'source': source.value,
                'error': 'processing_failed',
                'processing_version': 'merchant_centric_v1'
            }
        }


# Convenience function for backward compatibility
def process_transaction_merchant_centric(
    transaction_data: Dict[str, Any],
    data_cache,
    source: str = "plaid",
    user_rules: Optional[List] = None
) -> Dict[str, Any]:
    """
    Process transaction using the new merchant-centric approach.
    
    This function replaces the old clean_description-based processing
    with proper merchant table relationships.
    """
    processor = MerchantCentricProcessor(data_cache)
    source_enum = TransactionSource(source.lower())
    return processor.process_transaction(transaction_data, source_enum, user_rules)