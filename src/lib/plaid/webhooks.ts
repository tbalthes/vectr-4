import type { PlaidEvent } from './types';

/**
 * Verify Plaid webhook signature and parse body.
 * Placeholder: implement JWS/PS256 verification using PLAID_WEBHOOK_PUBLIC_KEY
 */
export function verifyPlaidWebhook(_headers: Record<string, string>, _body: string) {
  // TODO: verify signature
  return true;
}

export function parsePlaidEvent(body: any): PlaidEvent {
  // Normalize payload to PlaidEvent interface
  return {
    webhook_type: body.webhook_type,
    webhook_code: body.webhook_code,
    item_id: body?.item_id,
    event_id: body?.event_id,
    request_id: body?.request_id,
    ...body,
  };
}
