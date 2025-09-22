import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from 'plaid';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// POST /api/aggregator/plaid/exchange_public_token
// Body: { public_token: string }
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: userError?.message || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const public_token = body?.public_token as string | undefined;
  if (!public_token) {
    return NextResponse.json({ error: 'public_token required' }, { status: 400 });
  }

  // Validate required environment variables
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    console.error('Missing required Plaid configuration:');
    console.error('- PLAID_CLIENT_ID present:', !!process.env.PLAID_CLIENT_ID);
    console.error('- PLAID_SECRET present:', !!process.env.PLAID_SECRET);
    return NextResponse.json(
      {
        error:
          'Plaid configuration missing. Please set PLAID_CLIENT_ID and PLAID_SECRET environment variables.',
      },
      { status: 500 },
    );
  }

  console.log('Exchange token request received:');
  console.log('- public_token:', public_token.substring(0, 20) + '...');
  console.log('- PLAID_ENV:', process.env.PLAID_ENV || 'sandbox');

  try {
    // Plaid integration
    const configuration = new Configuration({
      basePath:
        PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] ||
        PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });

    const client = new PlaidApi(configuration);

    console.log('Attempting to exchange public token with Plaid...');

    // Exchange public token for access token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token,
    });

    console.log('Public token exchange successful');
    const { access_token, item_id } = exchangeResponse.data;
    console.log('Received access_token and item_id:', {
      item_id,
      access_token_length: access_token.length,
    });

    // Get accounts
    console.log('Fetching accounts from Plaid...');
    const accountsResponse = await client.accountsGet({
      access_token,
    });

    console.log('Accounts fetched successfully, count:', accountsResponse.data.accounts.length);
    const plaidAccounts = accountsResponse.data.accounts;

    // Get institution info
    console.log('Fetching item info from Plaid...');
    const itemResponse = await client.itemGet({ access_token });
    const institutionId = itemResponse.data.item.institution_id;
    console.log('Item info fetched, institution_id:', institutionId);

    let institution = null;
    if (institutionId) {
      console.log('Fetching institution details from Plaid...');
      const institutionResponse = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institution = institutionResponse.data.institution;
      console.log('Institution details fetched:', {
        name: institution.name,
        institution_id: institution.institution_id,
        logo: institution.logo,
        primary_color: institution.primary_color,
        url: institution.url,
        has_logo: !!institution.logo,
      });
    }

    // Store institution
    console.log('Storing institution in database...');
    let institutionRecord = null;
    if (institution) {
      console.log('Institution data to store:', {
        institution_id: institution.institution_id,
        name: institution.name,
        logo_url: institution.logo || null,
        has_logo: !!institution.logo,
      });

      // First try to find existing institution
      const { data: existingInstitution } = await supabase
        .from('institutions')
        .select()
        .eq('institution_id', institution.institution_id)
        .single();

      if (existingInstitution) {
        console.log('Institution already exists:', existingInstitution.institution_id);
        institutionRecord = existingInstitution;
      } else {
        // Create new institution with Plaid ID
        const { data, error } = await supabase
          .from('institutions')
          .insert({
            institution_id: institution.institution_id, // Use Plaid institution ID directly
            provider: 'plaid',
            name: institution.name,
            logo_url: institution.logo || null,
            url: institution.url || null,
            primary_color: institution.primary_color || null,
            country_codes: institution.country_codes || null,
            metadata: {
              plaid_institution_data: institution,
            },
          })
          .select()
          .single();

        if (error) {
          console.error('Institution insert error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        institutionRecord = data;
        console.log('Institution stored successfully:', institutionRecord.institution_id);
      }
    }

    // Store account_link (encrypted access token)
    console.log('Storing account link in database...');
    const { data: accountLinkData, error: linkError } = await supabase
      .from('account_links')
      .insert({
        user_id: userData.user.id,
        provider: 'plaid',
        item_id,
        access_token_encrypted: access_token, // TODO: Encrypt this in production
        status: 'active',
        last_synced_at: new Date().toISOString(),
        institution_id: institutionRecord?.institution_id || null,
      })
      .select()
      .single();

    if (linkError) {
      console.error('Account link insert error:', linkError);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
    console.log('Account link stored successfully');

    // Store accounts
    console.log('Storing accounts in database...');
    const accountsToInsert = plaidAccounts.map((account) => ({
      user_id: userData.user.id,
      name: account.name,
      mask: account.mask || null,
      type: account.type?.toLowerCase?.() || account.type,
      subtype: account.subtype || null,
      official_name: account.official_name || null,
      currency: account.balances.iso_currency_code || 'USD',
      provider: 'plaid',
      aggregator_account_id: account.account_id,
      account_link_id: accountLinkData.id,
      institution_id: institutionRecord?.institution_id || null,
    }));

    console.log('Accounts to insert:', accountsToInsert.length);
    const { data: createdAccounts, error: accountsError } = await supabase
      .from('accounts')
      .insert(accountsToInsert)
      .select();

    if (accountsError) {
      console.error('Accounts insert error:', accountsError);
      return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }
    console.log('Accounts stored successfully, count:', createdAccounts?.length);

    // Store balances
    console.log('Storing balances in database...');
    // Build a lookup to ensure we map the right Plaid account to the created DB account by aggregator_account_id
    const plaidById = new Map(plaidAccounts.map((p) => [p.account_id, p] as const));
    interface CreatedAccount {
      account_id: string;
      aggregator_account_id?: string;
      [key: string]: any;
    }

    interface PlaidAccount {
      account_id: string;
      balances: {
        current?: number | null;
        available?: number | null;
        iso_currency_code?: string | null;
        [key: string]: any;
      };
      [key: string]: any;
    }

    interface BalanceToInsert {
      account_id: string;
      current: number;
      available: number;
      iso_currency_code: string;
      as_of: string;
    }

    const balancesToInsert: BalanceToInsert[] = (createdAccounts || [])
      .map((account: CreatedAccount) => {
      const dbAcc: CreatedAccount = account;
      const plaidAcc: PlaidAccount | undefined = plaidById.get(dbAcc.aggregator_account_id || '');
      if (!plaidAcc) {
        return null;
      }
      return {
        account_id: dbAcc.account_id,
        current: plaidAcc.balances.current ?? 0,
        available: plaidAcc.balances.available ?? plaidAcc.balances.current ?? 0,
        iso_currency_code: plaidAcc.balances.iso_currency_code || 'USD',
        as_of: new Date().toISOString(),
      };
      })
      .filter(Boolean) as BalanceToInsert[];

    if (balancesToInsert.length > 0) {
      const { error: balancesError } = await supabase.from('balances').insert(balancesToInsert);

      if (balancesError) {
        console.error('Balances insert error:', balancesError);
        console.warn('Falling back to updating accounts current/available balances...');

        // Fallback: update accounts table balances if balances table insert fails
        for (const b of balancesToInsert) {
          const { error: acctUpdateError } = await supabase
            .from('accounts')
            .update({
              current_balance: b.current,
              available_balance: b.available,
              updated_at: new Date().toISOString(),
            })
            .eq('account_id', b.account_id);

          if (acctUpdateError) {
            console.warn('Accounts balance update failed for', b.account_id, acctUpdateError);
          }
        }
      } else {
        console.log('Balances stored successfully, count:', balancesToInsert.length);
      }
    }

    // Trigger initial transaction sync
    console.log('🔄 Triggering initial transaction sync...');
    try {
      const syncResponse = await fetch(
        `http://localhost:3000/api/aggregator/plaid/transactions/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Forward the authentication cookies
            Cookie: req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            user_id: userData.user.id, // ADD THIS - was missing!
            access_token,
            count: 50, // Get more transactions on initial sync
          }),
        },
      );

      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        console.log('✅ Initial sync completed:', {
          added: syncResult.added,
          accounts: syncResult.accounts?.length || 0,
        });
      } else {
        const errorText = await syncResponse.text();
        console.warn('⚠️ Initial sync failed:', errorText);
      }
    } catch (syncError) {
      console.warn('⚠️ Initial sync error:', syncError);
      // Don't fail the whole flow for sync issues
    }

    console.log('=== PLAID INTEGRATION COMPLETE ===');
    return NextResponse.json({
      ok: true,
      accounts: createdAccounts?.length || 0,
      accountName: createdAccounts?.[0]?.name || 'Unknown Account',
    });
  } catch (error) {
    console.error('Plaid token exchange error:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
