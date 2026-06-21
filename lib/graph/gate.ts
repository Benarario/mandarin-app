import "server-only";
import { createClient } from "@/lib/supabase/server";
import { segment } from "@/lib/segment/jieba";
import {
  isConceptUnlocked,
  pickNextConcepts,
  findUntaughtTokens,
  MASTERED,
  type ConceptNode,
  type GateOptions,
} from "./logic";

type DB = Awaited<ReturnType<typeof createClient>>;

/** Concept ids the user has mastered (status ≥ 4). */
async function masteredIds(supabase: DB, userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("concept_progress")
    .select("concept_id")
    .eq("user_id", userId)
    .gte("status", MASTERED);
  return new Set((data ?? []).map((r) => (r as { concept_id: string }).concept_id));
}

/** Concept ids the user has been introduced to (status ≥ 1). */
async function introducedIds(supabase: DB, userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("concept_progress")
    .select("concept_id")
    .eq("user_id", userId)
    .gte("status", 1);
  return new Set((data ?? []).map((r) => (r as { concept_id: string }).concept_id));
}

/** True iff every prerequisite of `conceptId` is mastered for this user. */
export async function isUnlocked(userId: string, conceptId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("concepts").select("prereq_ids").eq("id", conceptId).maybeSingle();
  if (!data) return false;
  const mastered = await masteredIds(supabase, userId);
  return isConceptUnlocked((data as { prereq_ids: string[] }).prereq_ids, mastered);
}

/**
 * The ONLY characters + words a generator, reader text, or LLM call may use:
 * everything the learner has been introduced to.
 */
export async function allowedVocabulary(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("concept_progress")
    .select("concepts(type, ref)")
    .eq("user_id", userId)
    .gte("status", 1);
  const set = new Set<string>();
  type Joined = { concepts: { type: string; ref: string } | { type: string; ref: string }[] | null };
  for (const row of (data ?? []) as unknown as Joined[]) {
    // Supabase may type an embedded row as an object or a one-element array.
    const joined = Array.isArray(row.concepts) ? row.concepts[0] : row.concepts;
    if (joined && (joined.type === "character" || joined.type === "word")) set.add(joined.ref);
  }
  return set;
}

/** The next `n` unlocked-but-untaught concepts, in teaching order. */
export async function nextConcepts(userId: string, n = 10): Promise<ConceptNode[]> {
  const supabase = await createClient();
  const [mastered, introduced] = await Promise.all([
    masteredIds(supabase, userId),
    introducedIds(supabase, userId),
  ]);
  // Frontier window: scan concepts in teaching order. (Early-learner frontier is
  // always near the start; Phase B can offset by progress for advanced learners.)
  const { data } = await supabase
    .from("concepts")
    .select("id,type,ref,tier,prereq_ids,teaching_order")
    .order("teaching_order", { ascending: true })
    .limit(3000);
  return pickNextConcepts((data ?? []) as ConceptNode[], mastered, introduced, n);
}

/**
 * THE gate. Tokenize any candidate text/sentence/question and verify every token
 * has been taught. Every card, reader line, drill prompt and LLM output passes
 * through this before the learner sees it.
 */
export async function assertOnlyTaught(
  userId: string,
  text: string,
  opts: GateOptions = {},
): Promise<{ ok: boolean; offending: string[] }> {
  const allowed = await allowedVocabulary(userId);
  const tokens = segment(text).filter((t) => t.isWord).map((t) => t.text);
  const offending = findUntaughtTokens(tokens, allowed, opts);
  return { ok: offending.length === 0, offending };
}
