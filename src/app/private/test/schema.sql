-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.account_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['plaid'::text, 'mx'::text])),
  item_id text NOT NULL UNIQUE,
  access_token_encrypted text NOT NULL,
  cursor text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'revoked'::text, 'error'::text])),
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_webhook_received_at timestamp with time zone,
  last_webhook_event_id uuid,
  institution_id text,
  institution_name text,
  linked_at timestamp with time zone,
  last_sync_at timestamp with time zone,
  unlinked_at timestamp with time zone,
  error_details jsonb,
  last_error_at timestamp with time zone,
  expires_at timestamp with time zone,
  CONSTRAINT account_links_pkey PRIMARY KEY (id),
  CONSTRAINT fk_last_webhook_event FOREIGN KEY (last_webhook_event_id) REFERENCES public.webhook_events(id),
  CONSTRAINT account_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.accounts (
  account_id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_link_id uuid,
  user_id uuid NOT NULL,
  aggregator_account_id text UNIQUE,
  name text NOT NULL,
  official_name text,
  mask character,
  type text NOT NULL,
  subtype text,
  currency character,
  current_balance numeric,
  available_balance numeric,
  verification_status text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT accounts_pkey PRIMARY KEY (account_id),
  CONSTRAINT accounts_account_link_id_fkey FOREIGN KEY (account_link_id) REFERENCES public.account_links(id),
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
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
  category_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  category text NOT NULL,
  parent_category text,
  parent_id uuid,
  icon_kebab text,
  name text,
  plain_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  icon text,
  lucide_icon text,
  description text,
  CONSTRAINT categories_pkey PRIMARY KEY (category_id),
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(category_id)
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
  institution_id text NOT NULL,
  provider text NOT NULL,
  name text NOT NULL,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  url text,
  primary_color text,
  country_codes ARRAY,
  metadata jsonb,
  oauth text,
  products jsonb,
  dtc_numbers text,
  routing_numbers jsonb,
  CONSTRAINT institutions_pkey PRIMARY KEY (institution_id)
);
CREATE TABLE public.mcc_category_map (
  mcc smallint NOT NULL,
  description text,
  category_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT mcc_category_map_pkey PRIMARY KEY (mcc)
);
CREATE TABLE public.merchants (
  merchant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  default_category_id uuid,
  logo_url text,
  aliases text,
  regex_match text NOT NULL,
  confidence_score numeric DEFAULT 1.0,
  is_active boolean DEFAULT true,
  last_matched_at timestamp with time zone,
  match_count integer DEFAULT 0,
  user_id uuid,
  CONSTRAINT merchants_pkey PRIMARY KEY (merchant_id),
  CONSTRAINT fk_merchants_default_category_id FOREIGN KEY (default_category_id) REFERENCES public.categories(category_id)
);
CREATE TABLE public.merchants_backup (
  merchant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  default_category_id uuid,
  logo_url text,
  aliases text,
  regex_match text NOT NULL,
  confidence_score numeric DEFAULT 1.0,
  is_active boolean DEFAULT true,
  last_matched_at timestamp with time zone,
  match_count integer DEFAULT 0,
  user_id uuid,
  CONSTRAINT merchants_backup_pkey PRIMARY KEY (merchant_id),
  CONSTRAINT merchants_backup_default_category_id_fkey FOREIGN KEY (default_category_id) REFERENCES public.categories(category_id)
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
  source text DEFAULT 'manual'::text,
  CONSTRAINT transaction_categories_pkey PRIMARY KEY (transaction_id, category_id),
  CONSTRAINT transaction_categories_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id),
  CONSTRAINT transaction_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id)
);
CREATE TABLE public.transaction_edits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  user_id uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changes jsonb NOT NULL,
  CONSTRAINT transaction_edits_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_edits_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id),
  CONSTRAINT transaction_edits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.transaction_tags (
  transaction_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT transaction_tags_pkey PRIMARY KEY (tag_id, transaction_id),
  CONSTRAINT transaction_tags_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id),
  CONSTRAINT transaction_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.transactions (
  transaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  aggregator_transaction_id text UNIQUE,
  merchant_id uuid,
  category_id uuid,
  original_description text,
  merchant_name text,
  amount numeric NOT NULL,
  currency character,
  date date NOT NULL,
  authorized_date date,
  pending boolean DEFAULT false,
  transaction_type text,
  logo_url text,
  website text,
  plaid_entity_id text,
  primary_category text,
  detailed_category text,
  category_confidence_level text,
  payment_channel text,
  check_number text,
  location jsonb,
  payment_meta jsonb,
  user_metadata jsonb,
  needs_review boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (transaction_id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(account_id),
  CONSTRAINT transactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(merchant_id),
  CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id)
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
  status text NOT NULL DEFAULT 'received'::text CHECK (status = ANY (ARRAY['received'::text, 'processing'::text, 'processed'::text, 'error'::text])),
  error text,
  item_id text,
  webhook_type text,
  webhook_code text,
  dedupe_key text,
  processing_claimed_at timestamp with time zone,
  processed_by text,
  retry_count integer DEFAULT 0,
  last_error text,
  event_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.zcategories_plaid (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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