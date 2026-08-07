import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase isn't configured — set VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY in .env. Using placeholder values so the app can still render; all Supabase calls will fail until this is set."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      // Every REST call re-fetches the same URL (e.g. the same messages
      // query on every send/realtime event) — without this, the browser's
      // HTTP cache can serve a stale response instead of hitting the
      // network, so new rows silently never show up.
      fetch: (input, init = {}) => fetch(input, { ...init, cache: "no-store" }),
    },
  }
);
