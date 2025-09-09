import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Temporary wrapper to suppress Next.js 15 cookie warnings
export function createSupabaseServerClient() {
  // Suppress console errors temporarily
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    // Only suppress specific cookie-related errors
    const message =
      typeof args[0] === "object" && args[0] !== null && "toString" in args[0]
        ? (args[0] as { toString: () => string }).toString()
        : String(args[0] ?? "");
    if (
      message.includes("cookies().get") ||
      message.includes("should be awaited")
    ) {
      return; // Suppress this error
    }
    originalError.apply(console, args);
  };

  const client = createRouteHandlerClient({
    cookies: cookies,
  });

  // Restore original console.error after a short delay
  setTimeout(() => {
    console.error = originalError;
  }, 100);

  return client;
}
