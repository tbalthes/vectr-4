# Plaid Data Integration

This document outlines all data fields received from Plaid and their usage within the vectr-4 application.

## Overview

Plaid provides secure access to user financial data, which vectr-4 uses for transaction processing, analytics, and account management. Data is retrieved via the backend (`python/app/`), processed in `python/core/`, and integrated into the frontend via API endpoints.

## Data Received from Plaid

### Account Information

- **account_id**: Unique identifier for the account (Plaid)
- **name**: Account name (e.g., "Checking", "Savings")
- **official_name**: Official account name from the institution
- **type**: Account type (e.g., depository, credit, loan)
- **subtype**: Account subtype (e.g., checking, savings, credit card)
- **mask**: Last 2–4 digits of the account number
- **balances**:
    - **available**: Available balance
    - **current**: Current balance
    - **limit**: Credit limit (if applicable)
- **institution_id**: Plaid institution identifier

### Transaction Data

- **transaction_id**: Unique identifier for the transaction
- **account_id**: Associated account
- **amount**: Transaction amount (positive/negative)
- **date**: Transaction date (YYYY-MM-DD)
- **name**: Merchant or transaction description
- **merchant_name**: Merchant name (if available)
- **category**: Array of category strings (e.g., ["Food and Drink", "Restaurants"])
- **category_id**: Plaid category identifier
- **pending**: Boolean indicating if transaction is pending
- **payment_channel**: e.g., "in store", "online"
- **location**:
    - **address**
    - **city**
    - **region**
    - **postal_code**
    - **country**
    - **lat/lon** (if available)
- **iso_currency_code**: Currency code (e.g., "USD")
- **authorized_date**: Date transaction was authorized (if different from posted date)

### Identity Data (if enabled)

- **names**: Array of user names
- **emails**: Array of email addresses
- **addresses**: Array of address objects
- **phone_numbers**: Array of phone numbers

### Institution Data

- **institution_id**: Plaid institution identifier
- **name**: Institution name (e.g., "Chase", "Bank of America")

## Usage in vectr-4

- **Transaction Processing**: Data is parsed and matched in `python/core/matching.py` and `src/lib/transaction_processing.js`.
- **Account Display**: Account and balance info shown in dashboard components.
- **Analytics**: Categories and amounts used for spending analysis.
- **Authentication**: Plaid tokens are securely managed; no sensitive data is stored in the frontend.

## Security & Privacy

- All Plaid data is handled according to best practices.
- Sensitive tokens and credentials are stored in environment variables (`.env`).
- Only necessary fields are persisted; PII is minimized.

---

For more details, see backend integration in `python/app/` and transaction logic in `src/lib/transaction_processing.js`.