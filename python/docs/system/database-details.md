# Database Schema & Integration Guide

## Overview

The Vectr-4 application uses a PostgreSQL database hosted on Supabase with a comprehensive schema designed for financial transaction management, user rules, analytics, and AI-powered insights. The database implements Row Level Security (RLS) for data isolation and includes advanced features like vector embeddings for semantic search.

## Database Technology Stack

- **Database**: PostgreSQL 15+ with pgvector extension
- **Hosting**: Supabase (managed PostgreSQL)
- **Authentication**: Supabase Auth with JWT tokens
- **Security**: Row Level Security (RLS) policies
- **Extensions**: pgvector for embeddings, UUID generation

## Core Table Structure

### User Management

#### `profiles` Table
Central user profile information extending Supabase auth.users:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT,
  trial_ends_at TIMESTAMPTZ,
  preferences JSONB DEFAULT '{}',
  api_usage_count INTEGER DEFAULT 0,
  api_usage_reset_date DATE DEFAULT CURRENT_DATE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  theme TEXT DEFAULT 'light'
);
```

**Key Features**:
- Extends Supabase auth for additional user metadata
- Subscription and billing management
- User preferences and settings
- API usage tracking and rate limiting

### Financial Core Tables

#### `accounts` Table
User financial accounts (banks, credit cards, etc.):
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'checking', 'savings', 'credit', etc.
  balance NUMERIC(12,2),
  plaid_access_token TEXT, -- Plaid integration
  account_logo TEXT -- URL to account/bank logo
);
```

#### `transactions` Table
The core transactions table with comprehensive metadata:
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- Core transaction data
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  transaction_number TEXT,
  original_description TEXT NOT NULL,
  clean_description TEXT, -- Normalized description
  balance NUMERIC(12,2), -- Account balance after transaction
  
  -- Categorization & enrichment
  merchant_id UUID REFERENCES merchants(id),
  primary_category_id UUID REFERENCES categories(id),
  merchant_name_override TEXT, -- Manual merchant name override
  
  -- User management
  needs_review BOOLEAN DEFAULT FALSE,
  manual_edit BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  edited_by UUID REFERENCES profiles(id),
  hidden BOOLEAN DEFAULT FALSE,
  review_status review_status DEFAULT 'pending',
  
  -- Metadata
  user_metadata JSONB DEFAULT '{}',
  transaction_note TEXT,
  goal_id UUID REFERENCES goals(id),
  
  -- AI/ML features
  embedding VECTOR(1536), -- OpenAI embeddings for semantic search
  
  UNIQUE(user_id, transaction_number, date, amount) -- Prevent duplicates
);
```

**Key Features**:
- Comprehensive transaction metadata
- Support for manual overrides and editing
- AI embeddings for semantic search
- Audit trail with edited_by and edited_at
- Flexible categorization system

#### `categories` Table
Hierarchical category system:
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES profiles(id), -- NULL for system categories
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id), -- Self-referential for hierarchy
  icon TEXT, -- Lucide icon name
  icon_kebab TEXT, -- Kebab-case icon name
  
  UNIQUE(user_id, name) -- Unique per user, system categories have NULL user_id
);
```

**Features**:
- Supports both system-wide and user-specific categories
- Hierarchical structure with parent-child relationships
- Icon support for UI display
- Flexible naming with uniqueness constraints

#### `merchants` Table
Merchant information and metadata:
```sql
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  website TEXT,
  category_id UUID REFERENCES categories(id),
  mcc_code TEXT, -- Merchant Category Code
  confidence_score NUMERIC(3,2) DEFAULT 1.0
);
```

### Transaction Processing Tables

#### `transaction_categories` Table
Many-to-many relationship between transactions and categories:
```sql
CREATE TABLE transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  confidence NUMERIC(3,2) DEFAULT 1.0, -- AI/rule confidence score
  source TEXT DEFAULT 'manual', -- 'manual', 'rule', 'ai', 'regex'
  is_primary BOOLEAN DEFAULT FALSE,
  
  UNIQUE(transaction_id, category_id)
);
```

#### `transaction_edits` Table
Comprehensive audit trail for transaction modifications:
```sql
CREATE TABLE transaction_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  edited_by UUID REFERENCES profiles(id),
  old_values JSONB NOT NULL, -- Complete before state
  new_values JSONB NOT NULL, -- Complete after state
  edit_type TEXT NOT NULL, -- 'update', 'categorize', 'merchant_change'
  change_summary TEXT, -- Human-readable summary
  api_endpoint TEXT, -- Which endpoint made the change
  user_agent TEXT,
  ip_address INET
);
```

### User Rules System

#### `user_rules` Table
Custom user-defined categorization rules:
```sql
CREATE TABLE user_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER NOT NULL, -- Lower = higher priority
  conditions JSONB NOT NULL, -- Rule matching conditions
  actions JSONB NOT NULL, -- Actions to take when matched
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, priority) -- Ensure unique priority per user
);
```

**Rule Structure Examples**:
```json
// Conditions
{
  "field": "clean_description",
  "operator": "contains",
  "value": "coffee",
  "filters": {
    "amount_max": -1.00,
    "date_from": "2024-01-01"
  }
}

// Actions
{
  "set_category": "uuid-of-dining-category",
  "set_merchant": "uuid-of-merchant",
  "set_needs_review": false
}
```

