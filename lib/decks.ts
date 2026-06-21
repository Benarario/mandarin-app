import "server-only";
import type { ActionDb } from "@/lib/require-user";

/** The user's default "Mandarin" deck id, creating it if missing. */
export async function getDefaultDeckId(supabase: ActionDb, userId: string): Promise<string> {
  const { data } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Mandarin")
    .maybeSingle();
  if (data?.id) return data.id as string;
  const { data: created } = await supabase
    .from("decks")
    .insert({ user_id: userId, name: "Mandarin" })
    .select("id")
    .single();
  return created!.id as string;
}
