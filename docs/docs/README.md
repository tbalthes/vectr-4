# Frontend Documentation

## Overview

This directory contains documentation for the Vectr-4 frontend application built with Next.js, TypeScript, and Tailwind CSS. The application provides a comprehensive financial transaction management interface with AI-powered insights.

## Core Features

### User Interface Components

- **[Authentication System](./core-features/authentication.md)** - Login, signup, and session management
- **[Transaction Management](./core-features/transaction-management.md)** - Transaction display, editing, and filtering
- **[User Rules Management](./core-features/user-rules.md)** - Custom categorization rules interface
- **[Analytics Dashboard](./core-features/analytics.md)** - Financial insights and reporting

### AI & Intelligence

- **[VectrAI System](./core-features/vectr-ai.md)** - AI-powered financial analysis and chat interface

### Architecture & Integration

- **[System Architecture](./architecture/system-design.md)** - Application structure and data flow
- **[API Integration](./architecture/api-integration.md)** - Frontend-backend communication patterns
- **[Database Integration](./architecture/database-integration.md)** - Supabase integration and data models

## Archive

Historical documentation and implementation notes:

- **[Filter Implementation Status](./archive/filter-implementation-status.md)** - Advanced filtering development history
- **[Database Backend Changes](./archive/db-backend-changes.md)** - Historical database modifications

## Quick Start

### Key Directories

- `src/app/` - Next.js app router pages and layouts
- `src/components/` - React components organized by domain
- `src/lib/` - Utilities, data processing, and integrations
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Custom React hooks

### Development Patterns

- Use `@/` imports for clean module resolution
- Prefer shadcn/ui components for consistent design
- Follow domain-driven component organization
- Use Tailwind CSS for styling with semantic class names

### State Management

- React hooks for local component state
- Context providers for shared authentication state
- Server-side data fetching with Next.js patterns
- Client-side caching with React Query patterns

---

_Last updated: September 1, 2025_
