# Copilot Instructions for AI Coding Agents

## Project Overview

- **vectr-4** is a full-stack application with a Next.js (TypeScript) frontend (`src/`) and a Python backend (`python/`).
- The frontend uses modern React patterns, shadcn/ui, Tailwind CSS, and Radix UI primitives. The backend provides data processing and API endpoints.
- Data flows between the frontend and backend, with Supabase used for authentication and as a data store.

## Key Directories & Files

- `src/app/` — Next.js app directory (routes, layouts, pages)
- `src/components/` — UI and feature components, organized by domain (e.g., `private/`, `public/`, `ui/`)
- `src/data/` — Static and mock data for UI
- `src/lib/` — Utility and data processing scripts (e.g., `transaction_processing.js`)
- `src/types/` — TypeScript types for data models
- `python/app/` — FastAPI app (`main.py`), routers, and endpoints
- `python/core/` — Core business logic (e.g., `matching.py`, `parser.py`)
- `python/supabase/` — Supabase client integration

## Developer Workflows

- **Start frontend:** `npm run dev` (Next.js, port 3000)
- **Build frontend:** `npm run build`
- **Lint:** `npm run lint`
- **Backend:** Activate Python venv in `python/`, run FastAPI app (see `main.py`)
- **Testing:** Python tests in `python/tests/` (pytest), JS/TS tests not present by default
- **Deploy:** Vercel for frontend (see README)

## Project-Specific Patterns

- **Component Aliases:** Use `@/components`, `@/lib`, `@/data`, etc. (see `components.json`)
- **UI Components:** Prefer shadcn/ui and Radix primitives for new UI; see `src/components/ui/`
- **Data Processing:** Use `src/lib/transaction_processing.js` for transaction logic; backend logic in `python/core/`
- **API Integration:** Supabase is used for auth and data; see `.env` and `src/lib/transaction_processing.js`
- **Routing:** Next.js app directory routing; private routes under `src/app/private/`

## Integration Points

- **Supabase:** Used in both frontend (`@supabase/supabase-js`) and backend (`python/supabase/client.py`)
- **CSV Data:** Bank transaction CSVs in `src/lib/` and `python/data/`
- **Shared Data Models:** TypeScript types in `src/types/`, Python models in backend

## Conventions

- **File Naming:** Use kebab-case for files, PascalCase for React components
- **Styling:** Tailwind CSS via `globals.css` and `tailwind.config.js`
- **Environment:** Use `.env` for secrets; do not commit `.env*` files
- **No default JS/TS tests:** Add tests in `src/` as needed; Python tests in `python/tests/`

## Examples

- To add a new dashboard widget: create a component in `src/components/private/dashboard/`, update data in `src/data/dashboard-data.ts`, and wire up in `src/app/private/dashboard/page.tsx`.
- To process transactions: update logic in `src/lib/transaction_processing.js` (frontend) or `python/core/matching.py` (backend).

---

For more, see `README.md` and `components.json`. Keep instructions concise and up-to-date with actual project structure and practices.
