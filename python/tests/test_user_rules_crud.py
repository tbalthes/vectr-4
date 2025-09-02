"""
Test script for User Rules CRUD API endpoints
"""
import requests
import json
from uuid import uuid4

BASE_URL = "http://localhost:8000"
USER_ID = "436dc420-d182-48c7-a605-88b33b8918de"  # From your example

def test_user_rules_endpoints():
    """Test all user rules CRUD endpoints"""
    
    print("=== Testing User Rules API Endpoints ===\n")
    
    # 1. Test GET /user_rules (list rules)
    print("1. Testing GET /user_rules")
    try:
        response = requests.get(f"{BASE_URL}/user_rules", params={"user_id": USER_ID})
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Found {data.get('total', 0)} rules")
            if data.get('rules'):
                print(f"   First rule ID: {data['rules'][0]['id']}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    print()
    
    # 2. Test POST /user_rules (create rule)
    print("2. Testing POST /user_rules")
    new_rule = {
        "user_id": USER_ID,
        "match_field": "original_description",
        "match_operator": "contains",
        "match_value": "TEST_RULE",
        "category_id": "ff3ceb24-e7bb-4613-97fe-5fe75594c962",  # From your example
        "priority": 200,
        "enabled": True,
        "description": "Test rule for API validation"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/user_rules", json=new_rule)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            created_rule = response.json()
            rule_id = created_rule.get('id')
            print(f"   Created rule ID: {rule_id}")
            
            # 3. Test PUT /user_rules/{rule_id} (update rule)
            print(f"\n3. Testing PUT /user_rules/{rule_id}")
            update_data = {
                "description": "Updated test rule description",
                "enabled": False
            }
            
            try:
                update_response = requests.put(f"{BASE_URL}/user_rules/{rule_id}", json=update_data)
                print(f"   Status: {update_response.status_code}")
                if update_response.status_code == 200:
                    updated_rule = update_response.json()
                    print(f"   Updated description: {updated_rule.get('description')}")
                    print(f"   Updated enabled: {updated_rule.get('enabled')}")
                else:
                    print(f"   Error: {update_response.text}")
            except Exception as e:
                print(f"   Exception: {e}")
            
            # 4. Test rule preview
            print(f"\n4. Testing POST /user_rules/preview")
            preview_rule = {
                "match_field": "original_description",
                "match_operator": "contains",
                "match_value": "midfirst",  # From your example
                "category_id": "ff3ceb24-e7bb-4613-97fe-5fe75594c962"
            }
            
            try:
                preview_response = requests.post(
                    f"{BASE_URL}/user_rules/preview",
                    params={"user_id": USER_ID, "sample_limit": 10},
                    json=preview_rule
                )
                print(f"   Status: {preview_response.status_code}")
                if preview_response.status_code == 200:
                    preview_data = preview_response.json()
                    print(f"   Rule summary: {preview_data.get('rule_summary')}")
                    print(f"   Transactions checked: {preview_data.get('total_transactions_checked')}")
                    print(f"   Matching transactions: {len(preview_data.get('matching_transactions', []))}")
                else:
                    print(f"   Error: {preview_response.text}")
            except Exception as e:
                print(f"   Exception: {e}")
            
            # 5. Test DELETE /user_rules/{rule_id} (cleanup)
            print(f"\n5. Testing DELETE /user_rules/{rule_id}")
            try:
                delete_response = requests.delete(f"{BASE_URL}/user_rules/{rule_id}")
                print(f"   Status: {delete_response.status_code}")
                if delete_response.status_code == 200:
                    print("   Rule deleted successfully")
                else:
                    print(f"   Error: {delete_response.text}")
            except Exception as e:
                print(f"   Exception: {e}")
                
        else:
            print(f"   Error creating rule: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    test_user_rules_endpoints()
