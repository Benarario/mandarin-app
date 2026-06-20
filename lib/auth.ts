import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** The signed-in user (or null) in a Server Component / Action. */
export async function getUser(): Promise<User | null> {
  // If Supabase isn't configured yet, treat as signed-out so the app still boots.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** True once Supabase env vars are present (used to guide first-time setup UI). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
