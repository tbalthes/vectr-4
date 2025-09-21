import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createSupabaseServerClient() {
  // Access cookies via next/headers on each call to support route handlers

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async get(name: string) {
        // Next 15: cookies() is an async dynamic API and must be awaited
        const store = (await cookies()) as any;
        return store.get(name)?.value;
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          const store = (await cookies()) as any;
          store.set({ name, value, ...options });
        } catch {
          // ignore set during render; Next will persist in route handlers
        }
      },
      async remove(name: string) {
        try {
          const store = (await cookies()) as any;
          store.delete(name);
        } catch {
          // ignore
        }
      },
    },
  });
}
