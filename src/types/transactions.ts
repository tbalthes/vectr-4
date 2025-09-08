// src/types/transactions.ts

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  account: string;
  type: "income" | "expense";
  status: "completed" | "pending";
}
// This type matches the nested structure returned by our Supabase query
export interface TransactionFromApi {
  id: string;
  transaction_number: string;
  date: string;
  clean_description: string;
  amount: number;
  original_description: string;
  balance: number | null;
  user_metadata: Record<string, string | number | boolean> | null;
  needs_review: boolean;
  transaction_note: string | null;
  accounts: {
    id: string;
    name: string;
    mask: string | null;
    type: string;
  } | null;
  merchants: {
    name: string;
    logo_url: string | null;
    categories: {
      name: string;
      icon: string; // e.g., "Utensils"
    } | null;
  } | null;
}

// This is the "flattened" type our UI components will actually use for easier prop passing
export interface FormattedTransaction {
  id: string;
  transaction_number: string;
  date: string;
  description: string; // The merchant name
  amount: number;
  originalDescription: string;
  balance: number | null;
  userMetadata: Record<string, string | number | boolean> | null;
  needsReview: boolean;
  merchantName: string;
  merchantLogoUrl: string | null;
  categoryName: string;
  categoryIcon: string;
  // Additional properties for TransactionTable compatibility
  type: "income" | "expense";
  category: string;
  account: string;
  status: "completed" | "pending";
  // This will be used by the TransactionDetails component
  allCategories?: string[];
  note?: string;
}
