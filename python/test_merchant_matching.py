#!/usr/bin/env python3
"""
Test script to verify the new merchant matching logic works correctly.
Run this to test Phase 2.1.3 requirements.
"""

import re
import sys
import os
sys.path.append(os.path.dirname(__file__))

from core.matching import match_merchant_by_regex

def test_merchant_matching():
    """Test the new merchant regex matching system."""
    
    # Mock merchants data (similar to what would come from Supabase)
    test_merchants = [
        {
            'merchant_id': 'starbucks-uuid',
            'name': 'Starbucks',
            'default_category_id': 'food-drink-uuid',
            'logo_url': 'https://example.com/starbucks.png',
            'regex_match': r'STARBUCKS.*STORE|STARBUCKS.*#\d+'
        },
        {
            'merchant_id': 'amazon-uuid', 
            'name': 'Amazon',
            'default_category_id': 'shopping-uuid',
            'logo_url': 'https://example.com/amazon.png',
            'regex_match': r'AMAZON\.COM|AMZN\.COM|AMAZON MARKETPLACE'
        },
        {
            'merchant_id': 'target-uuid',
            'name': 'Target',
            'default_category_id': 'shopping-uuid', 
            'logo_url': 'https://example.com/target.png',
            'regex_match': r'TARGET\s+T-?\d+|TARGET STORE'
        }
    ]
    
    # Test cases
    test_descriptions = [
        "STARBUCKS STORE #12345",
        "AMAZON.COM AMZN.COM/BILL",
        "TARGET T-1234 GROCERY",
        "MCDONALD'S #1234",  # Should not match
        "RANDOM MERCHANT",    # Should not match
    ]
    
    print("🧪 Testing Merchant Regex Matching Logic")
    print("=" * 50)
    
    for desc in test_descriptions:
        print(f"\n📝 Testing: '{desc}'")
        match_result = match_merchant_by_regex(desc, test_merchants)
        
        if match_result:
            print(f"   ✅ MATCHED: {match_result['merchant_name']}")
            print(f"   📂 Category ID: {match_result['category_id']}")
            print(f"   🎯 Confidence: {match_result['confidence']}")
            print(f"   📋 Method: {match_result['match_method']}")
        else:
            print(f"   ❌ NO MATCH")
    
    print("\n" + "=" * 50)
    print("✅ Merchant matching test complete!")

if __name__ == "__main__":
    test_merchant_matching()
