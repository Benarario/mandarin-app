import "server-only";
import type { ActionDb } from "@/lib/require-user";

/**
 * Per-character mastery STATUS (0–5) for the user, from concept_progress — the
 * single source of truth that drives pinyin fading. A character's pinyin only
 * fades once that character's own status reaches "familiar" (4), and re-appears
 * if the status drops after a lapse.
 */
type Joined = { status: number; concepts: { type: string; ref: string } | { type: string; ref: string }[] | null };

async function statusRows(supabase: ActionDb, userId: string): Promise<Joined[]> {
  const { data } = await supabase
    .from("concept_progress")
    .select("status, concepts(type, ref)")
    .eq("user_id", userId);
  return (data ?? []) as unknown as Joined[];
}

export async function getCharStatusMap(
  supabase: ActionDb,
  userId: string,
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const row of await statusRows(supabase, userId)) {
    const c = Array.isArray(row.concepts) ? row.concepts[0] : row.concepts;
    if (c?.type === "character") map[c.ref] = row.status;
  }
  return map;
}

/** Both character and word mastery-status maps (for the reader's coloring). */
export async function getStatusMaps(
  supabase: ActionDb,
  userId: string,
): Promise<{ char: Record<string, number>; word: Record<string, number> }> {
  const char: Record<string, number> = {};
  const word: Record<string, number> = {};
  for (const row of await statusRows(supabase, userId)) {
    const c = Array.isArray(row.concepts) ? row.concepts[0] : row.concepts;
    if (c?.type === "character") char[c.ref] = row.status;
    else if (c?.type === "word") word[c.ref] = row.status;
  }
  return { char, word };
}
