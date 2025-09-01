#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'python'))

from python.supabase_client.client import supabase

def check_icons():
    response = supabase.table('categories').select('id,name,icon').limit(20).execute()
    
    print("Category Icons in Database:")
    print("-" * 50)
    for cat in response.data:
        print(f"ID: {cat['id']}")
        print(f"Name: {cat['name']}")
        print(f"Icon: {cat['icon']}")
        print("-" * 30)

if __name__ == "__main__":
    check_icons()
