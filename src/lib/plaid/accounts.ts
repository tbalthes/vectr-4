import { createPlaidClientFromEnv } from './client';

// Create link token for Plaid Link initialization
export async function createLinkToken(userId: string, options?: { 
  webhook?: string;
  daysRequested?: number;
}) {
  const client = createPlaidClientFromEnv();
  
  const additionalOptions = {
    webhook: options?.webhook || 
      process.env.PLAID_WEBHOOK_URL || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/aggregator/webhook`,
    transactions: {
      days_requested: options?.daysRequested || 730, // 2 years default
    },
  };
  
  return client.createLinkToken(userId, additionalOptions);
}

export async function fetchAccountsForItem(accessToken: string) {
  const client = createPlaidClientFromEnv();
  // placeholder: call /accounts/get or similar
  return client.post('/accounts/get', { access_token: accessToken });
}
