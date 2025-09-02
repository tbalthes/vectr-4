# Add "balance" as a Pass-Through Field in Transaction Processing API

## Objective

Update the transaction processing API so that the `balance` field from each input transaction is included, unchanged, in the output for each processed transaction. This should be a pass-through: the API should not calculate or modify the balance, but simply return the value provided in the input.

## Context

- The backend is a FastAPI app in `python/app/`.
- Transaction processing logic is in `python/core/transaction_processor.py`.
- The API endpoint is `/transactions/process-upload-local` (see `python/app/routers/transactions.py`).
- Input transactions may now include a `balance` field (float or string).
- The output for each transaction should include the same `balance` value as in the input, even after enrichment/processing.

## Requirements

1. **Input Model Update:**  
   - Update the Pydantic `Transaction` model in `python/app/routers/transactions.py` to include an optional `balance` field.

2. **Processing Logic:**  
   - Ensure that the `balance` field is passed through all processing steps in `process_upload_and_return_locally` and any called functions (e.g., in `transaction_processor.py`).
   - The output for each transaction must include the original `balance` value, unchanged.

3. **Output:**  
   - The API response for `/transactions/process-upload-local` must include the `balance` field for each transaction if it was present in the input.

4. **Documentation:**  
   - Update or add docstrings/comments to clarify that `balance` is a pass-through field.
   - Optionally, update `TRANSACTION_PROCESSING_API.md` to document the new field.

## Example

**Input:**
```json
{
  "account_id": "abc123",
  "transactions": [
    {
      "date": "2024-08-01",
      "transaction_number": "TXN001",
      "description": "COFFEE SHOP",
      "amount": -4.50,
      "balance": 995.50
    }
  ]
}
```

**Output:**
```json
[
  {
    "date": "2024-08-01",
    "transaction_number": "TXN001",
    "description": "COFFEE SHOP",
    "amount": -4.50,
    "balance": 995.50,
    "merchant_id": "...",
    "merchant_name": "...",
    "category_id": "...",
    "category_name": "...",
    "confidence": 1.0,
    "match_method": "global_regex"
  }
]
```

## Constraints

- Do **not** calculate or modify the balance in backend logic.
- If `balance` is missing in the input, it may be omitted in the output.
- Preserve all other existing enrichment and processing logic.

---

**Files to update:**  
- `python/app/routers/transactions.py` (Pydantic model, endpoint logic)  
- `python/core/transaction_processor.py` (if needed for pass-through)  
- `python/TRANSACTION_PROCESSING_API.md