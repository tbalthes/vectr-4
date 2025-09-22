"""
Unified transaction processor for Plaid data source.
This processor is designed to work with the new database schema,
focusing on processing Plaid transactions and enriching them with
merchant and category data.
"""

from typing import Dict, Any, Optional
from enum import Enum
import re

class TransactionSource(str, Enum):
    """Enumeration of transaction data sources"""
    PLAID = "plaid"

class PlaidTransactionProcessor:
    """
    Processes Plaid transactions, enriches them with merchant and category data,
    and prepares them for insertion into the database.
    """
    
    def __init__(self, data_cache, supabase_client):
        """
        Initialize with data cache and Supabase client.
        """
        self.data_cache = data_cache
        self.supabase = supabase_client
    
    def process_transactions_batch(self, transactions: list[Dict[str, Any]], user_id: str) -> list[Dict[str, Any]]:
        """
        Main entry point for processing a batch of Plaid transactions.
        """
        if not transactions:
            return []

        # 1. Batch fetch all required data
        account_id_map = self._get_account_id_map(transactions, user_id)

        # 2. Process each transaction using the cached data
        processed_transactions = []
        for transaction_data in transactions:
            try:
                processed_transaction = self._process_single_transaction(transaction_data, account_id_map)
                processed_transactions.append(processed_transaction)
            except Exception as e:
                print(f"Error processing transaction {transaction_data.get('transaction_id')}: {e}")
                fallback_record = self._create_fallback_response(transaction_data)
                processed_transactions.append(fallback_record)
        
        return processed_transactions

    def _get_account_id_map(self, transactions: list[Dict[str, Any]], user_id: str) -> Dict[str, str]:
        """
        Fetches all necessary accounts from the database in a single batch
        and returns a map of Plaid account ID to internal account ID.
        """
        plaid_account_ids = {t['account_id'] for t in transactions if isinstance(t, dict) and 'account_id' in t}
        if not plaid_account_ids:
            return {}

        response = self.supabase.table('accounts').select('account_id, aggregator_account_id') \
            .in_('aggregator_account_id', list(plaid_account_ids)) \
            .eq('user_id', user_id) \
            .execute()

        if response.data:
            return {
                account['aggregator_account_id']: account['account_id']
                for account in response.data
                if account.get('aggregator_account_id') and account.get('account_id')
            }

        return {}

    def _process_single_transaction(self, transaction_data: Dict[str, Any], account_id_map: Dict[str, str]) -> Dict[str, Any]:
        """
        Processes a single transaction using pre-fetched data.
        """
        # 1. Extract key fields
        original_description = transaction_data.get('name', '')
        plaid_merchant_name = transaction_data.get('merchant_name')
        counterparties = transaction_data.get('counterparties', [])
        
        # 2. Determine the best merchant name
        merchant_name = self._get_best_merchant_name(plaid_merchant_name, counterparties, original_description)
        
        # 3. Match or create merchant
        merchant_match = self._find_or_create_merchant(merchant_name, counterparties)
        
        # 4. Determine category
        category_id = self._determine_category(transaction_data, merchant_match)
        
        # 5. Get internal account_id from the map
        plaid_account_id = transaction_data.get('account_id')
        internal_account_id = account_id_map.get(plaid_account_id) if isinstance(plaid_account_id, str) else None

        if not internal_account_id:
            print(f"❌ No internal account found for Plaid account: {plaid_account_id}")
            # Decide how to handle this - skip, or insert with null account_id, etc.
            # For now, we'll allow it to be null and proceed.
        
        # 6. Build the final transaction record
        return self._build_transaction_record(transaction_data, merchant_match, category_id, internal_account_id)

    def process_transaction(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main entry point for processing a single Plaid transaction.
        """
        try:
            # 1. Extract key fields from Plaid payload
            original_description = transaction_data.get('name', '')
            plaid_merchant_name = transaction_data.get('merchant_name')
            counterparties = transaction_data.get('counterparties', [])
            
            # 2. Determine the best merchant name
            merchant_name = self._get_best_merchant_name(plaid_merchant_name, counterparties, original_description)
            
            # 3. Match or create merchant
            merchant_match = self._find_or_create_merchant(merchant_name, counterparties)
            
            # 4. Determine category
            category_id = self._determine_category(transaction_data, merchant_match)
            
            # 5. Build the final transaction record for insertion
            # Note: without a user context map, internal_account_id may be unknown here
            return self._build_transaction_record(transaction_data, merchant_match, category_id, None)
            
        except Exception as e:
            print(f"Error processing transaction: {e}")
            return self._create_fallback_response(transaction_data)

    def _get_best_merchant_name(self, plaid_merchant_name, counterparties, original_description):
        if counterparties and counterparties[0].get('name'):
            return counterparties[0]['name']
        if plaid_merchant_name:
            return plaid_merchant_name
        return original_description

    def _find_or_create_merchant(self, merchant_name: str, counterparties: list) -> Optional[Dict[str, Any]]:
        """
        Find an existing merchant or create a new one based on Plaid data.
        If a high-confidence counterparty is available, use it to enrich the merchants table.
        """
        if not merchant_name:
            return None

        # Use Plaid's entity_id for the most reliable matching
        plaid_entity_id = counterparties[0].get('entity_id') if counterparties else None
        if plaid_entity_id:
            merchant = self._find_merchant_by_plaid_entity_id(plaid_entity_id)
            if merchant:
                return merchant

        # Fallback to name matching
        merchant = self._find_merchant_by_name(merchant_name)
        if merchant:
            # If we found a merchant by name, but now have a plaid_entity_id, update it
            if plaid_entity_id and not merchant.get('plaid_entity_id'):
                self._update_merchant_plaid_entity_id(merchant['merchant_id'], plaid_entity_id)
            return merchant

        # If no merchant is found, create a new one, especially if we have high-confidence data
        if counterparties and counterparties[0].get('confidence_level') == 'VERY_HIGH':
            return self._create_merchant_from_plaid_data(counterparties[0])
            
        return None

    def _find_merchant_by_plaid_entity_id(self, plaid_entity_id: str) -> Optional[Dict[str, Any]]:
        """Find a merchant by their Plaid entity ID."""
        res = self.supabase.table("merchants").select("*").eq("plaid_entity_id", plaid_entity_id).single().execute()
        return res.data if res.data else None

    def _find_merchant_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find a merchant by name (case-insensitive)."""
        res = self.supabase.table("merchants").select("*").ilike("name", f"%{name}%").limit(1).execute()
        return res.data[0] if res.data else None

    def _update_merchant_plaid_entity_id(self, merchant_id: str, plaid_entity_id: str):
        """Update an existing merchant with a Plaid entity ID."""
        self.supabase.table("merchants").update({"plaid_entity_id": plaid_entity_id}).eq("merchant_id", merchant_id).execute()

    def _create_merchant_from_plaid_data(self, counterparty: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new merchant in the database from high-confidence Plaid counterparty data."""
        new_merchant = {
            "name": counterparty['name'],
            "plaid_entity_id": counterparty.get('entity_id'),
            "logo_url": counterparty.get('logo_url'),
            "website": counterparty.get('website'),
            # You might want to map Plaid's category to your default_category_id here
        }
        res = self.supabase.table("merchants").insert(new_merchant).execute()
        return res.data[0] if res.data else None

    def _determine_category(self, transaction_data: Dict[str, Any], merchant_match: Optional[Dict[str, Any]]) -> Optional[str]:
        """Determine the category for the transaction."""
        # 1. If merchant has a default category, use it.
        if merchant_match and merchant_match.get('default_category_id'):
            return merchant_match['default_category_id']
        
        # 2. Use Plaid's personal finance category
        pfc = transaction_data.get('personal_finance_category')
        if pfc and pfc.get('detailed'):
            # This is where you would map Plaid's detailed category string 
            # (e.g., "FOOD_AND_DRINK_RESTAURANT") to your internal UUID-based category_id.
            # This typically requires a lookup table in your database or a hardcoded map.
            
            # Example using the data_cache:
            category_mapping = self.data_cache.get_plaid_category_map() # Assuming this method exists
            internal_category_id = category_mapping.get(pfc['detailed'])
            if internal_category_id:
                return internal_category_id
            
        return None

    def _build_transaction_record(self, transaction_data: Dict[str, Any], merchant_match: Optional[Dict[str, Any]], category_id: Optional[str], internal_account_id: Optional[str]) -> Dict[str, Any]:
        """Build the final dictionary to be inserted into the transactions table."""
        counterparty = transaction_data.get('counterparties', [{}])[0]

        record = {
            "user_id": transaction_data.get('user_id'), # Make sure user_id is passed in
            "account_id": internal_account_id,
            "original_description": transaction_data.get('name'),
            "amount": transaction_data.get('amount'),
            "currency": transaction_data.get('iso_currency_code'),
            "date": transaction_data.get('date'),
            "authorized_date": transaction_data.get('authorized_date'),
            "pending": transaction_data.get('pending', False),
            "aggregator_transaction_id": transaction_data.get('transaction_id'),
            
            "merchant_id": merchant_match.get('merchant_id') if merchant_match else None,
            "merchant_name": merchant_match.get('name') if merchant_match else self._get_best_merchant_name(transaction_data.get('merchant_name'), transaction_data.get('counterparties', []), transaction_data.get('name')),
            
            "category_id": category_id,
            
            "transaction_type": counterparty.get('type'),
            "logo_url": counterparty.get('logo_url'),
            "website": counterparty.get('website'),
            "plaid_entity_id": counterparty.get('entity_id'),
            
            "primary_category": transaction_data.get('personal_finance_category', {}).get('primary'),
            "detailed_category": transaction_data.get('personal_finance_category', {}).get('detailed'),
            "category_confidence_level": transaction_data.get('personal_finance_category', {}).get('confidence_level'),
            
            "payment_channel": transaction_data.get('payment_channel'),
            "check_number": transaction_data.get('check_number'),
            "location": transaction_data.get('location'),
            "payment_meta": transaction_data.get('payment_meta'),
            
            "needs_review": not merchant_match or not category_id,
        }
        return record

    def _create_fallback_response(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a fallback transaction record when processing fails, 
        ensuring essential data is still captured.
        """
        return {
            "user_id": transaction_data.get('user_id'),
            "account_id": None, # Cannot determine internal account_id
            "original_description": transaction_data.get('name'),
            "amount": transaction_data.get('amount'),
            "currency": transaction_data.get('iso_currency_code'),
            "date": transaction_data.get('date'),
            "pending": transaction_data.get('pending', False),
            "aggregator_transaction_id": transaction_data.get('transaction_id'),
            "merchant_name": transaction_data.get('merchant_name') or transaction_data.get('name'),
            "category_id": None,
            "status": "needs_review", # Add a status field
            "raw_data": transaction_data # Store the original payload for later inspection
        }
