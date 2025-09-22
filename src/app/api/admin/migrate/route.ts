import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// POST /api/admin/migrate
// Run database migrations (for development)
export async function POST() {
  const supabase = createSupabaseServerClient();

  try {
    console.log('Running database migration...');

    // Ensure balances table has canonical columns and indexes
    const { error: balancesTableError } = await supabase.rpc('sql', {
      query: `
        -- Add canonical columns to balances table if missing
        ALTER TABLE public.balances
          ADD COLUMN IF NOT EXISTS balance_amount numeric,
          ADD COLUMN IF NOT EXISTS available numeric,
          ADD COLUMN IF NOT EXISTS iso_currency_code character(3),
          ADD COLUMN IF NOT EXISTS as_of timestamptz DEFAULT now(),
          ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

        -- Backfill balance_amount from legacy 'current' column if present
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'balances' AND column_name = 'current'
          ) THEN
            UPDATE public.balances SET balance_amount = COALESCE(balance_amount, current);
          END IF;
        END $$;

        -- Helpful index for latest balance lookups
        CREATE INDEX IF NOT EXISTS idx_balances_account_asof_created 
          ON public.balances(account_id, as_of DESC, created_at DESC);

        -- Ensure accounts table has fallback balance columns used by older flows
        ALTER TABLE public.accounts
          ADD COLUMN IF NOT EXISTS current_balance numeric,
          ADD COLUMN IF NOT EXISTS available_balance numeric;
      `,
    });

    // Add new columns to institutions table
    const { error: institutionsError } = await supabase.rpc('sql', {
      query: `
        ALTER TABLE public.institutions
          ADD COLUMN IF NOT EXISTS url text,
          ADD COLUMN IF NOT EXISTS primary_color text,
          ADD COLUMN IF NOT EXISTS country_codes text[],
          ADD COLUMN IF NOT EXISTS metadata jsonb;
      `,
    });

    // Add new columns to accounts table
    const { error: accountsError } = await supabase.rpc('sql', {
      query: `
        ALTER TABLE public.accounts
          ADD COLUMN IF NOT EXISTS subtype text,
          ADD COLUMN IF NOT EXISTS account_logo text;
      `,
    });

    // Update the view
    const { error: viewError } = await supabase.rpc('sql', {
      query: `
        DROP VIEW IF EXISTS public.v_accounts_with_latest_balance;
        
        CREATE OR REPLACE VIEW public.v_accounts_with_latest_balance AS
        SELECT
          a.account_id AS account_id,
          a.user_id,
          a.name,
          a.mask,
          a.type,
          a.subtype,
          a.currency,
          a.provider,
          a.aggregator_account_id,
          a.institution_id,
          a.account_logo,
          i.name AS institution_name,
          i.logo_url AS institution_logo_url,
          i.url AS institution_url,
          i.primary_color AS institution_primary_color,
          al.status AS link_status,
          a.last_synced_at,
          COALESCE(lb.current, a.current_balance) AS balance_amount,
          COALESCE(lb.available, a.available_balance) AS available,
          lb.as_of AS balance_as_of
        FROM public.accounts a
        LEFT JOIN public.account_links al ON a.account_link_id = al.id
        LEFT JOIN public.institutions i ON i.institution_id = al.institution_id
        LEFT JOIN LATERAL (
          SELECT b.current, b.available, b.as_of
          FROM public.balances b
          WHERE b.account_id = a.account_id
          ORDER BY b.as_of DESC, b.created_at DESC
          LIMIT 1
        ) lb ON TRUE;

        -- Backfill accounts.institution_id where missing, from account_links
        UPDATE public.accounts a
        SET institution_id = al.institution_id
        FROM public.account_links al
        WHERE a.account_link_id = al.id AND a.institution_id IS NULL;
      `,
    });

    if (balancesTableError || institutionsError || accountsError || viewError) {
      console.error('Migration errors:', {
        balancesTableError,
        institutionsError,
        accountsError,
        viewError,
      });
      return NextResponse.json(
        {
          error: 'Migration failed',
          details: { balancesTableError, institutionsError, accountsError, viewError },
        },
        { status: 500 },
      );
    }

    console.log('Migration completed successfully');
    return NextResponse.json({ success: true, message: 'Migration completed' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error,
      },
      { status: 500 },
    );
  }
}
