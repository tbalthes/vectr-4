import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// POST /api/admin/migrate
// Run database migrations (for development)
export async function POST() {
  const supabase = createRouteHandlerClient({
    cookies: () => cookies(),
  });

  try {
    console.log('Running database migration...');

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
          a.id AS account_id,
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
          a.last_synced_at,
          lb.balance_amount,
          lb.available,
          lb.as_of AS balance_as_of
        FROM public.accounts a
        LEFT JOIN LATERAL (
          SELECT b.balance_amount, b.available, b.as_of
          FROM public.balances b
          WHERE b.account_id = a.id
          ORDER BY b.as_of DESC
          LIMIT 1
        ) lb ON TRUE
        LEFT JOIN public.institutions i ON i.id = a.institution_id;
      `,
    });

    if (institutionsError || accountsError || viewError) {
      console.error('Migration errors:', {
        institutionsError,
        accountsError,
        viewError,
      });
      return NextResponse.json(
        {
          error: 'Migration failed',
          details: { institutionsError, accountsError, viewError },
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
