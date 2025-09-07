from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Dict, Any, List, Optional
import pandas as pd
import json
from io import StringIO
from datetime import datetime
import logging
import sys
import os

# Add the parent directory to Python path to import core modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from core.transaction_processor import process_transaction
from ..dependencies import get_supabase_client, get_data_cache

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/process-csv")
async def process_csv(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    account_id: str = Form(...),
    mapping: str = Form(...),
    supabase=Depends(get_supabase_client),
    data_cache=Depends(get_data_cache)
):
    """
    Process a CSV file and return normalized transactions
    """
    try:
        # Validate file type
        if not file.filename or not file.filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
        # Parse the mapping configuration
        try:
            mapping_config = json.loads(mapping)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid mapping configuration")
        
        # Read CSV content
        contents = await file.read()
        csv_content = contents.decode('utf-8')
        
        # Parse CSV into DataFrame
        df = pd.read_csv(StringIO(csv_content))
        
        if df.empty:
            raise HTTPException(status_code=400, detail="CSV file is empty")
        
        # Process transactions based on mapping
        normalized_transactions = []
        processing_errors = []
        
        for row_num, (index, row) in enumerate(df.iterrows(), 1):
            try:
                # Extract transaction data based on mapping
                transaction_data = extract_transaction_data(row, mapping_config)
                
                # Add user and account info
                transaction_data['user_id'] = user_id
                transaction_data['account_id'] = account_id
                
                # Process the transaction using the process_transaction function
                normalized_transaction = process_transaction(transaction_data, data_cache)
                
                normalized_transactions.append(normalized_transaction)
                
            except Exception as e:
                error_msg = f"Row {row_num}: {str(e)}"
                processing_errors.append(error_msg)
                logger.warning(f"Failed to process row {row_num}: {e}")
        
        # Generate summary
        summary = {
            "total_rows": len(df),
            "processed_successfully": len(normalized_transactions),
            "errors": len(processing_errors),
            "date_range": get_date_range(normalized_transactions),
            "amount_summary": get_amount_summary(normalized_transactions)
        }
        
        # Optionally save to database
        if normalized_transactions:
            # Save transactions to database here if needed
            # result = supabase.table('transactions').insert(normalized_transactions).execute()
            pass
        
        return {
            "success": True,
            "transactions": normalized_transactions,
            "summary": summary,
            "processed_count": len(normalized_transactions),
            "errors": processing_errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")

def extract_transaction_data(row: pd.Series, mapping: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract transaction data from a CSV row based on column mapping
    """
    transaction = {}
    
    # Map required fields
    if mapping.get('transactionNumber'):
        transaction['transaction_number'] = row.get(mapping['transactionNumber'], '')
    
    if mapping.get('description'):
        transaction['description'] = row.get(mapping['description'], '')
    
    if mapping.get('date'):
        transaction['date'] = row.get(mapping['date'], '')
    
    if mapping.get('balance'):
        transaction['balance'] = row.get(mapping['balance'], '')
    
    # Handle amount columns (might be multiple columns that need combining)
    amount_columns = mapping.get('amountColumns', [])
    if amount_columns:
        total_amount = 0
        for col in amount_columns:
            value = row.get(col, 0)
            if pd.notna(value) and value != '':
                try:
                    # Clean and convert amount
                    cleaned_value = str(value).replace('$', '').replace(',', '').strip()
                    total_amount += float(cleaned_value)
                except (ValueError, TypeError):
                    pass
        transaction['amount'] = total_amount
    
    # Add custom fields
    custom_fields = mapping.get('customFields', {})
    user_metadata = {}
    for field_name, column_name in custom_fields.items():
        if column_name in row:
            user_metadata[field_name] = row[column_name]
    
    if user_metadata:
        transaction['user_metadata'] = user_metadata
    
    return transaction

def get_date_range(transactions: List[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    """
    Get the date range from processed transactions
    """
    if not transactions:
        return None
    
    dates = []
    for txn in transactions:
        if 'date' in txn and txn['date']:
            try:
                # Parse date (you might need to adjust this based on your date format)
                date_obj = pd.to_datetime(txn['date'])
                dates.append(date_obj)
            except:
                continue
    
    if dates:
        return {
            "earliest": min(dates).strftime('%Y-%m-%d'),
            "latest": max(dates).strftime('%Y-%m-%d')
        }
    
    return None

def get_amount_summary(transactions: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Get amount summary from processed transactions
    """
    amounts = [txn.get('amount', 0) for txn in transactions if 'amount' in txn]
    
    if not amounts:
        return {"total": 0, "average": 0, "min": 0, "max": 0}
    
    return {
        "total": sum(amounts),
        "average": sum(amounts) / len(amounts),
        "min": min(amounts),
        "max": max(amounts)
    }
