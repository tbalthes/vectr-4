// Plaid-related shared types
export interface PlaidItem {
  item_id: string;
  institution_id?: string;
  access_token?: string;
}

export interface PlaidEvent {
  webhook_type: string;
  webhook_code: string;
  item_id?: string;
  event_id?: string;
  request_id?: string;
  [k: string]: any;
}

export type PlaidEnvironment = 'sandbox' | 'development' | 'production';

export interface PlaidConfig {
  clientId: string;
  secret: string;
  env: PlaidEnvironment;
  baseUrl: string; // derived from env
}

export interface PlaidSyncRequest {
  access_token: string;
  cursor?: string | null;
  count?: number; // default 100
}

export interface PlaidRemovedTx {
  transaction_id: string;
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  name?: string | null;
  merchant_name?: string | null;
  amount: number;
  iso_currency_code?: string | null;
  date: string; // YYYY-MM-DD
  [k: string]: any; // keep raw passthrough
}

export interface PlaidSyncResponse {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: PlaidRemovedTx[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface SyncSummary {
  ok: boolean;
  item_id?: string;
  user_id?: string;
  added_count: number;
  modified_count: number;
  removed_count: number;
  final_cursor: string | null;
  duration_ms: number;
}

export interface WebhookEvent {
  provider: 'plaid';
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  // raw payload retained for debugging
  raw: any;
}

export interface SyncTriggerParams {
  access_token: string;
  cursor?: string | null;
  count?: number;
  user_id: string;
  item_id?: string;
}
