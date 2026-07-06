import { createBrowserClient } from "@supabase/ssr";

const _SUPABASE_PLACEHOLDERS = ["your-project", "your-supabase", "placeholder"];

/**
 * True only when real Supabase URL + anon key are configured.
 * Empty values and the obvious placeholders from .env.example count as unset,
 * so the app can boot (and most features work) without Supabase configured.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  return !_SUPABASE_PLACEHOLDERS.some((p) => url.includes(p) || key.includes(p));
}

export function createClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Singleton client for use in components
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
