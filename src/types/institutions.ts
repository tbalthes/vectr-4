// This interface matches the `accounts` table schema
export interface Account {
  account_id: string;
  account_link_id: string | null;
  user_id: string;
  aggregator_account_id: string | null;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  currency: string | null;
  current_balance: number | null;
  available_balance: number | null;
  verification_status: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Institution type used across the app
export interface Institution {
  id?: string;
  name: string;
  provider?: string | null;
  logo_url?: string | null;
  url?: string | null;
  primary_color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// Request type for creating an institution (manual provider)
export interface CreateInstitutionRequest {
  name: string;
  provider?: string; // e.g., 'manual'
  logo_url?: string;
  url?: string;
  primary_color?: string;
}

// This interface represents an account with its institution data joined
export interface AccountWithInstitution extends Account {
  institutions: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    url: string | null;
  } | null;
}

// Request type for creating a manual account
export interface CreateManualAccountRequest {
  name: string;
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype?: string;
  mask?: string;
  currency?: string;
  current_balance?: number;
  available_balance?: number;
  // Optional fields used by frontend when creating manual accounts
  institution_id?: string;
  initial_balance?: number;
}

// Response type for creating a manual account
export interface CreateManualAccountResponse {
  success: boolean;
  account: Account;
}

// Constants for form options
export const ACCOUNT_TYPES = [
  {
    value: 'depository',
    label: 'Checking/Savings',
    description: 'Bank accounts, money market, CDs',
  },
  {
    value: 'credit',
    label: 'Credit Cards',
    description: 'Credit cards, lines of credit',
  },
  {
    value: 'loan',
    label: 'Loans',
    description: 'Mortgages, auto loans, student loans',
  },
  {
    value: 'investment',
    label: 'Investments',
    description: 'Brokerage, 401k, IRA, retirement',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Gift cards, prepaid cards, etc.',
  },
] as const;

export const DEPOSITORY_SUBTYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'money market', label: 'Money Market' },
  { value: 'cd', label: 'Certificate of Deposit' },
  { value: 'cash management', label: 'Cash Management' },
] as const;

export const CREDIT_SUBTYPES = [
  { value: 'credit card', label: 'Credit Card' },
  { value: 'line of credit', label: 'Line of Credit' },
] as const;

export const LOAN_SUBTYPES = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'auto', label: 'Auto Loan' },
  { value: 'student', label: 'Student Loan' },
  { value: 'personal', label: 'Personal Loan' },
] as const;

export const INVESTMENT_SUBTYPES = [
  { value: 'brokerage', label: 'Brokerage' },
  { value: '401k', label: '401(k)' },
  { value: 'ira', label: 'IRA' },
  { value: 'roth', label: 'Roth IRA' },
  { value: '403b', label: '403(b)' },
] as const;
