#!/usr/bin/env python3
"""
Test script for user rules endpoints.
Run this to verify all user rules endpoints are working correctly.
"""

import requests
import json
from datetime import datetime
import uuid

# Configuration
BASE_URL = "http://localhost:8000"
TEST_USER_ID = str(uuid.uuid4())  # Generate a test user ID

def test_endpoint(method, endpoint, data=None, params=None, expected_status=200):
    """Test an endpoint and return the result."""
    url = f"{BASE_URL}{endpoint}"
    response = None
    
    try:
        if method == "GET":
            response = requests.get(url, params=params)
        elif method == "POST":
            response = requests.post(url, json=data, params=params)
        elif method == "PUT":
            response = requests.put(url, json=data, params=params)
        elif method == "DELETE":
            response = requests.delete(url, params=params)
        else:
            print(f"ERROR: Unsupported method {method}")
            return None
        
        print(f"\n{method} {endpoint}")
        print(f"Status: {response.status_code} (expected: {expected_status})")
        
        if response.status_code != expected_status:
            print(f"ERROR: Unexpected status code")
            if response.text:
                print(f"Response: {response.text[:500]}")
            return None
            
        if response.content:
            result = response.json()
            if isinstance(result, dict) and len(str(result)) > 1000:
                # Truncate long responses
                print(f"Response keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
                if 'total' in result:
                    print(f"Total items: {result.get('total')}")
            else:
                print(f"Response: {json.dumps(result, indent=2)[:500]}...")
            return result
        else:
            print("Response: (empty)")
            return {}
            
    except Exception as e:
        print(f"ERROR testing {method} {endpoint}: {e}")
        return None

def main():
    """Run all user rules endpoint tests."""
    print("=== User Rules API Test Suite ===")
    print(f"Testing against: {BASE_URL}")
    print(f"Test user ID: {TEST_USER_ID}")
    
    # Test 1: Categories tree (no user required)
    print("\n" + "="*50)
    print("TEST 1: Get Categories Tree")
    categories_result = test_endpoint("GET", "/user_rules/categories/tree")
    
    if categories_result and 'categories' in categories_result:
        print(f"✓ Found {len(categories_result['categories'])} root categories")
        # Get a test category ID
        test_category_id = None
        if categories_result['categories']:
            test_category_id = categories_result['categories'][0]['id']
            print(f"✓ Using test category ID: {test_category_id}")
    else:
        print("✗ Failed to get categories")
        return
    
    # Test 2: Get user rules (empty list expected)
    print("\n" + "="*50)
    print("TEST 2: Get User Rules (should be empty)")
    test_endpoint("GET", "/user_rules", params={"user_id": TEST_USER_ID})
    
    # Test 3: Create a user rule
    print("\n" + "="*50)
    print("TEST 3: Create User Rule")
    if test_category_id:
        new_rule = {
            "user_id": TEST_USER_ID,
            "match_field": "description",
            "match_operator": "contains", 
            "match_value": "COFFEE",
            "category_id": test_category_id,
            "priority": 100,
            "description": "Categorize coffee purchases"
        }
        created_rule = test_endpoint("POST", "/user_rules", data=new_rule, expected_status=200)
        
        if created_rule and 'id' in created_rule:
            rule_id = created_rule['id']
            print(f"✓ Created rule with ID: {rule_id}")
            
            # Test 4: Get user rules (should have 1 rule)
            print("\n" + "="*50)
            print("TEST 4: Get User Rules (should have 1 rule)")
            rules_result = test_endpoint("GET", "/user_rules", params={"user_id": TEST_USER_ID})
            
            if rules_result and rules_result.get('total') == 1:
                print("✓ Found 1 rule as expected")
            else:
                print("✗ Expected 1 rule")
            
            # Test 5: Update the rule
            print("\n" + "="*50)
            print("TEST 5: Update User Rule")
            update_data = {
                "match_value": "STARBUCKS",
                "description": "Updated: Starbucks purchases only"
            }
            test_endpoint("PUT", f"/user_rules/{rule_id}", data=update_data, params={"user_id": TEST_USER_ID})
            
            # Test 6: Preview the rule
            print("\n" + "="*50)
            print("TEST 6: Preview Rule")
            preview_rule = {
                "match_field": "description",
                "match_operator": "contains",
                "match_value": "TEST",
                "category_id": test_category_id
            }
            test_endpoint("POST", "/user_rules/preview", data=preview_rule, params={"user_id": TEST_USER_ID})
            
            # Test 7: Delete the rule
            print("\n" + "="*50)
            print("TEST 7: Delete User Rule")
            test_endpoint("DELETE", f"/user_rules/{rule_id}", params={"user_id": TEST_USER_ID})
            
            # Test 8: Verify rule is deleted
            print("\n" + "="*50)
            print("TEST 8: Verify Rule Deleted")
            final_rules = test_endpoint("GET", "/user_rules", params={"user_id": TEST_USER_ID})
            
            if final_rules and final_rules.get('total') == 0:
                print("✓ Rule successfully deleted")
            else:
                print("✗ Rule was not deleted properly")
        else:
            print("✗ Failed to create rule")
    else:
        print("✗ No test category available")
    
    print("\n" + "="*50)
    print("=== Test Suite Complete ===")

if __name__ == "__main__":
    main()
