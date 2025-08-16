# In python/app/dependencies.py

from supabase_client.client import supabase
from data_cache import DataCache

def get_supabase_client():
    # This function is the "dependency". FastAPI will call it.
    # It simply returns the client instance we created.
    return supabase

def get_data_cache():
    """
    FastAPI dependency to provide access to the global DataCache instance.
    Loads tables on first use.
    """
    cache = DataCache()
    if not cache.global_regex_rules or not cache.mcc_category_map or not cache.categories:
        cache.load_all_tables()
    return cache