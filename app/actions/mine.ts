"use server";

import { requireUser } from "@/lib/require-user";
import { getDefaultDeckId } from "@/lib/decks";
import { introduceConcept } from "@/app/actions/lesson";
import { newCardFields } from "@/lib/srs/fsrs";
import { assertOnlyTaught } from "@/lib/graph/gate";
import { lookupBest } from "@/lib/dict/lookup";

const HAN = /\p{Script=Han}/u;

/** Add a word/character from the reader into the deck (curriculum-aware). */
export async function addWordToDeck(token: string): Promise<{ added: number; reason?: string }> {
  const { supabase, user } = await requireUser();
  const ids: string[] = [];

  const { data: wordConcept } = await supabase
    .from("concepts")
    .select("id")
    .eq("id", `word:${token}`)
    .maybeSingle();
  if (wordConcept) ids.push(wordConcept.id as string);
  else {
    // Introduce the curriculum characters that make up this token.
    const chars = [...token].filter((c) => HAN.test(c));
    const { data: charConcepts } = await supabase
      .from("concepts")
      .select("id")
      .in("id", chars.map((c) => `char:${c}`));
    for (const c of charConcepts ?? []) ids.push((c as { id: string }).id);
  }

  if (ids.length === 0) {
    const entry = await lookupBest(token);
    return { added: 0, reason: entry ? "not in the curriculum yet" : "not in dictionary" };
  }

  let added = 0;
  for (const id of ids) if ((await introduceConcept(id)).introduced) added++;
  return { added, reason: added === 0 ? "already in your deck" : undefined };
}

// Graded self-assessment levels the reader may set. 2 = still learning (not
// mastered, pinyin stays, dependents stay locked); 4 = familiar (mastered for
// gating, pinyin fades); 5 = strong. All are reversible.
const KNOWN_STATUSES = new Set([2, 4, 5]);

/**
 * Self-assessment from the reader: mark a word (and its characters) at a chosen
 * mastery level. `status` must be one of the allowed graded values.
 */
export async function markKnown(token: string, status: number): Promise<{ ok: boolean }> {
  if (!KNOWN_STATUSES.has(status)) return { ok: false };
  const { supabase, user } = await requireUser();
  const ids = [`word:${token}`, ...[...token].filter((c) => HAN.test(c)).map((c) => `char:${c}`)];
  const { data: existing } = await supabase.from("concepts").select("id").in("id", ids);
  const valid = (existing ?? []).map((r) => (r as { id: string }).id);
  if (valid.length === 0) return { ok: false };
  const now = new Date().toISOString();
  await supabase.from("concept_progress").upsert(
    valid.map((concept_id) => ({ user_id: user.id, concept_id, status, introduced_at: now, updated_at: now })),
    { onConflict: "user_id,concept_id" },
  );
  return { ok: true };
}

/** Sentence mining: turn a sentence from the reader into a review card. */
export async function mineSentence(zh: string, en: string): Promise<{ added: boolean; stretch: boolean }> {
  const { supabase, user } = await requireUser();
  const gate = await assertOnlyTaught(user.id, zh);
  const deckId = await getDefaultDeckId(supabase, user.id);

  const { data: note } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      note_type_id: "zh-vocab",
      fields_json: { simplified: zh, pinyin: "", english: en, sentence_zh: zh, sentence_en: en, audio_key: "" },
      tags: gate.ok ? [] : ["stretch"],
      source: "sentence-mining",
      verified: gate.ok,
    })
    .select("id")
    .single();

  await supabase.from("cards").insert({
    note_id: note!.id,
    user_id: user.id,
    deck_id: deckId,
    template_index: 0,
    modality: "reading",
    ...newCardFields(new Date()),
  });

  return { added: true, stretch: !gate.ok };
}
