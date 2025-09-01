#!/usr/bin/env python3
import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'python'))
from python.supabase_client.client import supabase

def check_category_icons():
    try:
        result = supabase.table('categories').select('id, name, icon').limit(10).execute()
        
        print("Category icons in database:")
        print("-" * 50)
        for cat in result.data:
            icon = cat.get('icon', '')
            print(f"ID: {cat['id']}")
            print(f"Name: {cat['name']}")
            print(f"Icon: '{icon}' (length: {len(icon) if icon else 0})")
            if icon:
                print(f"Icon bytes: {[ord(c) for c in icon]}")
            print("-" * 30)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_category_icons()
