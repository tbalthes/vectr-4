import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This is the crucial line that fixes the issue.
// It tells Next.js to always run this route dynamically on the server.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

  // Prepare a JSON response so the client fetch receives a predictable
  // JSON body while we still attach cookies to the same response.
  const response = NextResponse.json({ success: true });

    // Resolve request-scoped cookies (some runtimes return a Promise, others return directly)
    const requestCookies = await cookies();

    // Minimal cookieStore wrapper expected by Supabase helper at runtime.
    const cookieStore = {
      get: (name: string) => {
        const c = requestCookies.get(name);
        return c ? c.value : undefined;
      },
      set: (name: string, value: string, options?: unknown) => {
        try {
          if (options && typeof options === "object") {
            // pass through options to NextResponse cookies
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            response.cookies.set({ name, value, ...options });
          } else {
            response.cookies.set(name, value);
          }
        } catch (e) {
          console.warn("cookie set failed", e);
        }
      },
      delete: (name: string) => {
        try {
          response.cookies.delete(name);
        } catch (e) {
          console.warn("cookie delete failed", e);
        }
      },
    };

    // Pass a function that returns the cookieStore wrapper as expected by createRouteHandlerClient
    const supabase = createRouteHandlerClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cookies: () => cookieStore as any,
    });

    console.log("Auth route: attempting sign in for", email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("Auth route: signInWithPassword result:", {
      data: !!data,
      session: data?.session ? !!data.session : false,
      error: error?.message,
    });

    if (error) {
      console.warn("Login failed:", error);
      return NextResponse.json(
        { error: error.message || String(error) },
        { status: 401 }
      );
    }

    // Return the JSON response we attached cookie writes to. Also include
    // the session and user information so the browser-side Supabase client
    // can update its local session cache immediately.
    // Note: cookies written to `response` will still be sent to the browser.
    return NextResponse.json(
      { success: true, session: data?.session ?? null, user: data?.user ?? null },
      { status: 200 }
    );
  } catch (err) {
    console.error("Auth route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