### Lookup & Reference Tables

#### `global_regex_rules` Table
System-wide regex patterns for merchant/category matching:
```sql
CREATE TABLE global_regex_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL UNIQUE,
  merchant_id UUID REFERENCES merchants(id),
  category_id UUID REFERENCES categories(id),
  confidence NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `mcc_category_map` Table
Mapping of Merchant Category Codes to categories:
```sql
CREATE TABLE mcc_category_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcc_code TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES categories(id),
  description TEXT
);
```

### Chat Features

#### `chat_sessions` Table
Canonical conversation/session entity used by both AI and chat UIs:
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
```

#### `chat_messages` Table
Append-only message stream for conversations. Stores per-message payloads and metadata:
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('user','ai','system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
```

## Database Relationships

### Primary Relationships
```
profiles (users)
├── accounts (1:many)
├── transactions (1:many)
├── user_rules (1:many)
├── categories (1:many - user-specific)
├── chat_sessions (1:many)
└── transaction_edits (1:many via edited_by)

transactions
├── account (many:1)
├── merchant (many:1)
├── primary_category (many:1)
├── goal (many:1)
├── transaction_categories (1:many)
├── transaction_edits (1:many)
└── transaction_tags (1:many)

categories
├── parent_category (self-referential)
├── transactions (1:many via primary_category_id)
├── transaction_categories (1:many)
├── merchants (1:many)
└── global_regex_rules (1:many)
```

### Foreign Key Constraints
- **CASCADE DELETE**: User deletion removes all related data
- **SET NULL**: Category deletion preserves transactions but removes reference
- **RESTRICT**: Prevent deletion if dependent records exist

## Row Level Security (RLS)

### Security Policies
All user tables implement RLS policies:

```sql
-- Example: transactions table RLS
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (user_id = auth.uid());
```

### Public Tables
Some tables are publicly readable but only admin-writable:
- `categories` (system categories where user_id IS NULL)
- `merchants` (shared merchant database)
- `mcc_category_map` (standard MCC mappings)

## Indexes & Performance

### Critical Indexes
```sql
-- Transaction performance indexes
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, primary_category_id);
CREATE INDEX idx_transactions_user_merchant ON transactions(user_id, merchant_id);
CREATE INDEX idx_transactions_needs_review ON transactions(user_id, needs_review) WHERE needs_review = TRUE;
CREATE INDEX idx_transactions_manual_edit ON transactions(user_id, manual_edit) WHERE manual_edit = TRUE;

-- Category hierarchy index
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- User rules priority index
CREATE INDEX idx_user_rules_priority ON user_rules(user_id, priority) WHERE enabled = TRUE;

-- Full-text search indexes
CREATE INDEX idx_transactions_description_gin ON transactions USING gin(to_tsvector('english', clean_description));
```

### Vector Search Index
```sql
-- AI embedding similarity search
CREATE INDEX idx_transactions_embedding ON transactions USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## Data Types & Enums

### Custom Types
```sql
-- Review status enum
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected', 'needs_attention');

-- Transaction type enum
CREATE TYPE transaction_type AS ENUM ('debit', 'credit', 'transfer', 'fee');
```

### JSONB Usage
- **user_metadata**: Flexible transaction metadata
- **preferences**: User settings and preferences
- **conditions**: Rule matching logic
- **actions**: Rule actions to execute

## Migration Strategy

### Schema Versioning
- Sequential numbered migrations in `sql/` directory
- Each migration includes both up and down operations
- Database version tracking in metadata table

### Example Migration
```sql
-- 003_add_transaction_ids.sql
ALTER TABLE transactions 
ADD COLUMN transaction_number TEXT,
ADD CONSTRAINT unique_transaction_per_account 
  UNIQUE(user_id, account_id, transaction_number);

CREATE INDEX idx_transactions_number ON transactions(transaction_number);
```

## Data Integrity & Constraints

### Business Rules
- **Unique Transactions**: Prevent duplicate transactions per user
- **Valid Amounts**: Ensure realistic transaction amounts
- **Date Constraints**: Prevent future-dated transactions
- **User Isolation**: RLS ensures complete data separation

### Audit Requirements
- All modifications tracked in `transaction_edits`
- User actions logged with timestamps
- API endpoint and user context captured
- Complete before/after state preservation

## Integration Patterns

### Frontend Integration
- Supabase client with automatic RLS enforcement
- Real-time subscriptions for live updates
- Optimistic updates with rollback capability
- Type-safe database operations

### Backend Integration
- Service account for admin operations
- Connection pooling for performance
- Prepared statements for security
- Transaction-wrapped operations for consistency

## Performance Monitoring

### Key Metrics
- Query execution times by endpoint
- Index usage and effectiveness
- Connection pool utilization
- RLS policy performance impact

### Optimization Strategies
- Materialized views for complex analytics
- Partial indexes for filtered queries
- Query result caching at application layer
- Background job processing for heavy operations

## Backup & Recovery

### Backup Strategy
- Automated daily backups via Supabase
- Point-in-time recovery capability
- Cross-region backup replication
- Encrypted backup storage

### Disaster Recovery
- RTO (Recovery Time Objective): < 1 hour
- RPO (Recovery Point Objective): < 15 minutes
- Automated failover procedures
- Regular disaster recovery testing

---

*Updated: September 1, 2025*