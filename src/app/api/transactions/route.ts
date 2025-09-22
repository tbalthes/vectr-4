import { type NextRequest, NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getTransactions } from '@/lib/supabase/transactions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const accountIdsParam = url.searchParams.get('accountIds');
    const fromDate = url.searchParams.get('fromDate') || undefined;
    const toDate = url.searchParams.get('toDate') || undefined;

    const accountIds = accountIdsParam ? accountIdsParam.split(',') : undefined;

    const filters = {
      accountIds,
      fromDate,
      toDate,
    };

    // The actual data fetching and formatting is now handled by getTransactions
    const transactions = await getTransactions(supabase, user.id, filters);

    // The SWR hook expects a certain data structure for pagination,
    // so we'll wrap the response. For now, we'll return all transactions
    // and handle pagination on the client, but this can be updated later
    // to support server-side pagination.
    const response = {
      data: transactions,
      meta: {
        totalItems: transactions.data.length,
        currentPage: 1,
        pageSize: transactions.data.length,
        hasNextPage: false,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('API route unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Unexpected server error', details: errorMessage },
      { status: 500 },
    );
  }
}
