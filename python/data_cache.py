import threading
import datetime
import pytz
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
        self.merchants: List[Dict[str, Any]] = []
        self.last_refresh: Optional[datetime.datetime] = None
        self._cache_lock = threading.Lock()
        self._initialized = True

    def load_all_tables(self):
        """Fetch all required tables from Supabase and store in memory. Updates last_refresh timestamp."""
        with self._cache_lock:
            print("[DataCache] Loading all tables from Supabase...")
            self.global_regex_rules = self._fetch_table('global_regex_rules')
            print(f"[DataCache] Loaded {len(self.global_regex_rules)} global_regex_rules")
            self.mcc_category_map = self._fetch_table('mcc_category_map')
            print(f"[DataCache] Loaded {len(self.mcc_category_map)} mcc_category_map entries")
            self.categories = self._fetch_table('categories')
            print(f"[DataCache] Loaded {len(self.categories)} categories")
            self.merchants = self._fetch_table('merchants')
            print(f"[DataCache] Loaded {len(self.merchants)} merchants")
            self.last_refresh = datetime.datetime.utcnow()
            # Also store local Phoenix time for convenience
            phoenix_tz = pytz.timezone('America/Phoenix')
            self.last_refresh_phoenix = self.last_refresh.replace(tzinfo=pytz.utc).astimezone(phoenix_tz)

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
