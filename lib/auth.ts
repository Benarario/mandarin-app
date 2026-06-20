import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { User } from "@supabase/supabase-js";

/** The signed-in user (or null) in a Server Component / Action. */
export async function getUser(): Promise<User | null> {
  // If Supabase isn't configured yet, treat as signed-out so the app still boots.
  if (!hasSupabaseEnv()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    // Bad/unreachable credentials shouldn't crash the page — show signed-out.
    return null;
  }
}

/** True once Supabase env vars are present (used to guide first-time setup UI). */
export function isSupabaseConfigured(): boolean {
  return hasSupabaseEnv();
}
