# Vectr-4 Financial Management Platform

Vectr-4 is a comprehensive financial transaction management platform built with Next.js 15, TypeScript, FastAPI (Python), and Supabase. It provides AI-powered financial insights, transaction categorization, budgeting, and bank account integration via Plaid.

**ALWAYS follow these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Build the Repository

**CRITICAL**: Set appropriate timeouts for ALL commands. Build processes can be lengthy.

1. **Install Dependencies**:

   ```bash
   npm ci
   ```

   - Takes ~33 seconds
   - NEVER CANCEL: Set timeout to 60+ seconds minimum

2. **Lint the Code**:

   ```bash
   npm run lint
   ```

   - Takes ~17 seconds
   - NEVER CANCEL: Set timeout to 30+ seconds
   - Always run `npm run lint:fix` for automatic fixes

3. **Format the Code**:

   ```bash
   npm run format
   ```

   - Takes ~6 seconds using Prettier
   - Formats all files according to project standards

4. **Build the Application**:

   ```bash
   npm run build
   ```

   - Takes ~75 seconds (1 minute 15 seconds)
   - NEVER CANCEL: Set timeout to 120+ seconds minimum
   - **KNOWN ISSUE**: Build fails in offline environments due to Google Fonts dependency
   - If build fails with "ENOTFOUND fonts.googleapis.com", this is expected in restricted networks

### Development Environment Setup

1. **Start Development Server**:

   ```bash
   npm run dev:next-only
   ```

   - Starts Next.js with Turbopack on http://localhost:3000
   - Takes ~15 seconds to be ready
   - Use this for frontend-only development

2. **Full Development Environment** (Frontend + Python Backend):

   ```bash
   npm run dev
   ```

   - Runs Next.js frontend + Python FastAPI backend + ngrok tunnel
   - Requires Python virtual environment setup (see Python Backend section)

3. **Python Backend Setup**:

   ```bash
   cd python
   python3 -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   # OR .venv\Scripts\activate.bat  # Windows
   pip install -r requirements.txt
   ```

   - Python dependency installation takes ~60 seconds
   - NEVER CANCEL: Set timeout to 120+ seconds

4. **Start Python API Server**:

   ```bash
   cd python
   source .venv/bin/activate
   python -m uvicorn app.main:app --reload --port 8000
   ```

   - Requires environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
   - Runs on http://localhost:8000

### Environment Configuration

**REQUIRED**: Create `.env.local` file with Supabase configuration:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing and Validation

### Unit Tests

- **No test runner currently configured**
- The codebase includes a test file: `tests/validate-planner.test.ts`
- To add testing: Install Jest + ts-jest and configure `jest.config.cjs`

### Manual Validation Requirements

**ALWAYS validate changes with these scenarios**:

1. **Frontend Functionality**:
   - Start development server: `npm run dev:next-only`
   - Navigate to http://localhost:3000
   - Test authentication flow (signup/login)
   - Verify dashboard loads without errors
   - Test transaction table rendering

2. **AI Chat Feature** (VectrAI):
   - Navigate to `/private/vectr-ai`
   - Test chat interface functionality
   - Verify streaming responses work
   - **Key test endpoint**: POST `/api/ai/chat`

3. **API Endpoints**:
   - Test database connection: GET `/api/db-test`
   - Test transaction retrieval: GET `/api/transactions`
   - Test analytics: GET `/api/analytics/aggregator`

4. **End-to-End Workflow Validation** (REQUIRED after significant changes):
   - Complete user signup process
   - Connect a sample account (if Plaid configured)
   - Upload CSV transactions via `/private/upload`
   - Create and test user rules via `/private/rules`
   - Verify dashboard analytics display correctly
   - Test AI chat functionality with sample queries

### Pre-Commit Requirements

**ALWAYS run before committing**:

```bash
npm run lint        # Must pass - CI will fail otherwise
npm run format      # Auto-format all files
npm run build       # Must succeed (unless network restricted)
```

## Key Architecture Components

### Frontend (Next.js)

- **Framework**: Next.js 15.4.6 with App Router
- **Language**: TypeScript 5.9.2
- **Styling**: Tailwind CSS with shadcn/ui components
- **Key Directories**:
  - `src/app/` - Next.js pages and API routes
  - `src/components/` - React components (organized by domain)
  - `src/lib/` - Utilities and integrations
  - `src/types/` - TypeScript type definitions

