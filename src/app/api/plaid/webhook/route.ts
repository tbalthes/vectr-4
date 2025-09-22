import { NextResponse } from 'next/server';

// POST /api/plaid/webhook
// Handles Plaid webhooks and forwards to Python FastAPI backend
export async function POST(req: Request) {
  try {
    console.log('📥 Plaid webhook received');

    const body = await req.json().catch(() => ({}));

    // Log webhook details
    console.log('Webhook payload:', {
      webhook_type: body.webhook_type,
      webhook_code: body.webhook_code,
      item_id: body.item_id,
    });

    // Forward to Python FastAPI webhook handler
    const pythonWebhookUrl = `${process.env.PYTHON_API_URL || 'http://localhost:8000'}/webhook`;

    try {
      const response = await fetch(pythonWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Webhook forwarded successfully to Python backend');
        return NextResponse.json(result);
      } else {
        console.error('❌ Python webhook handler error:', response.status, response.statusText);
        // Still return 200 to Plaid to stop retries
        return NextResponse.json({
          status: 'acknowledged',
          message: 'Webhook received but backend processing failed',
        });
      }
    } catch (forwardError) {
      console.error('❌ Failed to forward webhook to Python backend:', forwardError);
      // Still return 200 to Plaid to stop retries
      return NextResponse.json({
        status: 'acknowledged',
        message: 'Webhook received but backend unavailable',
      });
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Always return 200 to Plaid to stop retries
    return NextResponse.json({
      status: 'error',
      message: 'Webhook processing failed',
    });
  }
}
