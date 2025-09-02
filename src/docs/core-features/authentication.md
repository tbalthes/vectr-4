# Authentication System Documentation

## Overview
This document explains how the authentication system is implemented in the Vectr Financial application. The system uses Supabase for authentication with support for email/password and OAuth providers (Google and GitHub).

## Components

### 1. Supabase Client (`src/lib/supabaseClient.ts`)
Initializes the Supabase client with environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Auth Context (`src/context/AuthContext.tsx`)
Provides authentication state and functions to the application:
- `user`: Current user object or null
- `loading`: Loading state
- `signOut`: Function to sign out the user

The context also handles:
- Auth state change listener
- Initial session check

### 3. Login Form (`src/components/public/login/LoginForm.tsx`)
Implements email/password login with:
- Form validation
- Error handling
- OAuth sign-in buttons
- Redirect to dashboard on successful login

### 4. Signup Form (`src/components/public/register/SignUpForm.tsx`)
Implements email/password signup with:
- Form validation (full name, email, password, confirm password)
- Error handling
- OAuth sign-in buttons
- Redirect to dashboard on successful signup

### 5. Social Login Buttons (`src/components/public/register/SocialLoginButtons.tsx`)
Provides OAuth sign-in buttons for:
- Google
- GitHub

### 6. Private Layout (`src/app/private/layout.tsx`)
Protects private routes by:
- Checking if user is authenticated
- Redirecting to login page if not authenticated

### 7. Sidebar (`src/components/Sidebar.tsx`)
Provides a sign-out button that uses the signOut function from AuthContext.

### 8. Auth Callback Route (`src/app/auth/callback/route.ts`)
Handles OAuth callback by:
- Exchanging code for session
- Redirecting to dashboard

## Environment Variables
The following environment variables need to be set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Testing Authentication Flows

### Email/Password Login
1. Navigate to `/public/login`
2. Enter email and password
3. Click "Sign In"
4. Should redirect to `/private/dashboard`

### Email/Password Signup
1. Navigate to `/public/register`
2. Enter full name, email, password, and confirm password
3. Click "Create Account"
4. Should redirect to `/private/dashboard`

### OAuth Login (Google)
1. Navigate to `/public/login` or `/public/register`
2. Click Google icon in "Or continue with" section
3. Complete Google authentication
4. Should redirect to `/private/dashboard`

### OAuth Login (GitHub)
1. Navigate to `/public/login` or `/public/register`
2. Click GitHub icon in "Or continue with" section
3. Complete GitHub authentication
4. Should redirect to `/private/dashboard`

### Sign Out
1. Navigate to any private page
2. Click "Sign Out" in the sidebar
3. Should redirect to `/public/login`

## Protected Routes
All routes under `/private/*` are protected and require authentication. Unauthenticated users will be redirected to `/public/login`.