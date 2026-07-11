"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

const ANONYMOUS_SESSION_STORAGE_KEY = "neloo:anonymous-session";
const DISPLAY_NAME_STORAGE_KEY = "neloo:display-name";
const PENDING_USER_ID = "local-pending";

interface AnonymousSessionRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

function readStoredAnonymousSession(): AnonymousSessionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(ANONYMOUS_SESSION_STORAGE_KEY) || "null");
    if (
      typeof value?.token === "string" &&
      typeof value?.userId === "string" &&
      typeof value?.expiresAt === "number" &&
      value.expiresAt > Date.now() + 60_000
    ) {
      return value;
    }
  } catch {
    // A corrupt browser value is replaced with a fresh guest session.
  }
  return null;
}

function createAnonymousUser(userId: string, displayName = "Guest"): User {
  const now = new Date(0).toISOString();

  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: `guest-${userId}@local`,
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

function createAnonymousSession(user: User, accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: accessToken,
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
  const [anonymousSession, setAnonymousSession] = useState<AnonymousSessionRecord | null>(null);

  useEffect(() => {
    const storedName = window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    if (storedName?.trim()) setDisplayName(storedName.trim());

    const storedSession = readStoredAnonymousSession();
    if (storedSession) {
      setAnonymousSession(storedSession);
      return;
    }

    let cancelled = false;
    const createSession = async () => {
      try {
        const response = await fetch("/api/anonymous-session", { method: "POST" });
        if (!response.ok) throw new Error("Unable to create a guest session");
        const session = await response.json() as AnonymousSessionRecord;
        if (!cancelled) {
          window.localStorage.setItem(ANONYMOUS_SESSION_STORAGE_KEY, JSON.stringify(session));
          setAnonymousSession(session);
        }
      } catch (error) {
        console.error("[Auth] Failed to create anonymous session:", error);
      }
    };

    void createSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const user = useMemo(
    () => createAnonymousUser(anonymousSession?.userId || PENDING_USER_ID, displayName),
    [anonymousSession?.userId, displayName]
  );
  const session = useMemo(
    () => createAnonymousSession(user, anonymousSession?.token || ""),
    [anonymousSession?.token, user]
  );

  const noAuthResult = useCallback(async () => ({ error: null }), []);

  const updateDisplayName = useCallback(async (nextDisplayName: string) => {
    const nextName = nextDisplayName.trim() || "Guest";
    window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, nextName);
    setDisplayName(nextName);
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading: !anonymousSession,
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
