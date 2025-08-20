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
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  // The 'loading' state now represents the initial check for a session.
  const [loading, setLoading] = useState(true);

  const supabase = createClientComponentClient();

  useEffect(() => {
    // The onAuthStateChange listener is the single source of truth.
    // It fires once on load with the initial session, and then for any change.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // When the listener fires, the initial check is complete.
      setLoading(false);
      setUser(session?.user ?? null);
    });

    // The cleanup function for the effect is to unsubscribe from the listener.
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]); // The effect depends only on the auth client instance.

  return {
    user,
    loading,
    userId: user?.id ?? null,
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
