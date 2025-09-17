import { createPlaidClientFromEnv } from './client';

export async function fetchAccountsForItem(accessToken: string) {
  const client = createPlaidClientFromEnv();
  // placeholder: call /accounts/get or similar
  return client.post('/accounts/get', { access_token: accessToken });
}
