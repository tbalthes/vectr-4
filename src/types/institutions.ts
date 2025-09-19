// Institution types for manual and aggregator institutions
export interface Institution {
  id: string;
  provider: 'plaid' | 'mx' | 'manual';
  name: string;
  logo_url?: string | null;
  url?: string | null;
  primary_color?: string | null;
  country_codes?: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

// Request types for creating institutions
export interface CreateInstitutionRequest {
  name: string;
  provider?: 'manual' | 'plaid' | 'mx';
  logo_url?: string;
  url?: string;
  primary_color?: string;
  country_codes?: string[];
  metadata?: Record<string, unknown>;
}

// Request types for creating manual accounts
export interface CreateManualAccountRequest {
  institution_id?: string;
  name: string;
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype?: string;
  mask?: string;
  currency?: string;
  account_logo?: string;
  initial_balance?: number;
}

// Response types
export interface CreateInstitutionResponse {
  success: boolean;
  institution: Institution;
}

export interface CreateManualAccountResponse {
  success: boolean;
  account: {
    id: string;
    user_id: string;
    name: string;
    type: string;
    subtype?: string;
    mask?: string;
    currency: string;
    provider: string;
    aggregator_account_id?: string;
    institution_id?: string;
    institution_name?: string;
    institution_logo_url?: string;
    institution_url?: string;
    institution_primary_color?: string;
    account_logo?: string;
    last_synced_at?: string;
    balance_amount: number;
    available: number;
    as_of?: string;
  };
}

export interface GetInstitutionsResponse {
  institutions: Institution[];
}

// Account type options for forms
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
