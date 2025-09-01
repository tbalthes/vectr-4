# Merchants API - Read-Only Lookup

## Overview

The merchants API provides read-only access to the merchant lookup table. This table contains a curated list of merchants that can be searched and referenced in transaction processing, but cannot be modified by users.

## API Endpoints

### GET /merchants/search

Searches for merchants by name with optional filters and pagination.

**Query Parameters:**

- `q` (required): Search query for merchant names
- `category_id` (optional): Filter by category ID
- `limit` (optional): Maximum number of results (default: 50, max: 100)
- `offset` (optional): Number of results to skip (default: 0)

**Response:**

```json
{
  "merchants": [
    {
      "id": "uuid",
      "name": "McDonald's",
      "category_id": "ad9101d3-c946-4daf-a4ab-b19f4a3ce85f",
      "category_name": "Fast Food",
      "logo_url": "https://logo.clearbit.com/mcdonalds.com",
      "aliases": null,
      "created_at": "2024-01-01T00:00:00",
      "updated_at": null
    }
  ],
  "total_count": 1,
  "has_more": false
}
```

### GET /merchants/{merchant_id}

Retrieves a specific merchant by ID.

**Response:**

```json
{
  "id": "uuid",
  "name": "McDonald's",
  "category_id": "ad9101d3-c946-4daf-a4ab-b19f4a3ce85f",
  "category_name": "Fast Food",
  "logo_url": "https://logo.clearbit.com/mcdonalds.com",
  "aliases": null,
  "created_at": "2024-01-01T00:00:00",
  "updated_at": null
}
```

## Implementation Details

### Data Models

**MerchantResponse:**

- `id`: String - Merchant UUID
- `name`: String - Merchant name
- `category_id`: Optional String - Default category UUID
- `category_name`: Optional String - Category display name
- `logo_url`: Optional String - Logo URL
- `aliases`: Optional List[String] - Alternative names
- `created_at`: Optional String - Creation timestamp
- `updated_at`: Optional String - Last update timestamp

**MerchantSearchResponse:**

- `merchants`: List[MerchantResponse] - Matching merchants
- `total_count`: Integer - Total number of matches
- `has_more`: Boolean - Whether more results are available

### Core Features

1. **Merchant Search**: Case-insensitive partial name matching
2. **Category Integration**: Associates merchants with categories and provides category names
3. **Pagination Support**: Efficient pagination with limit/offset
4. **Data Cache Integration**: Uses cached merchant data for fast lookups
5. **Comprehensive Validation**: UUID format validation, query validation

### Database Schema Integration

The implementation works with the existing merchants table schema:

- `id`: Primary key UUID
- `name`: Merchant name
- `default_category_id`: Foreign key to categories table
- `logo_url`: Optional logo URL
- `aliases`: JSON array of alternative names
- `created_at`: Creation timestamp

### Error Handling

- **400 Bad Request**: Invalid input data (empty queries, invalid UUIDs)
- **404 Not Found**: Merchant not found by ID
- **422 Unprocessable Entity**: Validation errors (invalid UUIDs, empty search queries)
- **500 Internal Server Error**: Unexpected failures

## Testing

The implementation includes comprehensive unit tests covering:

- **Search Functionality**: Name-based search, category filtering, pagination
- **Individual Retrieval**: Getting merchants by ID, handling not found cases
- **Validation Errors**: Invalid queries, malformed UUIDs
- **Error Scenarios**: Invalid requests, empty queries

All tests use mock dependencies to ensure isolated testing without database dependencies.

## Usage Examples

### Searching for Merchants

```http
GET /merchants/search?q=coffee&limit=10
```

### Searching with Category Filter

```http
GET /merchants/search?q=fast&category_id=ad9101d3-c946-4daf-a4ab-b19f4a3ce85f
```

### Getting a Specific Merchant

```http
GET /merchants/a9a55d37-f6ba-4802-9180-822b9a975d05
```

## Integration Notes

- **Read-Only Access**: Merchants table is a lookup table - no creation, updates, or deletion
- **Data Cache**: Uses cached merchant data for fast lookups and category enrichment
- **Categories**: Integrates with existing category system for validation and enrichment
- **FastAPI**: Full FastAPI integration with dependency injection and response models
- **Frontend Ready**: Structure designed for easy consumption by transaction editing interfaces

The merchants API provides reliable access to the merchant lookup table, allowing applications to search and reference merchants without the ability to modify the curated data.
