"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { User, SupabaseClient } from "@supabase/supabase-js";
// Step 1: Import the correct, cookie-aware client hook
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ error: unknown }>;
  // Optional: Expose the client if other components need it
  supabase: SupabaseClient;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Step 2: Create the cookie-aware Supabase client inside the provider
  // This client will be used by all logic within the context.
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log(`Initial session. User: ${session?.user?.id ?? "null"}`);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // onAuthStateChange is the most reliable way to get session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // This listener fires on initial load, sign-in, and sign-out.
      console.log(`Auth state changed. User: ${session?.user?.id ?? "null"}`);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      // Clean up the subscription when the component unmounts
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error.message);
      // Even if there's an error, we should clear the local state and redirect
    }

    setUser(null);
    router.push("/public/login");

    // Step 3: Refresh the router to clear server-side caches and re-render the layout
    router.refresh();

    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) return { error: res.error };
    if (res.data?.user) setUser(res.data.user);
    return { error: null };
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (res.error) return { error: res.error };
    if (res.data?.user) setUser(res.data.user);
    return { error: null };
  };

  const value = { user, loading, signOut, signIn, signUp, supabase };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
