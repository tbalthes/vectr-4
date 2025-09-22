// src/types/transactions.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// This is the "raw" type that matches the `transactions` table in the database
export interface Transaction {
  transaction_id: string;
  user_id: string;
  account_id: string;
  aggregator_transaction_id: string | null;
  merchant_id: string | null;
  category_id: string | null;
  original_description: string | null;
  merchant_name: string | null;
  amount: number;
  currency: string | null;
  date: string;
  authorized_date: string | null;
  pending: boolean | null;
  transaction_type: string | null;
  logo_url: string | null;
  website: string | null;
  plaid_entity_id: string | null;
  primary_category: string | null;
  detailed_category: string | null;
  category_confidence_level: string | null;
  payment_channel: string | null;
  check_number: string | null;
  location: Json | null;
  payment_meta: Json | null;
  user_metadata: Json | null;
  needs_review: boolean | null;
  is_hidden: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// This type represents the data returned from a Supabase query with joins
export interface TransactionWithRelations
  extends Omit<Transaction, 'account_id' | 'merchant_id' | 'category_id'> {
  accounts: {
    account_id: string;
    name: string;
    mask: string | null;
    type: string;
  } | null;
  merchants: {
    merchant_id: string;
    name: string;
    logo_url: string | null;
  } | null;
  categories: {
    category_id: string;
    category: string; // machine key, e.g., FOOD_AND_DRINK
    name?: string | null; // display name, optional
    icon?: string | null; // legacy/custom icon field
    lucide_icon?: string | null; // preferred lucide icon name
  } | null;
}

// This is the flattened type our UI components will use for easier prop passing
export interface FormattedTransaction {
  originalDescription: any;
  transactionId: string;
  accountId: string;
  date: string;
  description: string; // This will be the merchant name or original description
  amount: number;
  currency: string | null;
  pending: boolean;

  // Enriched data
  merchantName: string | null;
  merchantLogoUrl: string | null;
  categoryName: string | null;
  categoryIcon: string | null;

  // Account info
  accountName: string;
  accountMask: string | null;

  // For UI state
  needsReview: boolean;
  isHidden: boolean;
  notes: string | null;

  // For compatibility with generic components, if needed
  type: 'income' | 'expense';
  status: 'completed' | 'pending';

  // Raw data for details views
  originalData: TransactionWithRelations;
}

// Type representing the shape returned by the Supabase query used in `getTransactionsWithDetails`
export interface TransactionFromApi {
  id: number | string;
  transaction_number?: string | null;
  date?: string | null;
  clean_description?: string | null;
  amount?: number | null;
  original_description?: string | null;
  balance?: number | null;
  user_metadata?: Json | null;
  needs_review?: boolean | null;
  accounts?: {
    id?: number | string;
    name?: string | null;
    mask?: string | null;
    type?: string | null;
  } | null;
  merchants?: {
    name?: string | null;
    logo_url?: string | null;
    categories?: {
      name?: string | null;
      icon?: string | null;
    } | null;
  } | null;
}
