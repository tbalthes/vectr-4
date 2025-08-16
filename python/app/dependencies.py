# In python/app/dependencies.py
from supabase_client.client import supabase

def get_supabase_client():
    # This function is the "dependency". FastAPI will call it.
    # It simply returns the client instance we created.
    return supabase