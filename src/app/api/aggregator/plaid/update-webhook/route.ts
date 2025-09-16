import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// POST /api/aggregator/plaid/update-webhook
// Updates webhook URL for existing Plaid items
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept either snake_case or camelCase from callers
    const item_id = (body?.item_id ?? body?.itemId) as string | undefined;

    if (!item_id) {
      return NextResponse.json({ error: 'item_id (or itemId) required' }, { status: 400 });
    }

    // Initialize Plaid client
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

    // Update webhook URL
    const webhookUrl =
      process.env.PLAID_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/aggregator/webhook`;

    console.log(`🔄 Updating webhook for item ${item_id} to: ${webhookUrl}`);

    // The Plaid SDK typings have varied between versions (snake_case vs camelCase).
    // Cast to `any` for compatibility across versions while keeping runtime payload camelCase.
    const payload: any = { itemId: item_id, webhook: webhookUrl };
    const response = await client.itemWebhookUpdate(payload);

    console.log('✅ Webhook updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Webhook URL updated successfully',
      webhook_url: webhookUrl,
      item: response.data.item,
    });
  } catch (error) {
    console.error('❌ Error updating webhook:', error);
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}
