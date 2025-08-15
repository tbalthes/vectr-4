import os
from supabase_py import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)