-- Migration: Enhanced User Rules System with Complex Conditions
-- Version: 002
-- Date: 2025-08-31
-- Description: Redesign user_rules to support complex AND/OR conditions like Monarch Money

-- =============================================
-- NEW ENHANCED USER_RULES SCHEMA
-- =============================================

-- Drop existing user_rules table if it exists (backup first in production!)
-- DROP TABLE IF EXISTS user_rules CASCADE;

-- Create enhanced user_rules table
CREATE TABLE IF NOT EXISTS user_rules_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, -- User-friendly rule name like "Payroll Income"
  description text, -- Optional longer description
  enabled boolean DEFAULT true,
  priority integer DEFAULT 100, -- Lower number = higher priority
  
  -- Actions to take when rule matches
  actions jsonb NOT NULL DEFAULT '{}', -- {"category_id": "...", "rename_to": "...", "add_tags": [...]}
  
  -- Complex condition structure supporting AND/OR logic
  conditions jsonb NOT NULL, -- See structure below
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Performance indexes
  CONSTRAINT user_rules_v2_user_id_priority_key UNIQUE(user_id, priority)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_rules_v2_user_enabled ON user_rules_v2(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_user_rules_v2_priority ON user_rules_v2(user_id, priority) WHERE enabled = true;

-- Enable RLS
ALTER TABLE user_rules_v2 ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY user_rules_v2_user_isolation ON user_rules_v2
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- CONDITIONS JSONB STRUCTURE
-- =============================================

/*
The conditions field supports complex AND/OR logic:

{
  "operator": "AND",  // Root operator: "AND" or "OR"
  "groups": [
    {
      "operator": "OR",  // Group operator
      "conditions": [
        {
          "field": "description",           // user-friendly: description, merchant, amount
          "operator": "contains",           // contains, equals, starts_with, ends_with, greater_than, less_than
          "value": "midfirst",
          "case_sensitive": false
        },
        {
          "field": "description", 
          "operator": "contains",
          "value": "payroll",
          "case_sensitive": false
        }
      ]
    },
    {
      "operator": "AND",
      "conditions": [
        {
          "field": "amount",
          "operator": "greater_than", 
          "value": 1000
        }
      ]
    }
  ]
}

This structure allows for:
- "If description contains 'midfirst' OR 'payroll' AND amount > 1000"
- Multiple condition groups with different operators
- Case sensitivity control
- User-friendly field names
*/

-- =============================================
-- ACTIONS JSONB STRUCTURE  
-- =============================================

/*
The actions field defines what happens when rule matches:

{
  "category_id": "uuid-here",           // Recategorize transaction
  "rename_to": "Salary Payment",        // Rename description
  "add_tags": ["income", "payroll"],    // Add tags
  "hide_transaction": false,            // Hide from main view
  "needs_review": false,                // Mark as reviewed
  "confidence_override": 1.0            // Override confidence score
}
*/

-- =============================================
-- MIGRATION HELPER FUNCTIONS
-- =============================================

-- Function to migrate existing user_rules to new format
CREATE OR REPLACE FUNCTION migrate_user_rules_to_v2()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
  new_conditions jsonb;
  new_actions jsonb;
BEGIN
  -- Only run if old table exists and new table is empty
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_rules') 
     AND NOT EXISTS (SELECT 1 FROM user_rules_v2 LIMIT 1) THEN
    
    FOR rule IN SELECT * FROM user_rules LOOP
      -- Convert old single condition to new format
      new_conditions := jsonb_build_object(
        'operator', 'AND',
        'groups', jsonb_build_array(
          jsonb_build_object(
            'operator', 'AND',
            'conditions', jsonb_build_array(
              jsonb_build_object(
                'field', CASE 
                  WHEN rule.match_field = 'original_description' THEN 'description'
                  WHEN rule.match_field = 'clean_description' THEN 'description'  
                  WHEN rule.match_field = 'merchant_name' THEN 'merchant'
                  ELSE rule.match_field
                END,
                'operator', CASE
                  WHEN rule.match_operator = 'equals' THEN 'equals'
                  WHEN rule.match_operator = 'contains' THEN 'contains'
                  WHEN rule.match_operator = 'startswith' THEN 'starts_with'
                  WHEN rule.match_operator = 'endswith' THEN 'ends_with'
                  WHEN rule.match_operator = 'greater_than' THEN 'greater_than'
                  WHEN rule.match_operator = 'less_than' THEN 'less_than'
                  ELSE rule.match_operator
                END,
                'value', rule.match_value,
                'case_sensitive', false
              )
            )
          )
        )
      );
      
      -- Convert actions
      new_actions := jsonb_build_object(
        'category_id', rule.category_id
      );
      
      -- Add amount filters if present
      IF rule.amount_min IS NOT NULL OR rule.amount_max IS NOT NULL THEN
        new_conditions := jsonb_set(
          new_conditions,
          '{groups,0,conditions}',
          (new_conditions->'groups'->0->'conditions') || 
          CASE 
            WHEN rule.amount_min IS NOT NULL THEN
              jsonb_build_array(jsonb_build_object(
                'field', 'amount',
                'operator', 'greater_than',
                'value', rule.amount_min
              ))
            ELSE '[]'::jsonb
          END ||
          CASE 
            WHEN rule.amount_max IS NOT NULL THEN
              jsonb_build_array(jsonb_build_object(
                'field', 'amount',
                'operator', 'less_than', 
                'value', rule.amount_max
              ))
            ELSE '[]'::jsonb
          END
        );
      END IF;
      
      -- Insert migrated rule
      INSERT INTO user_rules_v2 (
        user_id, name, description, enabled, priority, conditions, actions, created_at, updated_at
      ) VALUES (
        rule.user_id,
        COALESCE(rule.description, 'Migrated Rule'),
        'Migrated from legacy user_rules table',
        rule.enabled,
        rule.priority,
        new_conditions,
        new_actions,
        rule.created_at,
        rule.updated_at
      );
    END LOOP;
    
    RAISE NOTICE 'Migrated % rules to user_rules_v2', (SELECT COUNT(*) FROM user_rules);
  END IF;
END;
$$;

-- =============================================
-- HELPER FUNCTIONS FOR RULE EVALUATION
-- =============================================

-- Function to evaluate a single condition against transaction data
CREATE OR REPLACE FUNCTION evaluate_condition(
  condition jsonb,
  transaction_data jsonb
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  field_name text;
  operator text;
  expected_value text;
  actual_value text;
  case_sensitive boolean;
  numeric_expected numeric;
  numeric_actual numeric;
BEGIN
  -- Extract condition components
  field_name := condition->>'field';
  operator := condition->>'operator';
  expected_value := condition->>'value';
  case_sensitive := COALESCE((condition->>'case_sensitive')::boolean, false);
  
  -- Map user-friendly field names to transaction data keys
  actual_value := CASE field_name
    WHEN 'description' THEN COALESCE(transaction_data->>'clean_description', transaction_data->>'original_description', transaction_data->>'description')
    WHEN 'merchant' THEN transaction_data->>'merchant_name'
    WHEN 'amount' THEN transaction_data->>'amount'
    ELSE transaction_data->>field_name
  END;
  
  -- Handle null values
  IF actual_value IS NULL THEN
    RETURN false;
  END IF;
  
  -- Apply case sensitivity for text operations
  IF NOT case_sensitive AND field_name != 'amount' THEN
    actual_value := lower(actual_value);
    expected_value := lower(expected_value);
  END IF;
  
  -- Evaluate based on operator
  CASE operator
    WHEN 'equals' THEN
      RETURN actual_value = expected_value;
    WHEN 'contains' THEN
      RETURN actual_value LIKE '%' || expected_value || '%';
    WHEN 'starts_with' THEN
      RETURN actual_value LIKE expected_value || '%';
    WHEN 'ends_with' THEN
      RETURN actual_value LIKE '%' || expected_value;
    WHEN 'greater_than' THEN
      BEGIN
        numeric_actual := actual_value::numeric;
        numeric_expected := expected_value::numeric;
        RETURN numeric_actual > numeric_expected;
      EXCEPTION WHEN OTHERS THEN
        RETURN false;
      END;
    WHEN 'less_than' THEN
      BEGIN
        numeric_actual := actual_value::numeric;
        numeric_expected := expected_value::numeric;
        RETURN numeric_actual < numeric_expected;
      EXCEPTION WHEN OTHERS THEN
        RETURN false;
      END;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Function to evaluate a condition group
CREATE OR REPLACE FUNCTION evaluate_condition_group(
  group_data jsonb,
  transaction_data jsonb
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  group_operator text;
  condition jsonb;
  result boolean;
  group_result boolean;
BEGIN
  group_operator := group_data->>'operator';
  group_result := CASE group_operator WHEN 'OR' THEN false ELSE true END;
  
  FOR condition IN SELECT * FROM jsonb_array_elements(group_data->'conditions')
  LOOP
    result := evaluate_condition(condition, transaction_data);
    
    IF group_operator = 'OR' THEN
      group_result := group_result OR result;
      -- Short circuit for OR - if any condition is true, group is true
      IF group_result THEN
        EXIT;
      END IF;
    ELSE -- AND
      group_result := group_result AND result;
      -- Short circuit for AND - if any condition is false, group is false
      IF NOT group_result THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN group_result;
END;
$$;

-- Function to evaluate complete rule conditions
CREATE OR REPLACE FUNCTION evaluate_rule_conditions(
  conditions jsonb,
  transaction_data jsonb
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  root_operator text;
  group_data jsonb;
  result boolean;
  final_result boolean;
BEGIN
  root_operator := conditions->>'operator';
  final_result := CASE root_operator WHEN 'OR' THEN false ELSE true END;
  
  FOR group_data IN SELECT * FROM jsonb_array_elements(conditions->'groups')
  LOOP
    result := evaluate_condition_group(group_data, transaction_data);
    
    IF root_operator = 'OR' THEN
      final_result := final_result OR result;
      IF final_result THEN
        EXIT;
      END IF;
    ELSE -- AND
      final_result := final_result AND result;
      IF NOT final_result THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN final_result;
END;
$$;

-- =============================================
-- EXAMPLE DATA
-- =============================================

/*
-- Example: Complex payroll rule
INSERT INTO user_rules_v2 (user_id, name, conditions, actions) VALUES (
  'your-user-id'::uuid,
  'Payroll Income',
  '{
    "operator": "AND",
    "groups": [
      {
        "operator": "OR",
        "conditions": [
          {"field": "description", "operator": "contains", "value": "midfirst", "case_sensitive": false},
          {"field": "description", "operator": "contains", "value": "payroll", "case_sensitive": false}
        ]
      },
      {
        "operator": "AND", 
        "conditions": [
          {"field": "amount", "operator": "greater_than", "value": 1000}
        ]
      }
    ]
  }',
  '{
    "category_id": "income-category-uuid",
    "rename_to": "Salary Payment",
    "add_tags": ["income", "payroll"]
  }'
);

-- Example: Amazon purchases
INSERT INTO user_rules_v2 (user_id, name, conditions, actions) VALUES (
  'your-user-id'::uuid,
  'Amazon Purchases',
  '{
    "operator": "OR",
    "groups": [
      {
        "operator": "OR",
        "conditions": [
          {"field": "merchant", "operator": "contains", "value": "amazon", "case_sensitive": false},
          {"field": "description", "operator": "contains", "value": "amzn", "case_sensitive": false},
          {"field": "description", "operator": "contains", "value": "amazon.com", "case_sensitive": false}
        ]
      }
    ]
  }',
  '{
    "category_id": "shopping-category-uuid",
    "add_tags": ["online", "shopping"]
  }'
);
*/

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant access to authenticated users
GRANT ALL ON user_rules_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_condition(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_condition_group(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_rule_conditions(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_user_rules_to_v2() TO authenticated;

-- Grant to service role for admin operations
GRANT ALL ON user_rules_v2 TO service_role;
GRANT EXECUTE ON FUNCTION evaluate_condition(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION evaluate_condition_group(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION evaluate_rule_conditions(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION migrate_user_rules_to_v2() TO service_role;

-- =============================================
-- USAGE NOTES
-- =============================================

/*
To apply this migration:

1. Backup existing user_rules table
2. Run this SQL file in your Supabase SQL editor
3. Test the new functions with sample data
4. Run migrate_user_rules_to_v2() to migrate existing rules
5. Update your application code to use the new structure
6. After verification, optionally drop the old user_rules table

The new system supports complex conditions like:
- "If description contains 'midfirst' OR 'payroll' AND amount > 1000"
- "If merchant contains 'amazon' OR description contains 'amzn'"
- Multiple actions per rule (categorize, rename, tag, etc.)
*/
