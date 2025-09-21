import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// POST /api/accounts/manual
// Create a manual account (not connected via aggregator)
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: userError?.message || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body required' }, { status: 400 });
    }

    const {
      institution_id,
      name,
      type,
      subtype,
      mask,
      currency = 'USD',
      account_logo,
      initial_balance,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
    }

    if (!type || !['depository', 'credit', 'loan', 'investment', 'other'].includes(type)) {
      return NextResponse.json(
        {
          error: 'Account type must be one of: depository, credit, loan, investment, other',
        },
        { status: 400 },
      );
    }

    // Validate institution exists if provided
    let institutionRecord = null;
    if (institution_id) {
      const { data: institution, error: instError } = await supabase
        .from('institutions')
        .select('id, name')
        .eq('id', institution_id)
        .single();

      if (instError || !institution) {
        return NextResponse.json(
          {
            error: 'Institution not found',
          },
          { status: 404 },
        );
      }
      institutionRecord = institution;
    }

    // Create the account
    const accountData = {
      user_id: userData.user.id,
      name: name.trim(),
      type: type.toLowerCase(),
      subtype: subtype || null,
      mask: mask || null,
      currency: currency.toUpperCase(),
      provider: 'manual',
      aggregator_account_id: null, // No external account ID for manual accounts
      institution_id: institution_id || null,
      account_logo: account_logo || null,
      plaid_access_token: null, // Manual accounts don't have access tokens
      last_synced_at: null, // Manual accounts aren't synced
    };

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert(accountData)
      .select()
      .single();

    if (accountError) {
      console.error('Account insert error:', accountError);
      return NextResponse.json(
        {
          error: 'Failed to create account',
          details: accountError.message,
        },
        { status: 500 },
      );
    }

    console.log('Manual account created successfully:', {
      id: account.id,
      name: account.name,
      type: account.type,
      institution: institutionRecord?.name || 'No institution',
    });

    // Create initial balance if provided
    if (initial_balance !== undefined && initial_balance !== null) {
      const balanceData = {
        account_id: account.id,
        balance_amount: Number(initial_balance),
        available: Number(initial_balance), // For manual accounts, available = current
        as_of: new Date().toISOString(),
      };

      const { error: balanceError } = await supabase.from('balances').insert(balanceData);

      if (balanceError) {
        console.warn('Failed to create initial balance:', balanceError);
        // Don't fail the account creation, just log the warning
      } else {
        console.log('Initial balance created:', initial_balance);
      }
    }

    // Return the account in the same format as the accounts API
    const { data: fullAccount, error: fetchError } = await supabase
      .from('v_accounts_with_latest_balance')
      .select('*')
      .eq('account_id', account.id)
      .single();

    if (fetchError) {
      console.warn('Failed to fetch full account data:', fetchError);
      // Return basic account data as fallback
      return NextResponse.json({
        success: true,
        account: {
          ...account,
          institution_name: institutionRecord?.name || null,
          institution_logo_url: null,
          balance_amount: initial_balance || 0,
          available: initial_balance || 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      account: {
        id: fullAccount.account_id,
        user_id: fullAccount.user_id,
        name: fullAccount.name,
        type: fullAccount.type,
        subtype: fullAccount.subtype,
        mask: fullAccount.mask,
        currency: fullAccount.currency,
        provider: fullAccount.provider,
        aggregator_account_id: fullAccount.aggregator_account_id,
        institution_id: fullAccount.institution_id,
        institution_name: fullAccount.institution_name,
        institution_logo_url: fullAccount.institution_logo_url,
        institution_url: fullAccount.institution_url,
        institution_primary_color: fullAccount.institution_primary_color,
        account_logo: fullAccount.account_logo,
        last_synced_at: fullAccount.last_synced_at,
        balance_amount: fullAccount.balance_amount || 0,
        available: fullAccount.available || 0,
        as_of: fullAccount.balance_as_of,
      },
    });
  } catch (error) {
    console.error('Create manual account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
