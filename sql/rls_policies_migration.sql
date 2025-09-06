-- RLS Policies Migration Script
-- Generated for vectr-4: user-owned and reference tables

-- 1. User-owned tables (user_id column)
DROP POLICY IF EXISTS "Users can access own account_links" ON public.account_links;
CREATE POLICY "Users can access own account_links" ON public.account_links
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own accounts" ON public.accounts;
CREATE POLICY "Users can access own accounts" ON public.accounts
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own budget_categories" ON public.budget_categories;
CREATE POLICY "Users can access own budget_categories" ON public.budget_categories
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own budgets" ON public.budgets;
CREATE POLICY "Users can access own budgets" ON public.budgets
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own categories" ON public.categories;
CREATE POLICY "Users can access own categories" ON public.categories
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own chat_sessions" ON public.chat_sessions;
CREATE POLICY "Users can access own chat_sessions" ON public.chat_sessions
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own goals" ON public.goals;
CREATE POLICY "Users can access own goals" ON public.goals
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own manual_assets" ON public.manual_assets;
CREATE POLICY "Users can access own manual_assets" ON public.manual_assets
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own net_worth_snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can access own net_worth_snapshots" ON public.net_worth_snapshots
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own tags" ON public.tags;
CREATE POLICY "Users can access own tags" ON public.tags
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own transactions" ON public.transactions;
CREATE POLICY "Users can access own transactions" ON public.transactions
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own user_rules" ON public.user_rules;
CREATE POLICY "Users can access own user_rules" ON public.user_rules
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own zAI_chats_backup" ON public."zAI_chats_backup";
CREATE POLICY "Users can access own zAI_chats_backup" ON public."zAI_chats_backup"
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own zcategories_plaid" ON public.zcategories_plaid;
CREATE POLICY "Users can access own zcategories_plaid" ON public.zcategories_plaid
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own zinsurance_policies" ON public.zinsurance_policies;
CREATE POLICY "Users can access own zinsurance_policies" ON public.zinsurance_policies
  FOR ALL
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can access own zsecure_documents" ON public.zsecure_documents;
CREATE POLICY "Users can access own zsecure_documents" ON public.zsecure_documents
  FOR ALL
  USING (user_id = (select auth.uid()));

-- 2. Reference/join tables (no user_id column)
DROP POLICY IF EXISTS "Authenticated users can read transaction_categories" ON public.transaction_categories;
CREATE POLICY "Authenticated users can read transaction_categories" ON public.transaction_categories
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read transaction_edits" ON public.transaction_edits;
CREATE POLICY "Authenticated users can read transaction_edits" ON public.transaction_edits
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read transaction_tags" ON public.transaction_tags;
CREATE POLICY "Authenticated users can read transaction_tags" ON public.transaction_tags
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read webhook_events" ON public.webhook_events;
CREATE POLICY "Authenticated users can read webhook_events" ON public.webhook_events
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read zAI_messages_backup" ON public."zAI_messages_backup";
CREATE POLICY "Authenticated users can read zAI_messages_backup" ON public."zAI_messages_backup"
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read zloans" ON public.zloans;
CREATE POLICY "Authenticated users can read zloans" ON public.zloans
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read ztransaction_categories_backup" ON public.ztransaction_categories_backup;
CREATE POLICY "Authenticated users can read ztransaction_categories_backup" ON public.ztransaction_categories_backup
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read ztransaction_categories_old" ON public.ztransaction_categories_old;
CREATE POLICY "Authenticated users can read ztransaction_categories_old" ON public.ztransaction_categories_old
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

-- 3. (Optional) Restrict writes on reference tables by not adding INSERT/UPDATE/DELETE policies

-- End of RLS migration script

-- Cleanup: Drop duplicate permissive policies (keep only canonical policy per table/action/role)
-- account_links
DROP POLICY IF EXISTS "Users can manage their own account links" ON public.account_links;

-- accounts
DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS accounts_user_isolation_delete ON public.accounts;
DROP POLICY IF EXISTS accounts_user_isolation_insert ON public.accounts;
DROP POLICY IF EXISTS accounts_user_isolation_select ON public.accounts;
DROP POLICY IF EXISTS accounts_user_isolation_update ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;

-- categories
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Allow read for all" ON public.categories;
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;

-- chat_sessions
DROP POLICY IF EXISTS "Delete own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow insert own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Insert own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow select own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Select own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can select their own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Update own chat sessions" ON public.chat_sessions;

-- transactions
DROP POLICY IF EXISTS delete_own_transactions ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS insert_own_transactions ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS select_own_transactions ON public.transactions;
DROP POLICY IF EXISTS update_own_transactions ON public.transactions;
DROP POLICY IF EXISTS transactions_user_isolation_delete ON public.transactions;
DROP POLICY IF EXISTS transactions_user_isolation_insert ON public.transactions;
DROP POLICY IF EXISTS transactions_user_isolation_select ON public.transactions;
DROP POLICY IF EXISTS transactions_user_isolation_update ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

-- user_rules
DROP POLICY IF EXISTS user_rules_v2_user_isolation ON public.user_rules;

-- Remove duplicate indexes
-- user_rules: keep user_rules_user_id_priority_key, drop the other
ALTER TABLE public.user_rules DROP CONSTRAINT IF EXISTS user_rules_v2_user_id_priority_key;

-- zcategories_plaid: keep categories_plaid_pkey (primary key), drop the others
ALTER TABLE public.zcategories_plaid DROP CONSTRAINT IF EXISTS categories_plaid_id_key;
ALTER TABLE public.zcategories_plaid DROP CONSTRAINT IF EXISTS categories_plaid_id_key1;
