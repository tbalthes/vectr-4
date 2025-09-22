import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getCachedUser } from '@/lib/auth-cache';

// GET /api/accounts
// Returns accounts with latest balance and institution meta without relying on a DB view
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const { user, error: userError } = await getCachedUser(supabase, 'accounts-route');
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User validation failed', details: userError?.message || 'No user found' },
        { status: 401 },
      );
    }

    const userId = user.id;

    // 1) Fetch accounts for the user
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select(
        `account_id, user_id, name, mask, type, subtype, currency, provider, aggregator_account_id, institution_id, account_logo, last_synced_at, current_balance, available_balance, account_link_id`,
      )
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (accountsError) {
      return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }

    const accountList = accounts || [];
    if (accountList.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    const accountIds = accountList.map((a) => a.account_id);
    const linkIds = accountList.map((a) => a.account_link_id).filter(Boolean) as string[];
    const institutionIds = Array.from(
      new Set(accountList.map((a) => a.institution_id).filter(Boolean) as string[]),
    );

    // 2) Fetch latest balances for all accounts (reduce in memory)
    const { data: balances, error: balancesError } = await supabase
      .from('balances')
      .select('account_id, current, available, as_of, created_at')
      .in('account_id', accountIds)
      .order('as_of', { ascending: false })
      .order('created_at', { ascending: false });

    if (balancesError) {
      console.warn('balances fetch error:', balancesError.message);
    }

    const latestBalanceByAccount = new Map<
      string,
      { current: number | null; available: number | null; as_of: string | null }
    >();
    for (const b of balances || []) {
      if (!latestBalanceByAccount.has(b.account_id)) {
        latestBalanceByAccount.set(b.account_id, {
          current: b.current ?? null,
          available: b.available ?? null,
          as_of: b.as_of ?? null,
        });
      }
    }

    // 3) Fetch institutions either directly by institution_id or via account_links when missing
    const [institutionsRes, linksRes] = await Promise.all([
      institutionIds.length
        ? supabase
            .from('institutions')
            .select('institution_id, name, logo_url, url, primary_color')
            .in('institution_id', institutionIds)
        : Promise.resolve({ data: [], error: null } as any),
      linkIds.length
        ? supabase.from('account_links').select('id, institution_id').in('id', linkIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const institutions = institutionsRes?.data ?? [];
    const links = linksRes?.data ?? [];
    const instById = new Map<string, any>(institutions.map((i: any) => [i.institution_id, i]));
    const linkInstByLinkId = new Map<string, string>(
      links.map((l: any) => [l.id, l.institution_id]),
    );

    // 4) Compose response
    const mappedAccounts = accountList.map((a) => {
      const lb = latestBalanceByAccount.get(a.account_id);
      const instId = a.institution_id || linkInstByLinkId.get(a.account_link_id) || null;
      const inst = instId ? instById.get(instId) : null;
      return {
        id: a.account_id,
        account_id: a.account_id,
        user_id: a.user_id,
        name: a.name,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        currency: a.currency,
        provider: a.provider,
        aggregator_account_id: a.aggregator_account_id,
        institution_id: instId,
        institution_name: inst?.name || null,
        institution_logo_url: inst?.logo_url || null,
        institution_url: inst?.url || null,
        institution_primary_color: inst?.primary_color || null,
        account_logo: a.account_logo,
        last_synced_at: a.last_synced_at,
        balance_amount: lb?.current ?? a.current_balance ?? 0,
        available: lb?.available ?? a.available_balance ?? 0,
        balance_as_of: lb?.as_of ?? null,
      };
    });

    return NextResponse.json({ accounts: mappedAccounts });
  } catch (error) {
    console.error('Error in /api/accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
