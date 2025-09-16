export interface Transaction {
  transaction_number: string;
  date: string;
  original_description: string;
  clean_description: string;
  category: string;
  amount: number;
  needs_review: boolean;
  note?: string;
  user_metadata?: {
    field1?: { label: string; value: string };
    field2?: { label: string; value: string };
  };
  // Keep existing fields for backward compatibility and UI
  merchantLogo?: string;
  categories: string[];
  mainCategory:
    | 'food-dining'
    | 'transportation'
    | 'shopping'
    | 'entertainment'
    | 'utilities'
    | 'healthcare'
    | 'income'
    | 'other';
  type: 'income' | 'expense';
}

export const mockTransactions: Transaction[] = [
  {
    transaction_number: 'TXN-2024-001',
    date: '2024-01-15',
    original_description: 'STARBUCKS STORE #12345 SEATTLE WA',
    clean_description: 'Starbucks Coffee',
    category: 'Food & Dining',
    amount: -8.45,
    needs_review: false,
    note: 'Morning coffee',
    user_metadata: {
      field1: { label: 'Location', value: 'Downtown' },
      field2: { label: 'Purpose', value: 'Business meeting' },
    },
    categories: ['Coffee', 'Food & Dining'],
    mainCategory: 'food-dining',
    type: 'expense',
  },
  {
    transaction_number: 'TXN-2024-002',
    date: '2024-01-15',
    original_description: 'UBER TRIP 123ABC SAN FRANCISCO CA',
    clean_description: 'Uber',
    category: 'Transportation',
    amount: -23.5,
    needs_review: false,
    note: 'Airport trip',
    categories: ['Transportation', 'Rideshare'],
    mainCategory: 'transportation',
    type: 'expense',
  },
  {
    transaction_number: 'TXN-2024-003',
    date: '2024-01-14',
    original_description: 'AMAZON.COM AMZN.COM/BILL WA',
    clean_description: 'Amazon',
    category: 'Shopping',
    amount: -156.78,
    needs_review: true,
    note: 'Electronics purchase',
    user_metadata: {
      field1: { label: 'Order ID', value: '#123-456789' },
    },
    categories: ['Shopping', 'Electronics'],
    mainCategory: 'shopping',
    type: 'expense',
  },
  {
    transaction_number: 'TXN-2024-004',
    date: '2024-01-14',
    original_description: 'NETFLIX.COM SUBSCRIPTION LOS GATOS CA',
    clean_description: 'Netflix',
    category: 'Entertainment',
    amount: -15.99,
    needs_review: false,
    categories: ['Entertainment', 'Streaming'],
    mainCategory: 'entertainment',
    type: 'expense',
  },
  {
    transaction_number: 'TXN-2024-005',
    date: '2024-01-13',
    original_description: 'PG&E ELECTRIC BILL AUTOPAY',
    clean_description: 'Electric Company',
    category: 'Utilities',
    amount: -89.34,
    needs_review: false,
    note: 'Monthly electricity bill',
    categories: ['Utilities', 'Electricity'],
    mainCategory: 'utilities',
    type: 'expense',
  },
  {
    transaction_number: 'TXN-2024-006',
    date: '2024-01-13',
    original_description: 'CVS PHARMACY #4567 MAIN ST',
    clean_description: 'Pharmacy Plus',
    category: 'Healthcare',
    amount: -45.67,
    needs_review: true,
    note: 'Prescription pickup',
    categories: ['Healthcare', 'Medication'],
    mainCategory: 'healthcare',
    type: 'expense',
  },
  {
    transaction_number: 'TXN-2024-007',
    date: '2024-01-12',
    original_description: 'COMPANY PAYROLL DIRECT DEP',
    clean_description: 'Salary Direct Deposit',
    category: 'Income',
    amount: 3500.0,
    needs_review: false,
    note: 'Bi-weekly salary',
    categories: ['Income', 'Salary'],
    mainCategory: 'income',
    type: 'income',
  },
  {
    transaction_number: 'TXN-2024-008',
    date: '2024-01-12',
    original_description: 'TARGET T-1234 GROCERY DEPT',
    clean_description: 'Target',
    category: 'Shopping',
    amount: -67.23,
    needs_review: false,
    user_metadata: {
      field1: { label: 'Category', value: 'Groceries' },
      field2: { label: 'Store Type', value: 'Superstore' },
    },
    categories: ['Shopping', 'Groceries', 'Household'],
    mainCategory: 'shopping',
    type: 'expense',
  },
  {
    transaction_number: 'TXN-2024-009',
    date: '2024-01-11',
    original_description: 'OLIVE GARDEN #789 ITALIAN KITCHEN',
    clean_description: 'Olive Garden',
    category: 'Food & Dining',
    amount: -42.85,
    needs_review: false,
    note: 'Family dinner',
    categories: ['Food & Dining', 'Restaurant'],
    mainCategory: 'food-dining',
    type: 'expense',
  },
  {
    transaction_number: 'TXN-2024-010',
    date: '2024-01-11',
    original_description: 'SHELL OIL #567890 FUEL PURCHASE',
    clean_description: 'Gas Station',
    category: 'Transportation',
    amount: -38.9,
    needs_review: true,
    note: 'Weekly fuel',
    categories: ['Transportation', 'Fuel'],
    mainCategory: 'transportation',
    type: 'expense',
  },
];