### Backend (Python FastAPI)

- **Framework**: FastAPI with Uvicorn
- **Database**: Supabase (PostgreSQL)
- **Key Files**:
  - `python/app/main.py` - FastAPI application entry point
  - `python/app/routers/` - API endpoint definitions
  - `python/requirements.txt` - Python dependencies

### Database

- **Primary**: Supabase (hosted PostgreSQL)
- **Schema**: Located in `sql/` directory
- **Migrations**: Numbered SQL files (001*\*.sql, 002*\*.sql, etc.)

## Core Features and Contact Points

### VectrAI (AI-Powered Analytics)

- **Main orchestration**: `src/app/api/ai/chat/route.ts`
- **Validation logic**: `src/lib/analytics/validate-planner.ts`
- **Date range handling**: `src/lib/analytics/calculateDateRange.ts`
- **Frontend interface**: `src/app/private/vectr-ai/page.tsx`

### Transaction Management

- **API endpoint**: `src/app/api/transactions/route.ts`
- **Frontend table**: `src/components/private/transactions/TransactionTable.tsx`
- **Types**: `src/types/transactions.ts`

### User Rules Engine

- **API endpoints**: `src/app/api/user-rules/`
- **Frontend interface**: `src/app/private/rules/`
- **Backend processor**: `python/app/routers/user_rules.py`

### Bank Integration (Plaid)

- **API endpoints**: `src/app/api/aggregator/plaid/`
- **Link component**: `src/components/private/accounts/PlaidLinkButton.tsx`
- **Account management**: `src/app/private/accounts/`

## Common Development Tasks

### Adding New API Endpoints

1. Create route file in `src/app/api/[endpoint]/route.ts`
2. Follow existing patterns for authentication and validation
3. Update TypeScript types in `src/types/`
4. Test with development server

### Modifying UI Components

1. Components use shadcn/ui design system
2. Follow existing patterns in `src/components/`
3. Use Tailwind CSS for styling
4. Test responsive design

### Database Changes

1. Create new SQL migration file in `sql/` directory
2. Use sequential numbering (e.g., `025_your_change.sql`)
3. Test against Supabase instance
4. Update TypeScript types to match schema

## Known Issues and Workarounds

### Build Issues

- **Google Fonts Network Error**: Build fails in offline/restricted environments
- **Supabase Warnings**: Edge Runtime warnings are expected and non-breaking

### Development Issues

- **Python Backend**: Requires environment variables to start
- **Plaid Integration**: Needs valid API keys for bank connection testing
- **AI Features**: Requires external AI service configuration

## CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

- Runs on: Pull requests to main branch
- Steps: Checkout → Setup Node.js → Install dependencies → Lint → Build
- **Requirements**: All steps must pass for PR approval

### Performance Expectations

- **npm ci**: ~33 seconds
- **npm run lint**: ~17 seconds
- **npm run build**: ~75 seconds
- **Total CI time**: ~2-3 minutes

## File Organization Reference

### Most Frequently Modified Files

```
src/app/api/ai/chat/route.ts           # AI chat orchestration
src/lib/analytics/validate-planner.ts  # AI validation logic
src/app/private/dashboard/page.tsx     # Main dashboard
src/components/private/transactions/   # Transaction components
src/app/api/transactions/route.ts      # Transaction API
python/app/routers/                    # Python API endpoints
```

### Key Configuration Files

```
package.json                 # Node.js dependencies and scripts
next.config.ts              # Next.js configuration
eslint.config.js            # Linting rules
tailwind.config.js          # Styling configuration
python/requirements.txt     # Python dependencies
tsconfig.json               # TypeScript configuration
```

## Support and Troubleshooting

### Common Error Solutions

1. **"SUPABASE_URL must be set"**: Create `.env.local` with required variables
2. **"Failed to fetch Inter from Google Fonts"**: Network restriction, expected in offline environments
3. **"Module not found"**: Run `npm ci` to install dependencies
4. **Python import errors**: Activate virtual environment and install requirements

### When Making Changes

- **Always test locally first** with `npm run dev:next-only`
- **Verify linting passes** with `npm run lint`
- **Test key user flows** after significant changes
- **Check both frontend and backend** if modifying API endpoints

---

This document should be updated when new features are added or development patterns change. Keep it synchronized with the actual codebase structure and requirements.
