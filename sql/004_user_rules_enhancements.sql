-- 004_user_rules_enhancements.sql
-- Minor enhancements to support full user rules interface functionality
-- Date: 2025-09-01

BEGIN;

-- =============================================
-- 1. ADD MISSING COLUMNS TO TRANSACTIONS
-- =============================================

-- Add merchant_name override column (for "Rename merchant" action)
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS merchant_name_override text NULL;

-- Add goal_id for "Link to goal" functionality
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS goal_id uuid NULL;

-- Add hide_transaction flag
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;

-- Add review_status enum
DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('unreviewed', 'reviewed', 'needs_attention', 'approved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS review_status review_status DEFAULT 'unreviewed';

-- =============================================
-- 2. ENHANCE user_rules ACTIONS
-- =============================================

-- Update the enhanced user rules to support all actions from interface
-- The actions jsonb should support:
-- {
--   "category_id": "uuid",              // Update category
--   "rename_merchant_to": "New Name",   // Rename merchant  
--   "add_tags": ["tag1", "tag2"],       // Add tags
--   "hide_transaction": true,           // Hide transaction
--   "review_status": "reviewed",        // Set review status
--   "link_to_goal": "goal-uuid",        // Link to goal
--   "split_transaction": {              // Split transaction (advanced)
--     "splits": [
--       {"amount": 50.0, "category_id": "uuid1"},
--       {"amount": 30.0, "category_id": "uuid2"}
--     ]
--   }
-- }

-- Add comment to document enhanced actions structure
COMMENT ON COLUMN user_rules.actions IS 
'Enhanced actions supporting: category_id, rename_merchant_to, add_tags, hide_transaction, review_status, link_to_goal, split_transaction';

-- =============================================
-- 3. ADD FOREIGN KEY FOR GOALS (if goals table exists)
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'goals'
  ) THEN
    -- Check whether the FK already exists
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'transactions_goal_id_fkey'
        AND conrelid = 'public.transactions'::regclass
    ) THEN
      ALTER TABLE public.transactions
        ADD CONSTRAINT transactions_goal_id_fkey
        FOREIGN KEY (goal_id) REFERENCES public.goals(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END$$;

-- =============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =============================================

-- Index for filtering hidden transactions
CREATE INDEX IF NOT EXISTS idx_transactions_hidden 
  ON public.transactions (user_id, hidden) WHERE hidden = true;

-- Index for review status filtering  
CREATE INDEX IF NOT EXISTS idx_transactions_review_status 
  ON public.transactions (user_id, review_status);

-- Index for goal linkage
CREATE INDEX IF NOT EXISTS idx_transactions_goal_id 
  ON public.transactions (goal_id) WHERE goal_id IS NOT NULL;

-- =============================================
-- 5. UPDATE RLS POLICIES FOR NEW COLUMNS
-- =============================================

-- Ensure RLS policies cover new columns (if using RLS)
-- Note: Existing user_id based policies should already cover these

-- =============================================
-- 6. CREATE HELPER FUNCTIONS FOR RULE ACTIONS
-- =============================================

-- Function to apply rule actions to a transaction
CREATE OR REPLACE FUNCTION apply_rule_actions(
  transaction_id uuid,
  actions jsonb,
  user_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  category_id_val uuid;
  rename_merchant_val text;
  add_tags_val jsonb;
  hide_val boolean;
  review_status_val review_status;
  goal_id_val uuid;
  tag_name text;
BEGIN
  -- Validate transaction exists and user has access
  IF NOT EXISTS (
    SELECT 1 FROM transactions 
    WHERE id = transaction_id 
    AND (user_id IS NULL OR transactions.user_id = user_id)
  ) THEN
    RAISE EXCEPTION 'Transaction not found or access denied';
  END IF;
  
  -- Apply category change
  category_id_val := (actions->>'category_id')::uuid;
  IF category_id_val IS NOT NULL THEN
    UPDATE transactions 
    SET primary_category_id = category_id_val, updated_at = now()
    WHERE id = transaction_id;
  END IF;
  
  -- Apply merchant rename
  rename_merchant_val := actions->>'rename_merchant_to';
  IF rename_merchant_val IS NOT NULL THEN
    UPDATE transactions 
    SET merchant_name_override = rename_merchant_val, updated_at = now()
    WHERE id = transaction_id;
  END IF;
  
  -- Apply hide transaction
  hide_val := (actions->>'hide_transaction')::boolean;
  IF hide_val IS NOT NULL THEN
    UPDATE transactions 
    SET hidden = hide_val, updated_at = now()
    WHERE id = transaction_id;
  END IF;
  
  -- Apply review status
  review_status_val := (actions->>'review_status')::review_status;
  IF review_status_val IS NOT NULL THEN
    UPDATE transactions 
    SET review_status = review_status_val, updated_at = now()
    WHERE id = transaction_id;
  END IF;
  
  -- Apply goal linkage
  goal_id_val := (actions->>'link_to_goal')::uuid;
  IF goal_id_val IS NOT NULL THEN
    UPDATE transactions 
    SET goal_id = goal_id_val, updated_at = now()
    WHERE id = transaction_id;
  END IF;
  
  -- Apply tags
  add_tags_val := actions->'add_tags';
  IF add_tags_val IS NOT NULL AND jsonb_typeof(add_tags_val) = 'array' THEN
    FOR tag_name IN SELECT jsonb_array_elements_text(add_tags_val) LOOP
      -- Insert tag if doesn't exist, then link to transaction
      INSERT INTO tags (name, user_id) 
      VALUES (tag_name, (SELECT transactions.user_id FROM transactions WHERE id = transaction_id))
      ON CONFLICT (name, user_id) DO NOTHING;
      
      -- Link tag to transaction
      INSERT INTO transaction_tags (transaction_id, tag_id)
      SELECT transaction_id, tags.id 
      FROM tags 
      WHERE tags.name = tag_name 
        AND tags.user_id = (SELECT transactions.user_id FROM transactions WHERE id = transaction_id)
      ON CONFLICT (transaction_id, tag_id) DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION apply_rule_actions(uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_rule_actions(uuid, jsonb, uuid) TO service_role;

COMMIT;