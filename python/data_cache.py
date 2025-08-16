import threading
import datetime
from typing import List, Dict, Any, Optional
from supabase_client.client import supabase

class DataCache:
    """
    Thread-safe singleton cache for global lookup tables used in transaction processing.
    Loads all tables from Supabase on first use, and can be refreshed on demand.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, '_initialized', False):
            return
        self.global_regex_rules: List[Dict[str, Any]] = []
        self.mcc_category_map: List[Dict[str, Any]] = []
        self.categories: List[Dict[str, Any]] = []
        self.last_refresh: Optional[datetime.datetime] = None
        self._cache_lock = threading.Lock()
        self._initialized = True

    def load_all_tables(self):
        """Fetch all required tables from Supabase and store in memory. Updates last_refresh timestamp."""
        with self._cache_lock:
            self.global_regex_rules = self._fetch_table('global_regex_rules')
            self.mcc_category_map = self._fetch_table('mcc_category_map')
            self.categories = self._fetch_table('categories')
            self.last_refresh = datetime.datetime.utcnow()

    def refresh(self):
        """Refresh all tables from Supabase (force reload)."""
        self.load_all_tables()

    def _fetch_table(self, table_name: str) -> List[Dict[str, Any]]:
        try:
            response = supabase.table(table_name).select('*').execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"Error fetching {table_name}: {e}")
            return []

# Usage:
# cache = DataCache()
# cache.load_all_tables()  # On first use
# cache.refresh()          # To force refresh
