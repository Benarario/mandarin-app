import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Resolve the signed-in user + a Supabase client, or throw. Shared by actions. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export type ActionDb = Awaited<ReturnType<typeof createClient>>;
