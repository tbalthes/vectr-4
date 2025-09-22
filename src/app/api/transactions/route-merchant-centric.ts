/**
 * Updated transactions API route to use merchant-centric data model
 * This version prioritizes merchant_name + merchant_id over clean_description/original_description
 */

import { type NextRequest, NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';


// Use the new API view that joins merchant data
const TRANSACTIONS_QUERY = `
  SELECT 
    t.transaction_id as id,
    t.created_at,
    t.user_id,
    t.account_id,
    t.amount,
    t.authorized_date as date,
    
    -- Merchant data (prioritized)
    COALESCE(m.merchant_name, t.merchant_name, 'Unknown Merchant') as description,
    t.merchant_id,
    m.merchant_name,
    m.logo_url as merchant_logo_url,
    m.merchant_website,
    
    -- Legacy description fields (for backwards compatibility)
    t.original_description,
    t.name as plaid_raw_name,
    
    -- Category information
    t.category_id,
    c.category_name,
    c.category_icon,
    
    -- Account and institution info
    a.account_name,
    a.account_mask,
    i.institution_name,
    i.institution_logo_url,
    
    -- Transaction metadata
    t.transaction_note,
    t.needs_review,
    t.hidden,
    t.manual_edit,
    t.review_status,
    t.user_metadata,
    t.balance,
    t.transaction_number,
    
    -- Plaid-specific fields
    t.aggregator_transaction_id,
    t.payment_channel,
    t.transaction_type,
    t.pending
    
  FROM transactions t
  LEFT JOIN merchants m ON t.merchant_id = m.merchant_id
  LEFT JOIN categories c ON t.category_id = c.category_id
  LEFT JOIN accounts a ON t.account_id = a.account_id
  LEFT JOIN institutions i ON a.institution_id = i.institution_id
  WHERE t.user_id = $1
    AND ($2::uuid IS NULL OR t.account_id = $2)
    AND ($3::text IS NULL OR t.category_id = $3::uuid)
    AND ($4::boolean IS NULL OR t.needs_review = $4)
    AND ($5::boolean IS NULL OR t.hidden = $5)
    AND ($6::date IS NULL OR t.authorized_date >= $6)
    AND ($7::date IS NULL OR t.authorized_date <= $7)
    AND (
      $8::text IS NULL OR 
      LOWER(COALESCE(m.merchant_name, t.merchant_name, t.original_description)) LIKE LOWER($8)
    )
  ORDER BY t.authorized_date DESC, t.created_at DESC
  LIMIT $9 OFFSET $10
`;

const COUNT_QUERY = `
  SELECT COUNT(*) as total
  FROM transactions t
  LEFT JOIN merchants m ON t.merchant_id = m.merchant_id
  WHERE t.user_id = $1
    AND ($2::uuid IS NULL OR t.account_id = $2)
    AND ($3::text IS NULL OR t.category_id = $3::uuid)
    AND ($4::boolean IS NULL OR t.needs_review = $4)
    AND ($5::boolean IS NULL OR t.hidden = $5)
    AND ($6::date IS NULL OR t.authorized_date >= $6)
    AND ($7::date IS NULL OR t.authorized_date <= $7)
    AND (
      $8::text IS NULL OR 
      LOWER(COALESCE(m.merchant_name, t.merchant_name, t.original_description)) LIKE LOWER($8)
    )
`;

interface TransactionRow {
  id: string;
  created_at: string;
  user_id: string;
  account_id: string;
  amount: number;
  date: string;

  // Merchant fields (prioritized)
  description: string;
  merchant_id: string | null;
  merchant_name: string | null;
  merchant_logo_url: string | null;
  merchant_website: string | null;

  // Legacy fields
  original_description: string | null;
  plaid_raw_name: string | null;

  // Category fields
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;

  // Account fields
  account_name: string | null;
  account_mask: string | null;
  institution_name: string | null;
  institution_logo_url: string | null;

  // Transaction metadata
  transaction_note: string | null;
  needs_review: boolean;
  hidden: boolean;
  manual_edit: boolean;
  review_status: string | null;
  user_metadata: any;
  balance: number | null;
  transaction_number: string | null;

  // Plaid fields
  aggregator_transaction_id: string | null;
  payment_channel: string | null;
  transaction_type: string | null;
  pending: string | null;
}

interface FormattedTransaction {
  id: string;
  transaction_number: string | null;
  date: string;
  description: string;
  amount: number;
  originalDescription: string | null;
  balance: number | null;
  userMetadata: any;
  needsReview: boolean;
  merchantName: string;
  merchantLogoUrl: string | null;
  categoryName: string;
  categoryIcon: string;
  type: 'income' | 'expense';
  category: string;
  account: string;
  status: 'pending' | 'completed';
  note: string | undefined;

  // Additional merchant fields for enhanced UI
  merchantId: string | null;
  merchantWebsite: string | null;

  // Plaid metadata for debugging
  plaidTransactionId: string | null;
  paymentChannel: string | null;
  transactionType: string | null;
  pending: boolean;
}

function formatTransaction(raw: TransactionRow): FormattedTransaction {
  // Prioritize merchant data over legacy description fields
  const displayName = raw.merchant_name || raw.description || 'Unknown Merchant';
  const accountMask = raw.account_mask;
  const formattedAccountName = accountMask
    ? `${raw.account_name || 'Unknown Account'} (...${accountMask})`
    : raw.account_name || 'Unknown Account';

  return {
    id: raw.id,
    transaction_number: raw.transaction_number,
    date: raw.date,
    description: displayName,
    amount: raw.amount,
    originalDescription: raw.original_description,
    balance: raw.balance,
    userMetadata: raw.user_metadata,
    needsReview: raw.needs_review,
    merchantName: displayName,
    merchantLogoUrl: raw.merchant_logo_url,
    categoryName: raw.category_name || 'Uncategorized',
    categoryIcon: raw.category_icon || 'HelpCircle',
    type: raw.amount > 0 ? 'income' : 'expense',
    category: raw.category_name || 'Uncategorized',
    account: formattedAccountName,
    status: raw.needs_review ? 'pending' : 'completed',
    note: raw.transaction_note || undefined,

    // Enhanced merchant fields
    merchantId: raw.merchant_id,
    merchantWebsite: raw.merchant_website,

    // Plaid metadata
    plaidTransactionId: raw.aggregator_transaction_id,
    paymentChannel: raw.payment_channel,
    transactionType: raw.transaction_type,
    pending:
      (typeof raw.pending === 'boolean' && raw.pending === true) ||
      raw.pending === 'true' ||
      (typeof raw.pending === 'number' && raw.pending === 1) ||
      raw.pending === '1'
        ? true
        : false,
  };
}

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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Filters
    const accountId = searchParams.get('account_id') || null;
    const categoryId = searchParams.get('category_id') || null;
    const needsReview =
      searchParams.get('needs_review') === 'true'
        ? true
        : searchParams.get('needs_review') === 'false'
          ? false
          : null;
    const hidden =
      searchParams.get('hidden') === 'true'
        ? true
        : searchParams.get('hidden') === 'false'
          ? false
          : null;
    const startDate = searchParams.get('start_date') || null;
    const endDate = searchParams.get('end_date') || null;
    const search = searchParams.get('search') ? `%${searchParams.get('search')}%` : null;

    // Execute queries in parallel
    const [transactionsResult, countResult] = await Promise.all([
      supabase.rpc('exec_sql', {
        query: TRANSACTIONS_QUERY,
        params: [
          user.id,
          accountId,
          categoryId,
          needsReview,
          hidden,
          startDate,
          endDate,
          search,
          limit,
          offset,
        ],
      }),
      supabase.rpc('exec_sql', {
        query: COUNT_QUERY,
        params: [user.id, accountId, categoryId, needsReview, hidden, startDate, endDate, search],
      }),
    ]);

    if (transactionsResult.error) {
      console.error('Database error (transactions):', transactionsResult.error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (countResult.error) {
      console.error('Database error (count):', countResult.error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const transactions = (transactionsResult.data || []).map(formatTransaction);
    const total = countResult.data?.[0]?.total || 0;

    return NextResponse.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in transactions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const {
      account_id,
      amount,
      date,
      merchant_name, // Changed from description to merchant_name
      category_id,
      transaction_note,
    } = body;

    if (!account_id || !amount || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, amount, date' },
        { status: 400 },
      );
    }

    // Find or create merchant if merchant_name provided
    let merchant_id = null;
    if (merchant_name && merchant_name.trim() !== '') {
      // Try to find existing merchant
      const { data: existingMerchant } = await supabase
        .from('merchants')
        .select('merchant_id')
        .eq('user_id', user.id)
        .ilike('merchant_name', merchant_name.trim())
        .single();

      if (existingMerchant) {
        merchant_id = existingMerchant.merchant_id;
      } else {
        // Create new merchant
        const { data: newMerchant, error: merchantError } = await supabase
          .from('merchants')
          .insert({
            merchant_name: merchant_name.trim(),
            user_id: user.id,
            aggregator_merchant_id: `manual_${Date.now()}`,
          })
          .select('merchant_id')
          .single();

        if (merchantError) {
          console.error('Error creating merchant:', merchantError);
          return NextResponse.json({ error: 'Failed to create merchant' }, { status: 500 });
        }

        merchant_id = newMerchant.merchant_id;
      }
    }

    // Insert transaction
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id,
        amount,
        authorized_date: date,
        transaction_date: date,
        merchant_id,
        merchant_name: merchant_name || null,
        original_description: merchant_name || 'Manual Entry',
        category_id: category_id || null,
        transaction_note: transaction_note || null,
        manual_edit: true,
        needs_review: false,
        user_metadata: {
          source: 'manual_entry',
          created_via_api: true,
        },
      })
      .select('transaction_id')
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        transaction_id: data.transaction_id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in POST transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
