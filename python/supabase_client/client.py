import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

url = os.environ.get("SUPABASE_URL")
anon_key = os.environ.get("SUPABASE_KEY")

if not url:
    raise EnvironmentError("SUPABASE_URL must be set in the .env file")
if not anon_key:
    raise EnvironmentError("SUPABASE_KEY must be set in the .env file")

supabase = create_client(url, anon_key)