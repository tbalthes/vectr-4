import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// POST /api/aggregator/plaid/create_link_token
// Returns a link_token from Plaid for frontend Link component
export async function POST() {
  console.log('=== CREATE LINK TOKEN REQUEST ===');

  const supabase = createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.log('User check:', { hasUser: !!userData?.user, userError });
  if (userError) {
    console.error('User error:', userError);
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }
  if (!userData?.user) {
    console.error('No user session');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  console.log('Using Plaid environment:', process.env.PLAID_ENV || 'sandbox');

  console.log('=== PLAID SANDBOX INSTRUCTIONS ===');
  console.log('At phone verification screen:');
  console.log('- Use test phone: 415-555-0010 (new user) or 415-555-0011 (returning user)');
  console.log('- Use test OTP: 123456');
  console.log('- Then select test bank and use: user_good / pass_good');
  console.log('=====================================');

  try {
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

    const linkTokenRequest = {
      user: { client_user_id: userData.user.id },
      client_name: 'Vectr Personal Finance',
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
      language: 'en' as const,
      webhook:
        process.env.PLAID_WEBHOOK_URL ||
        `${process.env.NEXT_PUBLIC_APP_URL}/api/aggregator/webhook`,
      transactions: {
        days_requested: 20, // Maximum transaction history (70 days)
      },
    };

    console.log('Creating Plaid link token with request:', linkTokenRequest);

    console.log('Creating Plaid link token with request:', linkTokenRequest);

    const response = await client.linkTokenCreate(linkTokenRequest);
    console.log('Plaid link token created successfully');
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid linkTokenCreate error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        response?: { data?: unknown; status?: number };
      };
      console.error('Plaid API error response:', axiosError.response?.data);
      console.error('Status:', axiosError.response?.status);
    }
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
