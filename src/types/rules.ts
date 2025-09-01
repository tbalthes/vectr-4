/**
 * Types for User Rules Management System
 * Matches the FastAPI backend models for consistency
 */

export interface UserRule {
  id: string;
  user_id: string;
  match_field: string;
  match_operator: string;
  match_value: string;
  category_id: string;
  priority: number;
  enabled: boolean;
  amount_min?: number | null;
  amount_max?: number | null;
  date_from?: string | null; // YYYY-MM-DD format
  date_to?: string | null; // YYYY-MM-DD format
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserRuleCreate {
  user_id: string;
  match_field: string;
  match_operator: string;
  match_value: string;
  category_id: string;
  priority?: number;
  enabled?: boolean;
  amount_min?: number | null;
  amount_max?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  description?: string | null;
}

export interface UserRuleUpdate {
  match_field?: string;
  match_operator?: string;
  match_value?: string;
  category_id?: string;
  priority?: number;
  enabled?: boolean;
  amount_min?: number | null;
  amount_max?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  description?: string | null;
}

export interface TransactionMatch {
  transaction_id: string;
  date: string;
  description: string;
  clean_description?: string | null;
  merchant_name?: string | null;
  amount: number;
  current_category_name?: string | null;
  matched_category_name?: string | null;
  confidence: number;
  match_method: string;
}

export interface RulePreviewResponse {
  rule_summary: string;
  total_transactions_checked: number;
  matching_transactions: TransactionMatch[];
  would_override_count: number;
  sample_limit_reached: boolean;
}

export interface UserRulesListResponse {
  rules: UserRule[];
  total: number;
  page: number;
  page_size: number;
}

export interface RulePreviewRequest {
  match_field: string;
  match_operator: string;
  match_value: string;
  category_id: string;
  priority?: number;
  amount_min?: number | null;
  amount_max?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  description?: string | null;
}

// Form validation types
export interface RuleFormErrors {
  match_field?: string;
  match_operator?: string;
  match_value?: string;
  category_id?: string;
  priority?: string;
  amount_min?: string;
  amount_max?: string;
  date_from?: string;
  date_to?: string;
  description?: string;
}

// Configuration constants
export const MATCH_FIELDS = [
  { value: "description", label: "Description" },
  { value: "clean_description", label: "Clean Description" },
  { value: "merchant_name", label: "Merchant Name" },
  { value: "original_description", label: "Original Description" },
  { value: "amount", label: "Amount" },
] as const;

export const MATCH_OPERATORS = {
  text: [
    { value: "equals", label: "Equals" },
    { value: "contains", label: "Contains" },
    { value: "startswith", label: "Starts with" },
    { value: "endswith", label: "Ends with" },
    { value: "regex", label: "Regex pattern" },
  ],
  numeric: [
    { value: "equals", label: "Equals" },
    { value: "greater_than", label: "Greater than" },
    { value: "less_than", label: "Less than" },
  ],
} as const;

export type MatchField = (typeof MATCH_FIELDS)[number]["value"];
export type TextMatchOperator = (typeof MATCH_OPERATORS.text)[number]["value"];
export type NumericMatchOperator =
  (typeof MATCH_OPERATORS.numeric)[number]["value"];
export type MatchOperator = TextMatchOperator | NumericMatchOperator;
