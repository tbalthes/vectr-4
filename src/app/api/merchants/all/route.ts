/**
 * All Merchants API Route
 * Returns all merchants with transaction counts for the current user
 * Endpoint: GET /api/merchants/all
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { createSupabaseServerClient } from '@/lib/supabase-server';

const CACHE_HEADERS = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=600', // 5 min cache
};

export interface MerchantWithCount {
  id: string;
  name: string;
  logo_url: string | null;
  transaction_count: number;
  categories?:
    | {
        category_id: string; // Fixed: categories table uses category_id
        name: string;
        icon: string;
      }[]
    | null;
}

export async function GET() {
  try {
    // DEBUG: Log all cookies received
    const allCookies = (await cookies()).getAll();
    console.log(
      '[merchants/all] Cookies received:',
      allCookies.map((c: any) => ({ name: c.name, value: c.value })),
    );

    const supabase = createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user;
    console.log('[merchants/all] Supabase user:', user);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid authentication required' },
        { status: 401, headers: CACHE_HEADERS },
      );
    }

    // Query to get all merchant_ids from transactions for this user
    const { data: transactionMerchants, error: txError } = await supabase
      .from('transactions')
      .select('merchant_id')
      .eq('user_id', user.id)
      .not('merchant_id', 'is', null);

    if (txError) {
      console.error('Error fetching transaction merchant_ids:', txError);
      return NextResponse.json(
        { error: 'Database error', message: txError.message },
        { status: 500, headers: CACHE_HEADERS },
      );
    }

    const merchantIds = Array.from(
      new Set((transactionMerchants || []).map((row: any) => row.merchant_id)),
    );
    if (merchantIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 }, { status: 200, headers: CACHE_HEADERS });
    }

    // Fetch merchants by those IDs
    const { data: merchantsData, error: merchantsError } = await supabase
      .from('merchants')
      .select(
        `
        merchant_id,
        name,
        logo_url,
        categories:default_category_id (
          category_id,
          name,
          icon
        )
      `,
      )
      .in('merchant_id', merchantIds);

    if (merchantsError) {
      console.error('Error fetching merchants:', merchantsError);
      return NextResponse.json(
        {
          error: 'Database error',
          message: merchantsError ? merchantsError.message : 'Unknown error',
        },
        { status: 500, headers: CACHE_HEADERS },
      );
    }

    // Count transactions per merchant
    const merchantTxCount: Record<string, number> = {};
    (transactionMerchants || []).forEach((row: any) => {
      if (row.merchant_id) {
        merchantTxCount[row.merchant_id] = (merchantTxCount[row.merchant_id] || 0) + 1;
      }
    });

    // Transform the data to a more usable format
    const merchants = ((merchantsData as any[]) || []).map((merchant) => {
      // Handle categories - take the first one if multiple exist
      let category = null;
      if (merchant.categories) {
        if (Array.isArray(merchant.categories) && merchant.categories.length > 0) {
          category = merchant.categories[0];
        } else if (!Array.isArray(merchant.categories)) {
          category = merchant.categories;
        }
      }

      return {
        id: merchant.merchant_id,
        name: merchant.name,
        logo_url: merchant.logo_url,
        transaction_count: merchantTxCount[merchant.merchant_id] || 0,
        categories: merchant.categories,
        category: category
          ? {
              id: category.category_id,
              name: category.name,
              icon: category.icon,
            }
          : null,
      };
    });

    // Sort by transaction count (descending)
    merchants.sort((a, b) => b.transaction_count - a.transaction_count);

    return NextResponse.json(
      {
        data: merchants,
        total: merchants.length,
      },
      {
        status: 200,
        headers: CACHE_HEADERS,
      },
    );
  } catch (error) {
    console.error('Unexpected error in merchants/all API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      },
      { status: 500, headers: CACHE_HEADERS },
    );
  }
}
