'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// Step 1: Import the correct, cookie-aware client hook
import { supabase } from '@/lib/supabase/supabase';

interface Profile {
  id: string;
  full_name: string | null;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: unknown }>;
  supabase: SupabaseClient;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Step 2: Create the cookie-aware Supabase client inside the provider
  // This client will be used by all logic within the context.
  // use shared browser client

  // Fetch profile from public.profiles
  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', userId)
        .single();
      if (error) {
        setProfile(null);
      } else {
        setProfile(data);
      }
    },
    [supabase],
  );

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      const currentUser = error ? null : (data?.user ?? null);
      setUser(currentUser);
      if (currentUser?.id) {
        void fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    };

    void getInitialSession();

    // onAuthStateChange is the most reliable way to get session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        void fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router, fetchProfile]);

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error signing out:', error.message);
      // Even if there's an error, we should clear the local state and redirect
    }

    setUser(null);
    router.push('/public/login');

    // Step 3: Refresh the router to clear server-side caches and re-render the layout
    router.refresh();

    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) {
      return { error: res.error };
    }
    if (res.data?.user) {
      setUser(res.data.user);
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (res.error) {
      return { error: res.error };
    }
    if (res.data?.user) {
      setUser(res.data.user);
    }
    return { error: null };
  };

  const value = { user, profile, loading, signOut, signIn, signUp, supabase };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
