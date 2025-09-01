# Categories Tree API Implementation

## Overview

The GET `/user_rules/categories/tree` endpoint provides hierarchical category data for the UI with proper parent-child relationships, sorting, and optional transaction counts.

## API Endpoint

### GET /user_rules/categories/tree

Returns all categories organized in a hierarchical tree structure.

**Query Parameters:**

- `include_counts` (boolean, optional): Include transaction counts for each category (default: false)

**Response Model:**

```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Food & Dining",
      "parent_id": null,
      "children": [
        {
          "id": "uuid",
          "name": "Restaurants",
          "parent_id": "parent_uuid",
          "children": [
            {
              "id": "uuid",
              "name": "Fast Food",
              "parent_id": "parent_uuid",
              "children": [],
              "transaction_count": 15,
              "is_user_created": false
            }
          ],
          "transaction_count": 23,
          "is_user_created": false
        }
      ],
      "transaction_count": 45,
      "is_user_created": false
    }
  ],
  "total_categories": 12,
  "max_depth": 3
}
```

## Implementation Details

### Data Models

**CategoryNode:**

- `id`: String - Category UUID
- `name`: String - Category display name
- `parent_id`: Optional String - Parent category UUID (null for root categories)
- `children`: List[CategoryNode] - Child categories
- `transaction_count`: Optional Integer - Transaction count (only when include_counts=true)
- `is_user_created`: Boolean - Whether this is a user-created custom category

**CategoriesTreeResponse:**

- `categories`: List[CategoryNode] - Root-level categories with nested children
- `total_categories`: Integer - Total number of categories
- `max_depth`: Integer - Maximum depth of the tree

### Core Features

1. **Hierarchical Structure**: Builds proper parent-child relationships from flat category data
2. **Alphabetical Sorting**: Categories are sorted alphabetically at each level
3. **Transaction Counts**: Optional aggregation of transaction counts per category
4. **Tree Metadata**: Provides total count and maximum depth information
5. **Custom Categories**: Identifies user-created categories vs system categories
6. **Error Handling**: Graceful degradation when data sources are unavailable

### Helper Functions

**`_build_category_tree(categories, include_counts=False)`**

- Converts flat category list into hierarchical tree structure
- Handles parent-child relationships
- Sorts categories alphabetically
- Optionally includes transaction counts

**`_calculate_tree_depth(categories)`**

- Recursively calculates maximum depth of the category tree
- Returns 0 for empty trees

### Transaction Count Integration

When `include_counts=true`, the endpoint:

1. Calls the `aggregate_time_series` RPC function to get transaction counts per category
2. Maps counts to categories by `primary_category_id`
3. Gracefully handles RPC failures by continuing without counts
4. Includes counts in the response for UI display

## Usage Examples

### Basic Tree Structure

```http
GET /user_rules/categories/tree
```

### Tree with Transaction Counts

```http
GET /user_rules/categories/tree?include_counts=true
```

## Testing

The implementation includes comprehensive unit tests covering:

- **Helper Functions**: Tree building logic, depth calculation, empty data handling
- **Endpoint Success Cases**: Tree structure without/with counts, sorting verification
- **Error Handling**: Malformed data, dependency failures
- **Edge Cases**: Empty categories, deep hierarchies, custom categories

All tests use mock dependencies to ensure isolated testing without external dependencies.

## Integration Notes

- **Data Cache**: Retrieves categories from the centralized data cache
- **Supabase Integration**: Uses RPC calls for transaction count aggregation
- **FastAPI**: Proper dependency injection and response models
- **Frontend Ready**: Structure designed for easy consumption by tree UI components

The endpoint is ready for use in category selection dropdowns, tree views, and administrative interfaces requiring hierarchical category data.
