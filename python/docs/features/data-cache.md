# Data Caching in vectr-4 Backend

## Overview

The vectr-4 backend uses an in-memory, thread-safe singleton cache (`DataCache`) to store lookup tables required for transaction processing. This cache is designed for high performance and to minimize repeated database (Supabase) queries.

## Key Features

- **Singleton Pattern:** Only one instance of the cache exists per Python process. All API requests share this instance.
- **Thread-Safe:** Uses locks to ensure safe concurrent access.
- **Tables Cached:**
  - `global_regex_rules`
  - `mcc_category_map`
  - `categories`
- **Refresh Logic:**
  - Tables are loaded on first use (when `last_refresh` is `None`).
  - Tables can be explicitly refreshed via the API by sending a special transaction (i.e. making a POST transaction with 'REFRESH DATA TABLES' as `original_description`).
  - The cache exposes both UTC and Phoenix local time for the last refresh.
- **API Status Endpoint:** `/data-table-status/` returns cache status, including last refresh times and table counts.

## How It Works

- The singleton instance is created at the module level (e.g., `cache_instance = DataCache()` in `data_cache.py`).
- The FastAPI dependency (`get_data_cache`) always returns this instance.
- On first use, or after an explicit refresh, the cache loads all tables from Supabase and updates `last_refresh` and `last_refresh_phoenix`.
- The cache is not reloaded on every request—only on first use or explicit refresh.

## Example: Status API Response

```json
{
  "last_refresh": "2025-08-16T23:24:50.617546",
  "last_refresh_phoenix": "2025-08-16T16:24:50.617546-07:00",
  "global_regex_rules_count": 172,
  "mcc_category_map_count": 978,
  "categories_count": 56
}
```

## How to Change Data Caching Parameters

### 1. Ensure Singleton Behavior

- In `data_cache.py`, define the cache at the module level:
  ```python
  cache_instance = DataCache()
  ```
- In your FastAPI dependency (`app/dependencies.py`):
  ```python
  from data_cache import cache_instance
  def get_data_cache():
      if cache_instance.last_refresh is None:
          cache_instance.load_all_tables()
      return cache_instance
  ```

### 2. Control When the Cache Refreshes

- The cache only refreshes on first use or when you explicitly call `refresh()`.
- To force a refresh, call the `refresh()` method on the cache instance, or trigger it via an API endpoint or special transaction.

### 3. Add/Remove Cached Tables

- To cache additional tables, update the `load_all_tables()` method in `DataCache` to fetch and store them.
- Update the status endpoint to include counts for new tables if needed.

### 4. Change Timezone Handling

- The cache records both UTC and Phoenix local time for `last_refresh`.
- To change the local timezone, update the timezone in the cache logic (currently uses `America/Phoenix` via `pytz`).

## Troubleshooting

- If `last_refresh` always shows the current time, ensure the singleton is defined at the module level and not re-instantiated on every request.
- If using FastAPI's `--reload`, be aware that code reloads can reset the singleton.

---

For further customization, edit `python/data_cache.py` and `python/app/dependencies.py` as described above.
