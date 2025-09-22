import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // FIXED: Skip auth check for API routes - they handle their own auth
  // This prevents middleware from adding extra auth calls on every API request
  if (req.nextUrl.pathname.startsWith('/api')) {
    return res;
  }
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  try {
    // Only refresh session if we're on protected routes
    const isProtectedRoute = req.nextUrl.pathname.startsWith('/private');

    if (isProtectedRoute) {
      const { data, error } = await supabase.auth.getUser();
      const user = error ? null : data?.user;

      // If no user on protected route, redirect to login
      if (!user && !error) {
        const redirectUrl = new URL('/public/login', req.url);
        return NextResponse.redirect(redirectUrl);
      }
    }

    // For other routes, don't force session refresh
    return res;
  } catch (error) {
    console.error('Middleware auth error:', error);
    // On error, continue without session check to avoid loops
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
