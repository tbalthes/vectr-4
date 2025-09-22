# System Architecture

## Overview

Vectr-4 is a full-stack financial transaction management application with a Next.js frontend and Python FastAPI backend. The system uses Supabase for authentication, database, and real-time features, with AI integration for intelligent financial insights.

## Technology Stack

### Frontend

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React hooks + Context API
- **Authentication**: Supabase Auth
- **Data Fetching**: Native fetch with Next.js patterns

### Backend

- **Framework**: Python FastAPI
- **Language**: Python 3.11+
- **Database**: PostgreSQL via Supabase
- **Caching**: In-memory singleton cache
- **API Documentation**: OpenAPI/Swagger auto-generation

### Infrastructure

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with RLS
- **Hosting**: Vercel (frontend), self-hosted (backend)
- **AI Integration**: Google Gemini API

## Architecture Patterns

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
├─────────────────────────────────────────────────────────┤
│  Pages & Layouts (App Router)                           │
│  ├── /private/* (Protected routes)                      │
│  ├── /auth/* (Authentication routes)                    │
│  └── /api/* (API routes - proxy to backend)             │
├─────────────────────────────────────────────────────────┤
│  Components                                             │
│  ├── /ui/* (shadcn/ui components)                       │
│  ├── /private/* (Feature components)                    │
│  └── /public/* (Public-facing components)               │
├─────────────────────────────────────────────────────────┤
│  Business Logic                                         │
│  ├── /lib/* (Utilities, data processing)                │
│  ├── /hooks/* (Custom React hooks)                      │
│  ├── /contexts/* (React Context providers)              │
│  └── /types/* (TypeScript definitions)                  │
└─────────────────────────────────────────────────────────┘
```

### Backend Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   FastAPI Backend                       │
├─────────────────────────────────────────────────────────┤
│  API Layer                                              │
│  ├── /app/main.py (FastAPI application)                 │
│  ├── /app/routers/* (Feature-based routing)             │
│  └── /app/dependencies.py (Shared dependencies)         │
├─────────────────────────────────────────────────────────┤
│  Business Logic                                         │
│  ├── /core/parser.py (Data parsing & cleaning)          │
│  ├── /core/matching.py (Transaction categorization)     │
│  └── /core/transaction_processor.py (Processing logic)  │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                             │
│  ├── /supabase_client/* (Database integration)          │
│  ├── /data_cache.py (In-memory caching)                 │
│  └── /data/* (Static data files)                        │
└─────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────┐
│   Client    │    │   Next.js API   │    │   FastAPI    │
│             │    │     Routes      │    │   Backend    │
│             │    │                 │    │              │
│  React UI   │◄──►│  /api/trans*    │◄──►│  /routers/*  │
│             │    │  /api/rules/*   │    │              │
│             │    │  /api/ai/*      │    │              │
│             │    │                 │    │              │
└─────────────┘    └─────────────────┘    └──────────────┘
                              │                    │
                              ▼                    ▼
                   ┌─────────────────┐    ┌──────────────┐
                   │   Supabase      │    │  Data Cache  │
                   │                 │    │              │
                   │  PostgreSQL     │    │  In-Memory   │
                   │  Auth & RLS     │    │  Lookups     │
                   │  Real-time      │    │              │
                   └─────────────────┘    └──────────────┘
```

#### Proxying rationale (Next.js API routes → FastAPI)

The project uses Next.js API routes (the `/api/*` layer) as a lightweight proxy in front of the FastAPI backend. The primary reason is to securely bridge the browser's auth/session context and the server environment so requests can be authorized, shaped, and executed without exposing service credentials or creating CORS/session problems.

Why this matters in this repo:

- Auth/session translation: Next.js middleware and server components can validate Supabase sessions (cookies/JWT) and forward an authenticated context or user_id to FastAPI. This avoids requiring the browser to hold service credentials or to call the backend with raw service keys.
- Secrets protection: Server-only secrets (service role keys, admin credentials) stay on server routes or API handlers in Next.js and are never exposed to the browser.
- Cookies, CORS and RLS compatibility: Proxying under the same origin avoids cross-origin cookie issues and makes Supabase RLS and cookie-based sessions reliable for SSR and client requests.
- Request shaping & validation: The proxy can sanitize inputs, translate payloads, enforce quotas/rate-limits, add telemetry, and transform requests so the backend receives a stable contract.
- SSR & server components: Server components and SSR pages call internal `/api/*` routes rather than a cross-origin backend host, simplifying error handling, auth checks, and retries.
- Observability & ops: Centralizing logging, metrics, retries, and feature flags in the proxy layer makes operational debugging easier and gives a single place to implement circuit breakers or backoffs.

Practical recommendation:

- Keep auth-sensitive and admin operations behind the Next.js proxy or call FastAPI from server-side code only; forward session cookies or validated user context and reserve the Supabase service role key for server-only operations.

## Authentication Flow

### Supabase Authentication

```
1. User Login Request
   ├── Email/Password OR OAuth (Google/GitHub)
   ├── Supabase Auth validates credentials
   ├── JWT token issued with user metadata
   └── Session stored in browser (httpOnly cookies)

2. Protected Route Access
   ├── Middleware checks authentication status
   ├── Valid session → Allow access
   └── Invalid/missing → Redirect to login

3. API Requests
   ├── Frontend includes auth headers/cookies
   ├── Backend validates session with Supabase
   ├── Row Level Security (RLS) filters data
   └── Response sent with user-specific data
```

### Session Management

- **Frontend**: Supabase client handles session refresh
- **Backend**: Session validation on each request
- **Security**: RLS policies ensure data isolation
- **Logout**: Clear session and redirect to public area

## Data Processing Pipeline

### Transaction Processing Flow

```
CSV Upload → Parse → Validate → Enrich → Store/Return

1. CSV Parsing (Frontend)
   ├── File validation and parsing
   ├── Column mapping interface
   └── Data normalization

2. Backend Processing
   ├── Data validation and cleaning
   ├── Merchant/category matching
   ├── Rule-based categorization
   └── Confidence scoring

3. Data Enrichment
   ├── Regex rule matching (highest confidence)
   ├── MCC code mapping
   ├── Fuzzy string matching
   └── User rule application

4. Storage/Response
   ├── Database persistence (optional)
   ├── Formatted response
   └── Frontend state update
```

### Caching Strategy

- **In-Memory Cache**: Global regex rules, MCC mappings, categories
- **Cache Refresh**: Manual trigger via special transaction
- **Performance**: Sub-millisecond lookups for transaction processing
- **Thread Safety**: Synchronized access for concurrent requests

## AI Integration Architecture

### VectrAI System Flow

```
User Query → Planner → Validation → Data Fetch → Analysis → Response

1. Query Planning
   ├── User submits natural language query
   ├── AI planner determines required analytics
   ├── Request validation and quota checking
   └── Parameter normalization

2. Data Collection
   ├── Execute validated analytics requests
   ├── Aggregate financial data
   ├── Apply user permissions and RLS
   └── Summarize results for AI

3. AI Analysis
   ├── Feed summarized data to AI model
   ├── Generate insights and explanations
   ├── Stream response to client
   └── Maintain conversation context
```

### AI Safety & Validation

- **Request Validation**: Whitelist allowed analytics endpoints
- **Quota Management**: Per-user request limiting
- **Data Sanitization**: Summary format prevents data leakage
- **Stream Control**: Chunked responses with error handling

## Database Design

### Core Tables

- **transactions**: User financial transactions
- **categories**: Hierarchical category system
- **merchants**: Merchant information and metadata
- **user_rules**: Custom categorization rules
- **global_regex_rules**: System-wide matching patterns

### Relationships

```
users (Supabase Auth)
├── transactions (1:many)
├── user_rules (1:many)
└── merchant_preferences (1:many)

transactions
├── categories (many:1)
├── merchants (many:1)
└── transaction_categories (many:many)

categories
├── parent_category (self-referential)
└── transaction_categories (1:many)
```

### Security (Row Level Security)

- All tables have RLS policies based on user_id
- Public tables (categories, merchants) have read-only access
- Audit tables track sensitive operations
- Performance indexes on filtered columns

## Performance Considerations

### Frontend Performance

- **Code Splitting**: Route-based and component-based splitting
- **Lazy Loading**: Components and data loaded on demand
- **Caching**: Browser caching for static assets
- **Optimization**: Image optimization, tree shaking

### Backend Performance

- **In-Memory Caching**: Critical lookup tables cached
- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connection management
- **Async Processing**: Non-blocking I/O for concurrent requests

### Scaling Considerations

- **Horizontal Scaling**: Stateless backend services
- **Database Scaling**: Read replicas for analytics queries
- **CDN Integration**: Static asset delivery optimization
- **Monitoring**: Performance metrics and alerting

## Security Architecture

### Data Protection

- **Encryption**: TLS in transit, encryption at rest
- **Authentication**: Multi-factor authentication support
- **Authorization**: Granular permissions with RLS
- **Input Validation**: Comprehensive request validation

### API Security

- **Rate Limiting**: Prevent abuse and DoS attacks
- **CORS**: Properly configured cross-origin policies
- **Request Validation**: Schema validation for all inputs
- **Error Handling**: Secure error responses without data leakage

## Deployment Architecture

### Frontend Deployment (Vercel)

- **Build Process**: Next.js static generation
- **Edge Functions**: API routes deployed to edge
- **Environment**: Separate staging and production
- **Monitoring**: Performance and error tracking

### Backend Deployment

- **Containerization**: Docker containers for consistency
- **Process Management**: Gunicorn with multiple workers
- **Health Checks**: Endpoint monitoring and alerting
- **Logging**: Structured logging for debugging

## Development Workflow

### Local Development

```bash
# Frontend
npm run dev          # Start Next.js dev server

# Backend
cd python
source .venv/bin/activate
python -m uvicorn app.main:app --reload
```

### Testing Strategy

- **Unit Tests**: Component and function testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Critical user workflow testing
- **Performance Tests**: Load testing for key endpoints

## Monitoring & Observability

### Application Monitoring

- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time and throughput
- **User Analytics**: Usage patterns and feature adoption
- **Health Checks**: System availability monitoring

### Business Metrics

- **Transaction Volume**: Processing throughput
- **Categorization Accuracy**: AI and rule performance
- **User Engagement**: Feature usage analytics
- **System Performance**: Cache hit rates, query performance

## Related Documentation

- [API Integration](./api-integration.md) - Frontend-backend communication
- [Database Integration](./database-integration.md) - Supabase integration details
- [Authentication System](../core-features/authentication.md) - Auth implementation
- [Transaction Processing](../../python/docs/core-apis/transaction-processing.md) - Backend processing

---

_Updated: September 1, 2025_
