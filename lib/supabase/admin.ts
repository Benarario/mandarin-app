import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (bypasses RLS) for trusted server-only tasks
 * such as writing pre-generated TTS audio to Storage. Never import from a
 * Client Component. Returns null if the service-role key isn't configured.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("REPLACE_ME") || key.includes("REPLACE_ME")) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
