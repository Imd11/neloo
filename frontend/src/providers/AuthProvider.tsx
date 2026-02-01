"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabaseClient();

  // Ensure user has a profile in user_profiles table (for agent store creator names)
  const ensureUserProfile = useCallback(async (user: User) => {
    try {
      const displayName =
        (user.user_metadata?.display_name as string) ||
        user.email?.split('@')[0] ||
        "User";

      await supabase
        .from("user_profiles")
        .upsert(
          {
            id: user.id,
            display_name: displayName
          },
          { onConflict: "id" }
        );
    } catch (error) {
      // Silently fail - table may not exist yet, or RLS may block
      console.warn("Could not sync user profile:", error);
    }
  }, [supabase]);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        // Ensure user profile exists on initial load
        if (session?.user) {
          ensureUserProfile(session.user);
        }
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Ensure user profile exists on sign in
      if (event === "SIGNED_IN" && session?.user) {
        ensureUserProfile(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, ensureUserProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          return { error };
        }
        return { error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [supabase]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          return { error };
        }
        return { error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  // Update user display name in both Supabase user_metadata AND user_profiles table
  const updateDisplayName = useCallback(async (displayName: string) => {
    try {
      // 1. Update Auth user_metadata
      const { error, data } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      });
      if (error) {
        return { error };
      }

      // 2. Sync to user_profiles table (for agent store creator names)
      if (data.user) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .upsert(
            {
              id: data.user.id,
              display_name: displayName
            },
            { onConflict: "id" }
          );

        if (profileError) {
          console.warn("Could not sync profile to user_profiles:", profileError);
          // Don't fail the whole operation - Auth update succeeded
        }

        // Update local user state with new metadata
        setUser(data.user);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

