# Vectr-4 Financial Transaction Management System

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Build the Repository

Run these commands in exact order. NEVER CANCEL any of these commands during execution:

- `npm ci` -- installs dependencies, takes 60-90 seconds. NEVER CANCEL. Set timeout to 180+ seconds.
- `npm run lint` -- validates code style, takes 2-5 seconds.
- `npm run format` -- formats all code files, takes 10-15 seconds. 
- `npm run build` -- **FAILS in restricted network environments** due to Google Fonts (fonts.gstatic.com). This is EXPECTED and documented.

### Environment Setup Requirements

**CRITICAL**: The application requires these environment variables to function:

**Next.js Frontend (.env.local in project root):**
- `NEXT_PUBLIC_SUPABASE_URL` -- Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- Supabase anonymous key  
- `SUPABASE_SERVICE_ROLE_KEY` -- Supabase service role key
- `PLAID_CLIENT_ID` -- Plaid API client ID
- `PLAID_SECRET` -- Plaid API secret
- `PLAID_ENV` -- Plaid environment (sandbox/development/production)
- `PLAID_WEBHOOK_URL` -- Webhook URL for Plaid callbacks
- `NEXT_PUBLIC_APP_URL` -- Application base URL

**Python Backend (.env.local in project root):**
- `SUPABASE_URL` -- Same as NEXT_PUBLIC_SUPABASE_URL
- `SUPABASE_SERVICE_ROLE_KEY` -- Same as Next.js version

Without these variables, the application will start but authentication and data operations will fail with 500 errors.

### Development Workflow

**Start Full Development Environment:**
- `npm run dev` -- starts Next.js (port 3000), Python FastAPI (port 8000), and ngrok tunnel concurrently. Takes 3-5 seconds to start Next.js portion.

**Start Individual Components:**
- `npm run dev:next-only` -- starts only Next.js frontend on port 3000. Takes 2-3 seconds, ALWAYS works.
- For Python backend: `cd python && source .venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000`

**Python Backend Setup:**
- `cd python && python3 -m venv .venv` -- create virtual environment
- `source .venv/bin/activate` -- activate environment (Linux/Mac)
- `pip install -r requirements.txt` -- install dependencies, takes 30-60 seconds

### Build Limitations and Workarounds

**Google Fonts Network Issue:**
- `npm run build` fails with "Failed to fetch Inter from Google Fonts" in restricted networks
- This is due to `src/app/layout.tsx` importing `Inter` from `next/font/google`
- Frontend development with `npm run dev:next-only` works normally
- Production builds work in environments with internet access

**Python Backend Requirements:**
- Backend fails to start without environment variables
- Error: "SUPABASE_URL must be set in the .env file"
- Test endpoints require requests module: `pip install requests` in the Python venv

## Validation Scenarios

**ALWAYS run these validation steps after making changes:**

### Frontend Validation
- `npm run dev:next-only` and verify http://localhost:3000 loads the landing page
- Test navigation to /public/login and verify login form displays
- Take screenshot of homepage to confirm UI is working properly
- ALWAYS test at least one complete user flow after making frontend changes

### Backend Validation  
- Start Python FastAPI and verify it responds to basic endpoints
- Test user rules endpoints if making backend changes: `cd python && python tests/test_user_rules_endpoints.py`
- Verify Supabase integration works with valid environment variables

### Code Quality
- `npm run lint` -- NEVER produces errors. Fix all linting errors before committing.
- `npm run format` -- formats code consistently. ALWAYS run before committing.

## Critical Timing Requirements

**NEVER CANCEL builds or long-running commands. Always set appropriate timeouts:**

- `npm ci`: 60-180 seconds (set timeout 300+ seconds)
- `npm run build`: 120-300 seconds when working (set timeout 600+ seconds)  
- `npm run dev:next-only`: 2-5 seconds (minimal timeout needed)
- `npm run lint`: 2-5 seconds (minimal timeout needed)
- `npm run format`: 10-20 seconds (set timeout 60+ seconds)
- `pip install -r requirements.txt`: 30-120 seconds (set timeout 300+ seconds)

## Key Architecture Components

### Dual Architecture
- **Frontend**: Next.js 15.4.6 with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Python FastAPI with Supabase integration, pandas for data processing
- **Database**: Supabase (PostgreSQL) with RLS policies and extensive schema
- **Integration**: Plaid API for financial institution connections

### Key Directories
- `src/app/` -- Next.js app router pages and API routes
- `src/components/` -- React components organized by domain  
- `src/lib/` -- Utilities, analytics, and integrations
- `python/app/` -- FastAPI routers and dependencies
- `python/tests/` -- Python endpoint tests
- `sql/` -- Database migrations and setup scripts
- `src/docs/` -- Frontend documentation and feature specs

### Important Files
- `src/app/api/ai/chat/route.ts` -- AI-powered financial analysis endpoint
- `src/lib/analytics/validate-planner.ts` -- AI planner validation logic
- `python/app/main.py` -- FastAPI application entry point
- `python/supabase_client/client.py` -- Supabase connection configuration
- `src/app/private/transactions/page.tsx` -- Main transaction management interface

## Development Patterns

### When Making Frontend Changes
- Use `@/` imports for clean module resolution
- Follow shadcn/ui patterns for components
- Always test with `npm run dev:next-only` 
- Take screenshots of UI changes to validate functionality
- ALWAYS run `npm run lint` and `npm run format` before committing

### When Making Backend Changes  
- Test Python endpoints with the scripts in `python/tests/`
- Follow FastAPI router patterns in `python/app/routers/`
- Validate Supabase queries work with RLS policies
- ALWAYS verify environment variable requirements

### When Making Database Changes
- Add migration files to `sql/` directory with sequential numbering
- Test with Supabase CLI if available
- Update RLS policies as needed for security
- Document any new environment variables required

## Common Issues and Solutions

**Build fails with Google Fonts error:**
- Expected in restricted networks
- Use `npm run dev:next-only` for development
- Production builds work with internet access

**Python backend fails to start:**
- Verify all environment variables are set
- Check `python/supabase_client/client.py` for required variables
- Install missing dependencies in virtual environment

**500 errors in browser console:**
- Usually indicates missing environment variables
- Check browser network tab for specific API failures
- Verify Supabase connection and authentication

**Linting errors:**
- Run `npm run lint:fix` to auto-fix many issues
- Follow TypeScript strict mode requirements
- Use consistent import patterns and component structure

## Quick Commands Reference

```bash
# Full setup from scratch
npm ci
cd python && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd ..

# Development
npm run dev:next-only          # Frontend only
npm run dev                    # Full stack (requires env vars)

# Code quality
npm run lint                   # Check code style
npm run format                 # Format all files  

# Validation
npm run dev:next-only && curl http://localhost:3000/  # Test frontend
cd python && source .venv/bin/activate && python tests/test_user_rules_endpoints.py  # Test backend (requires env)
```

## Security and Environment

- Never commit environment variables or API keys
- Use `.env.local` for local development environment variables
- RLS policies protect all Supabase data access
- Plaid integration requires webhook URL configuration
- All external API calls require proper authentication

---

*This document should be updated whenever the architecture, build process, or validation requirements change.*