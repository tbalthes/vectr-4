import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const supabase = createClientComponentClient();

  const getUser = useCallback(async () => {
    try {
      // First check if we have a session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // No session available, user is not authenticated
        setUser(null);
        setLoading(false);
        setInitialized(true);
        return;
      }

      // If we have a session, get the user
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
        setUser(null);
      } else {
        setUser(user);
      }
    } catch (error) {
      console.error('Error in getUser:', error);
      setUser(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [supabase.auth]);

  useEffect(() => {
    if (!initialized) {
      getUser();
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (initialized) {
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth, getUser, initialized]);

  return {
    user,
    loading,
    userId: user?.id || null,
  };
}