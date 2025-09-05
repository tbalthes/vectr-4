import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  try {
    // Only refresh session if we're on protected routes
    const isProtectedRoute = req.nextUrl.pathname.startsWith("/private");

    if (isProtectedRoute) {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      // If no session on protected route, redirect to login
      if (!session && !error) {
        const redirectUrl = new URL("/public/login", req.url);
        return NextResponse.redirect(redirectUrl);
      }
    }

    // For other routes, don't force session refresh
    return res;
  } catch (error) {
    console.error("Middleware auth error:", error);
    // On error, continue without session check to avoid loops
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
