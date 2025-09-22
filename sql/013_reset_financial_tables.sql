-- This migration resets the core financial tables to align with a Plaid-centric data model.
-- It drops the existing tables and recreates them with a cleaner, more performant structure.
-- WARNING: This will result in the loss of all data in the affected tables.

BEGIN;

-- Drop existing tables in the correct order to handle dependencies
DROP TABLE IF EXISTS public.transaction_edits CASCADE;
DROP TABLE IF EXISTS public.transaction_tags CASCADE;
DROP TABLE IF EXISTS public.transaction_categories CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.balances CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

-- Re-create the accounts table with a cleaner structure
CREATE TABLE public.accounts (
    account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_link_id uuid REFERENCES public.account_links(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    aggregator_account_id text UNIQUE,
    name text NOT NULL,
    official_name text,
    mask char(4),
    type text NOT NULL,
    subtype text,
    currency char(3),
    current_balance numeric(28, 10),
    available_balance numeric(28, 10),
    verification_status text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- Add indexes for common query patterns
CREATE INDEX ON public.accounts(user_id);
CREATE INDEX ON public.accounts(account_link_id);

-- Re-create the transactions table, optimized for Plaid data
CREATE TABLE public.transactions (
    transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES public.accounts(account_id) ON DELETE CASCADE,
    aggregator_transaction_id text UNIQUE,
    merchant_id uuid REFERENCES public.merchants(merchant_id),
    category_id uuid REFERENCES public.categories(category_id),
    
    -- Core Transaction Details
    original_description text,
    merchant_name text,
    amount numeric(28, 10) NOT NULL,
    currency char(3),
    date date NOT NULL,
    authorized_date date,
    pending boolean DEFAULT false,
    
    -- Enriched Plaid Data
    transaction_type text, -- from counterparty.type
    logo_url text,
    website text,
    plaid_entity_id text,
    
    -- Categorization
    primary_category text,
    detailed_category text,
    category_confidence_level text,
    
    -- Metadata
    payment_channel text,
    check_number text,
    location jsonb,
    payment_meta jsonb,
    user_metadata jsonb,
    
    -- App-specific fields
    needs_review boolean DEFAULT false,
    is_hidden boolean DEFAULT false,
    notes text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX ON public.transactions(user_id);
CREATE INDEX ON public.transactions(account_id);
CREATE INDEX ON public.transactions(merchant_id);
CREATE INDEX ON public.transactions(category_id);
CREATE INDEX ON public.transactions(date DESC);
CREATE INDEX ON public.transactions(pending);

-- Re-create transaction-related tables
CREATE TABLE public.transaction_categories (
    transaction_id uuid NOT NULL REFERENCES public.transactions(transaction_id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.categories(category_id) ON DELETE CASCADE,
    source text DEFAULT 'manual'::text,
    PRIMARY KEY (transaction_id, category_id)
);

CREATE TABLE public.transaction_edits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES public.transactions(transaction_id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    changed_at timestamptz NOT NULL DEFAULT now(),
    changes jsonb NOT NULL
);

CREATE TABLE public.transaction_tags (
    transaction_id uuid NOT NULL REFERENCES public.transactions(transaction_id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

COMMIT;
