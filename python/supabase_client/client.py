import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

url = os.environ.get("SUPABASE_URL")
# Prefer a service role key for server-side operations to avoid RLS restrictions
service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
anon_key = os.environ.get("SUPABASE_KEY")

if not url:
    raise EnvironmentError("SUPABASE_URL must be set in the .env file")

if service_role_key:
    key = service_role_key
    print("Using SUPABASE_SERVICE_ROLE_KEY for server-side Supabase client")
elif anon_key:
    key = anon_key
    print("Warning: SUPABASE_KEY (anon) is being used for server-side Supabase client — this may be blocked by Row Level Security policies")
else:
    raise EnvironmentError("Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY must be set in the .env file")

supabase = create_client(url, key)