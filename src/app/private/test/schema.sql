-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.account_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['plaid'::text, 'mx'::text])),
  item_id text NOT NULL,
  access_token_encrypted text NOT NULL,
  cursor text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'revoked'::text, 'error'::text])),
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT account_links_pkey PRIMARY KEY (id),
  CONSTRAINT account_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  balance numeric NOT NULL DEFAULT '0'::numeric,
  plaid_access_token text NOT NULL,
  account_logo text,
  provider text CHECK (provider = ANY (ARRAY['plaid'::text, 'mx'::text, 'manual'::text])),
  aggregator_account_id text,
  institution_id uuid,
  last_synced_at timestamp with time zone,
  mask character varying,
  currency character varying,
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT fk_accounts_institution_id FOREIGN KEY (institution_id) REFERENCES public.institutions(id)
);
CREATE TABLE public.balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  balance_amount numeric NOT NULL,
  available numeric,
  as_of timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT balances_pkey PRIMARY KEY (id),
  CONSTRAINT balances_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.budget_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  category_id uuid NOT NULL DEFAULT gen_random_uuid(),
  budgeted_amount numeric NOT NULL DEFAULT '0'::numeric,
  budget_id uuid,
  CONSTRAINT budget_categories_pkey PRIMARY KEY (id),
  CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT budget_categories_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id)
);
CREATE TABLE public.budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  total_income numeric DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT budgets_pkey PRIMARY KEY (id),
  CONSTRAINT budgets_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL UNIQUE,
  parent_id uuid,
  icon_kebab text,
  created_at timestamp with time zone DEFAULT now(),
  icon text,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['user'::text, 'ai'::text])),
  content text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  metadata jsonb,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id)
);
CREATE TABLE public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_archived boolean DEFAULT false,
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.contact_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamp with time zone,
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  message_body text,
  CONSTRAINT contact_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.global_regex_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  regex_pattern text NOT NULL,
  pattern_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT global_regex_rules_pkey PRIMARY KEY (id),
  CONSTRAINT global_regex_rules_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id)
);
CREATE TABLE public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT '0'::numeric,
  current_amount numeric NOT NULL DEFAULT '0'::numeric,
  target_date date,
  CONSTRAINT goals_pkey PRIMARY KEY (id),
  CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.institutions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = ANY (ARRAY['plaid'::text, 'mx'::text, 'manual'::text])),
  name text NOT NULL,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT institutions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.insurance_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  policy_type text NOT NULL DEFAULT 'life'::text,
  provider text NOT NULL,
  coverage_amount numeric NOT NULL DEFAULT '0'::numeric,
  premium numeric NOT NULL DEFAULT '0'::numeric,
  premium_frequency text NOT NULL DEFAULT 'monthly'::text,
  CONSTRAINT insurance_policies_pkey PRIMARY KEY (id),
  CONSTRAINT insurance_policies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.loans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  original_amount numeric NOT NULL DEFAULT '0'::numeric,
  interest_rate numeric NOT NULL DEFAULT '0'::numeric,
  term_months smallint,
  minimum_payment numeric NOT NULL DEFAULT '0'::numeric,
  loan_type text NOT NULL DEFAULT 'personal'::text,
  CONSTRAINT loans_pkey PRIMARY KEY (id),
  CONSTRAINT loans_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.manual_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  type text NOT NULL,
  estimated_value numeric NOT NULL,
  date_acquired date,
  CONSTRAINT manual_assets_pkey PRIMARY KEY (id),
  CONSTRAINT manual_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.mcc_category_map (
  mcc smallint NOT NULL,
  description text,
  category_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT mcc_category_map_pkey PRIMARY KEY (mcc),
  CONSTRAINT mcc_category_map_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.merchants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  default_category_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  aliases text,
  CONSTRAINT merchants_pkey PRIMARY KEY (id),
  CONSTRAINT merchants_default_category_id_fkey FOREIGN KEY (default_category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.net_worth_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  snapshot_date date NOT NULL DEFAULT now(),
  total_assets numeric NOT NULL DEFAULT '0'::numeric,
  total_liabilities numeric NOT NULL DEFAULT '0'::numeric,
  net_worth numeric NOT NULL DEFAULT '0'::numeric,
  CONSTRAINT net_worth_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT net_worth_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  updated_at timestamp with time zone,
  full_name text,
  company_name text,
  avatar_url text,
  website text,
  unsubscribed boolean NOT NULL DEFAULT false,
  enabled_features jsonb DEFAULT '{"ai": false, "basic": true, "documents": false, "investments": false}'::jsonb,
  address text,
  city text,
  state text,
  zip_code text,
  phone_number text,
  profile_complete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.secure_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  file_name text NOT NULL,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  related_account_id uuid DEFAULT gen_random_uuid(),
  CONSTRAINT secure_documents_pkey PRIMARY KEY (id),
  CONSTRAINT secure_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT secure_documents_related_account_id_fkey FOREIGN KEY (related_account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.securities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticker_symbol text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  last_price numeric,
  price_updated_at timestamp with time zone,
  CONSTRAINT securities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.stripe_customers (
  user_id uuid NOT NULL,
  updated_at timestamp with time zone,
  stripe_customer_id text UNIQUE,
  CONSTRAINT stripe_customers_pkey PRIMARY KEY (user_id),
  CONSTRAINT stripe_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.transaction_categories (
  transaction_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  confidence numeric DEFAULT 1.00,
  source text DEFAULT 'manual'::text,
  is_primary boolean DEFAULT false,
  CONSTRAINT transaction_categories_pkey PRIMARY KEY (transaction_id, category_id),
  CONSTRAINT transaction_categories_new_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT transaction_categories_new_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.transaction_edits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  user_id uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changes jsonb NOT NULL,
  note text,
  source text NOT NULL DEFAULT 'manual'::text,
  CONSTRAINT transaction_edits_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_edits_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT transaction_edits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_te_user FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_te_transaction FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);
CREATE TABLE public.transaction_tags (
  transaction_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT transaction_tags_pkey PRIMARY KEY (transaction_id),
  CONSTRAINT transaction_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id),
  CONSTRAINT transaction_tags_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  account_id uuid NOT NULL DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  clean_description text,
  date date NOT NULL,
  embedding USER-DEFINED,
  merchant_id uuid,
  original_description text,
  transaction_number text,
  user_metadata jsonb,
  balance numeric,
  transaction_note text,
  manual_edit boolean NOT NULL DEFAULT false,
  edited_at timestamp with time zone,
  edited_by uuid,
  primary_category_id uuid,
  needs_review boolean NOT NULL,
  merchant_name_override text,
  goal_id uuid,
  hidden boolean DEFAULT false,
  review_status USER-DEFINED DEFAULT 'unreviewed'::review_status,
  aggregator_transaction_id text,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id),
  CONSTRAINT fk_transactions_edited_by_profiles FOREIGN KEY (edited_by) REFERENCES public.profiles(id),
  CONSTRAINT fk_transactions_primary_category FOREIGN KEY (primary_category_id) REFERENCES public.categories(id),
  CONSTRAINT fk_transactions_edited_by FOREIGN KEY (edited_by) REFERENCES public.profiles(id),
  CONSTRAINT transactions_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id)
);
CREATE TABLE public.user_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT true,
  priority integer DEFAULT 100,
  actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_rules_pkey PRIMARY KEY (id),
  CONSTRAINT user_rules_v2_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = ANY (ARRAY['plaid'::text, 'mx'::text])),
  event_type text NOT NULL,
  payload_json jsonb NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'received'::text CHECK (status = ANY (ARRAY['received'::text, 'processed'::text, 'error'::text])),
  error text,
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.zAI_chats_backup (
  id uuid,
  user_id uuid,
  title text,
  created_at timestamp with time zone
);
CREATE TABLE public.zAI_messages_backup (
  id uuid,
  created_at timestamp with time zone,
  conversation_id uuid,
  role text,
  content text
);
CREATE TABLE public.zcategories_plaid (
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id uuid DEFAULT auth.uid(),
  category text NOT NULL,
  parent_id uuid,
  icon_kebab text,
  created_at timestamp with time zone DEFAULT now(),
  icon text,
  parent_category text,
  description text,
  plain_name text,
  CONSTRAINT zcategories_plaid_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ztransaction_categories_backup (
  transaction_id uuid,
  category_id uuid,
  created_at timestamp with time zone
);
CREATE TABLE public.ztransaction_categories_old (
  transaction_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ztransaction_categories_old_pkey PRIMARY KEY (transaction_id, category_id),
  CONSTRAINT transaction_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT fk_tc_category FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT transaction_categories_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT fk_tc_transaction FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);