import type { NextRequest } from 'next/server';

// POST /plaid/webhook
// Legacy webhook endpoint - redirects to new aggregator webhook
export async function POST(req: NextRequest) {
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const origin = req.headers.get('origin') || 'unknown';
  const referer = req.headers.get('referer') || 'unknown';
  // NextRequest doesn't expose `ip`; prefer standard proxy headers
  const xff = req.headers.get('x-forwarded-for');
  const xri = req.headers.get('x-real-ip');
  const ip = xff ? xff.split(',')[0].trim() : xri || 'unknown';

  console.log('🚨 [LOG] POST /plaid/webhook called');
  console.log('   User-Agent:', userAgent);
  console.log('   Origin:', origin);
  console.log('   Referer:', referer);
  console.log('   IP:', ip);
  console.log('   Timestamp:', new Date().toISOString());

  let body = '';
  try {
    body = await req.text();
    console.log('   Body:', body);
  } catch {
    console.log('   Body: <unparsable>');
  }

  try {
    // Forward to the new webhook endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/aggregator/webhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Aggregator-Provider': 'plaid',
          'Plaid-Verification': req.headers.get('plaid-verification') || '',
        },
        body: body,
      },
    );

    console.log(`🔄 Forwarded legacy webhook: ${response.status}`);

    const result = await response.text();
    return new Response(result, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('❌ Error forwarding legacy webhook:', error);
    return new Response(JSON.stringify({ error: 'Failed to forward webhook' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
