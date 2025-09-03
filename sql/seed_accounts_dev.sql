-- Seed script for development/testing
-- Run this in your Supabase SQL editor or psql

-- Insert some test institutions
INSERT INTO public.institutions (provider, name, logo_url) VALUES 
  ('plaid', 'Chase Bank', 'https://logo.clearbit.com/chase.com'),
  ('plaid', 'Bank of America', 'https://logo.clearbit.com/bankofamerica.com'),
  ('manual', 'Local Credit Union', null)
ON CONFLICT DO NOTHING;

-- Note: You'll need to replace 'YOUR_USER_ID_HERE' with your actual user ID
-- Get your user ID by running: SELECT id FROM auth.users LIMIT 1;

-- Insert test accounts (replace the user_id with your actual user ID)
INSERT INTO public.accounts (
  user_id, 
  name, 
  mask, 
  type, 
  currency, 
  provider, 
  institution_id
) VALUES 
  (
    'YOUR_USER_ID_HERE', 
    'Chase Checking', 
    '1234', 
    'checking', 
    'USD', 
    'plaid',
    (SELECT id FROM public.institutions WHERE name = 'Chase Bank' LIMIT 1)
  ),
  (
    'YOUR_USER_ID_HERE', 
    'Chase Savings', 
    '5678', 
    'savings', 
    'USD', 
    'plaid',
    (SELECT id FROM public.institutions WHERE name = 'Chase Bank' LIMIT 1)
  ),
  (
    'YOUR_USER_ID_HERE', 
    'BofA Credit Card', 
    '9012', 
    'credit', 
    'USD', 
    'plaid',
    (SELECT id FROM public.institutions WHERE name = 'Bank of America' LIMIT 1)
  )
ON CONFLICT DO NOTHING;

-- Insert test balances for the accounts
INSERT INTO public.balances (
  account_id,
  balance_amount,
  available,
  as_of
) VALUES 
  (
    (SELECT id FROM public.accounts WHERE name = 'Chase Checking' LIMIT 1),
    2540.75,
    2540.75,
    now()
  ),
  (
    (SELECT id FROM public.accounts WHERE name = 'Chase Savings' LIMIT 1),
    15420.00,
    15420.00,
    now()
  ),
  (
    (SELECT id FROM public.accounts WHERE name = 'BofA Credit Card' LIMIT 1),
    -850.25,
    1149.75,
    now()
  )
ON CONFLICT DO NOTHING;
