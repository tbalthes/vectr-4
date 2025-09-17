// Minimal server-side auth/session extraction helper
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SessionInfo {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Extract session information from request cookies.
 * This is intentionally minimal: it returns parsed access and refresh tokens if present.
 */
export async function extractSession(): Promise<SessionInfo> {
  const cookieStore = await cookies();
  const candidate = cookieStore
    .getAll()
    .find((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (!candidate) {
    return {};
  }
  try {
    const parsed = JSON.parse(candidate.value);
    if (Array.isArray(parsed) && parsed.length >= 2) {
      return { accessToken: parsed[0], refreshToken: parsed[1] };
    }
    return { accessToken: parsed.access_token, refreshToken: parsed.refresh_token };
  } catch {
    return { accessToken: candidate.value };
  }
}

export async function getUserIdFromSession(supabase: SupabaseClient, _session: SessionInfo) {
  // Placeholder: callers should pass supabase client initialized with session token
  const { data } = await supabase.auth.getUser();
  return data?.user?.id;
}
