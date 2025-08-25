"use client";

import { useState, useEffect } from "react";
// We still need the correct client hook from the auth helpers
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { User } from "@supabase/supabase-js";

// The return type of our hook for better TypeScript inference
interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  userId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ error: unknown }>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  // The 'loading' state now represents the initial check for a session.
  const [loading, setLoading] = useState(true);

  const supabase = createClientComponentClient();

  useEffect(() => {
    let mounted = true;

    // Fetch the initial session once (ensures we have the current user immediately)
    (async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;
        if (error) {
          console.error("useAuth: getSession error", error);
        }
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (err) {
        console.error("useAuth: getSession unexpected error", err);
        if (mounted) setLoading(false);
      }
    })();

    // Subscribe to auth state changes to keep user state in sync
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Update user when auth state changes (login/logout)
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      data?.subscription.unsubscribe();
    };
  }, [supabase]); // depend on supabase client instance

  return {
    user,
    loading,
    userId: user?.id ?? null,
    signIn: async (email: string, password: string) => {
      // sign in with password
      const res = await supabase.auth.signInWithPassword({ email, password });
      if (res.error) return { error: res.error };
      // update local user state immediately when possible
      if (res.data?.user) setUser(res.data.user);
      return { error: null };
    },
    signUp: async (email: string, password: string, name?: string) => {
      const res = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (res.error) return { error: res.error };
      if (res.data?.user) setUser(res.data.user);
      return { error: null };
    },
  };
}

// --- HOW TO USE THIS HOOK ---
/*
import { useAuth } from '@/hooks/useAuth';

function UserProfileComponent() {
  const { user, loading, userId } = useAuth();

  if (loading) {
    // This will show until the initial session check is complete
    return <div>Loading user information...</div>;
  }

  if (!user) {
    // Once loading is false, if there's no user, they are logged out.
    return <div>Please log in to see your profile.</div>;
  }

  // If we get here, loading is false and we have a user.
  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <p>Your User ID is: {userId}</p>
    </div>
  );
}
*/
