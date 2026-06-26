"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

const ANONYMOUS_ACCESS_TOKEN = "anonymous";
const ANONYMOUS_USER_ID = "default";

function createAnonymousUser(displayName = "Guest"): User {
  const now = new Date(0).toISOString();

  return {
    id: ANONYMOUS_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "guest@local",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: {},
    user_metadata: { display_name: displayName },
    identities: [],
    factors: [],
    created_at: now,
    updated_at: now,
    is_anonymous: true,
  } as User;
}

function createAnonymousSession(user: User): Session {
  return {
    access_token: ANONYMOUS_ACCESS_TOKEN,
    refresh_token: ANONYMOUS_ACCESS_TOKEN,
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    token_type: "bearer",
    user,
  } as Session;
}

interface AuthContextType {
  user: User;
  session: Session;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [displayName, setDisplayName] = useState("Guest");

  const user = useMemo(() => createAnonymousUser(displayName), [displayName]);
  const session = useMemo(() => createAnonymousSession(user), [user]);

  const noAuthResult = useCallback(async () => ({ error: null }), []);

  const updateDisplayName = useCallback(async (nextDisplayName: string) => {
    setDisplayName(nextDisplayName.trim() || "Guest");
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading: false,
        signIn: noAuthResult,
        signUp: noAuthResult,
        signOut: async () => {},
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
