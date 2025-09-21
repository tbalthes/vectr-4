'use client';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side singleton client. This relies on auth-helpers replacement `@supabase/ssr`
// which persists session in cookies/localStorage and supports RLS via JWT.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
