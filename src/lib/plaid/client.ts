import type { PlaidEnvironment, PlaidSyncRequest, PlaidSyncResponse } from './types';

function resolvePlaidBase(): string {
  // Explicit override takes precedence
  if (process.env.PLAID_BASE_URL) {
    return process.env.PLAID_BASE_URL;
  }
  const env = (process.env.PLAID_ENV || 'sandbox').toLowerCase() as PlaidEnvironment;
  switch (env) {
    case 'production':
      return 'https://production.plaid.com';
    case 'development':
      return 'https://development.plaid.com';
    case 'sandbox':
    default:
      return 'https://sandbox.plaid.com';
  }
}

const PLAID_BASE = resolvePlaidBase();

export class PlaidClient {
  private clientId: string;
  private secret: string;

  constructor(clientId: string, secret: string) {
    this.clientId = clientId;
    this.secret = secret;
  }

  async post(path: string, body: any) {
    const res = await fetch(`${PLAID_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: this.clientId, secret: this.secret, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(JSON.stringify({ status: res.status, body: data }));
    }
    return data;
  }

  // placeholder: exchange public_token -> access_token
  async exchangePublicToken(publicToken: string) {
    return this.post('/item/public_token/exchange', { public_token: publicToken });
  }

  // create link token for initialization
  async createLinkToken(userId: string, additionalOptions?: any) {
    const request = {
      user: {
        client_user_id: userId,
      },
      client_name: "Vectr Personal Finance",
      products: ["transactions", "auth"],
      country_codes: ["US"],
      language: "en",
      webhook: additionalOptions?.webhook || process.env.PLAID_WEBHOOK_URL,
      ...additionalOptions,
    };
    return this.post('/link/token/create', request);
  }

  // fetch transactions sync
  async transactionsSync(accessToken: string, cursor?: string | null, count?: number) {
    return this.post('/transactions/sync', { access_token: accessToken, cursor, count });
  }
}

export function createPlaidClientFromEnv() {
  const id = process.env.PLAID_CLIENT_ID || '';
  const secret = process.env.PLAID_SECRET || '';
  return new PlaidClient(id, secret);
}

// Convenience wrapper to align with service layer usage
export async function transactionsSync(req: PlaidSyncRequest): Promise<PlaidSyncResponse> {
  const client = createPlaidClientFromEnv();
  const { access_token, cursor = null, count } = req;
  return client.transactionsSync(access_token, cursor ?? null, count);
}
