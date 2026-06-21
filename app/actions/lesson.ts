"use server";

import { requireUser, type ActionDb } from "@/lib/require-user";
import { newCardFields } from "@/lib/srs/fsrs";
import { nextConcepts, allowedVocabulary } from "@/lib/graph/gate";
import { findUntaughtTokens } from "@/lib/graph/logic";
import { segment } from "@/lib/segment/jieba";
import type { BreakdownPart, ConceptType } from "@/lib/db/concept-types";

interface ConceptRow {
  id: string;
  type: ConceptType;
  ref: string;
  label: string;
  gloss: string | null;
  prereq_ids: string[];
}

async function getDefaultDeckId(supabase: ActionDb, userId: string): Promise<string> {
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

/** Glosses for a set of components/characters, for the breakdown display. */
async function glossMap(supabase: ActionDb, table: "components" | "characters", keys: string[]) {
  if (keys.length === 0) return new Map<string, string | null>();
  const col = table === "components" ? "char" : "char";
  const glossCol = table === "components" ? "gloss" : "glosses";
  const { data } = await supabase.from(table).select(`${col}, ${glossCol}`).in(col, keys);
  const map = new Map<string, string | null>();
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const key = r[col] as string;
    const g = table === "components" ? (r.gloss as string | null) : ((r.glosses as string[])?.[0] ?? null);
    map.set(key, g ?? null);
  }
  return map;
}

/** Pick a verified example sentence whose every token is already taught. */
async function pickGatedSentence(
  supabase: ActionDb,
  userId: string,
  word: string,
): Promise<{ zh: string; en: string | null } | null> {
  const allowed = await allowedVocabulary(userId);
  allowed.add(word); // the word being introduced is allowed in its own card
  for (const c of [...word]) allowed.add(c);
  const { data } = await supabase
    .from("sentences")
    .select("zh_text, en_text")
    .ilike("zh_text", `%${word}%`)
    .limit(40);
  const candidates = (data ?? []).sort(
    (a, b) => [...a.zh_text].length - [...b.zh_text].length,
  );
  for (const cand of candidates) {
    const tokens = segment(cand.zh_text).filter((t) => t.isWord).map((t) => t.text);
    if (findUntaughtTokens(tokens, allowed).length === 0) {
      return { zh: cand.zh_text, en: cand.en_text };
    }
  }
  return null; // no fully-taught sentence yet — caller falls back to the word alone
}

async function buildNote(
  supabase: ActionDb,
  userId: string,
  concept: ConceptRow,
): Promise<{ noteTypeId: string; fields: Record<string, unknown> }> {
  switch (concept.type) {
    case "phoneme":
      return {
        noteTypeId: "zh-phoneme",
        fields: { label: concept.label, note: concept.gloss ?? "", example: "" },
      };
    case "component":
      return {
        noteTypeId: "zh-component",
        fields: { char: concept.ref, gloss: concept.gloss ?? "" },
      };
    case "character": {
      const { data: ch } = await supabase
        .from("characters")
        .select("pinyin, glosses, component_chars")
        .eq("char", concept.ref)
        .maybeSingle();
      const comps = (ch?.component_chars ?? []) as string[];
      const gm = await glossMap(supabase, "components", comps);
      const breakdown: BreakdownPart[] = comps.map((c) => ({ text: c, gloss: gm.get(c) ?? null }));
      return {
        noteTypeId: "zh-character",
        fields: {
          char: concept.ref,
          pinyin: ch?.pinyin ?? "",
          english: (ch?.glosses as string[])?.[0] ?? concept.gloss ?? "",
          components_json: breakdown,
        },
      };
    }
    case "word": {
      const { data: w } = await supabase
        .from("words")
        .select("pinyin, glosses, character_chars")
        .eq("simplified", concept.ref)
        .maybeSingle();
      const chars = (w?.character_chars ?? [...concept.ref]) as string[];
      const gm = await glossMap(supabase, "characters", chars);
      const breakdown: BreakdownPart[] = chars.map((c) => ({ text: c, gloss: gm.get(c) ?? null }));
      const sentence = await pickGatedSentence(supabase, userId, concept.ref);
      return {
        noteTypeId: "zh-vocab",
        fields: {
          simplified: concept.ref,
          pinyin: w?.pinyin ?? "",
          english: (w?.glosses as string[])?.[0] ?? concept.gloss ?? "",
          sentence_zh: sentence?.zh ?? concept.ref,
          sentence_en: sentence?.en ?? ((w?.glosses as string[])?.[0] ?? ""),
          audio_key: "",
          components_json: breakdown,
        },
      };
    }
  }
}

function cardSpecsFor(type: ConceptType): { template_index: number; modality: "reading" | "writing" | "listening" }[] {
  switch (type) {
    case "phoneme":
      return [{ template_index: 0, modality: "listening" }];
    case "component":
      return [{ template_index: 0, modality: "reading" }];
    case "character":
    case "word":
      return [
        { template_index: 0, modality: "reading" },
        { template_index: 1, modality: "writing" },
      ];
  }
}

/** Introduce a concept: create its note + card(s) + a concept_progress row. */
export async function introduceConcept(conceptId: string): Promise<{ introduced: boolean }> {
  const { supabase, user } = await requireUser();

  const { data: already } = await supabase
    .from("concept_progress")
    .select("concept_id")
    .eq("user_id", user.id)
    .eq("concept_id", conceptId)
    .maybeSingle();
  if (already) return { introduced: false };

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, type, ref, label, gloss, prereq_ids")
    .eq("id", conceptId)
    .maybeSingle();
  if (!concept) return { introduced: false };

  const deckId = await getDefaultDeckId(supabase, user.id);
  const { noteTypeId, fields } = await buildNote(supabase, user.id, concept as ConceptRow);

  const { data: note, error: noteErr } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      note_type_id: noteTypeId,
      fields_json: fields,
      concept_id: conceptId,
      verified: true,
      source: "concept-graph",
    })
    .select("id")
    .single();
  if (noteErr) throw noteErr;

  const base = newCardFields(new Date());
  const specs = cardSpecsFor((concept as ConceptRow).type);
  const { data: cards, error: cardErr } = await supabase
    .from("cards")
    .insert(
      specs.map((s) => ({
        note_id: note.id,
        user_id: user.id,
        deck_id: deckId,
        concept_id: conceptId,
        template_index: s.template_index,
        modality: s.modality,
        ...base,
      })),
    )
    .select("id");
  if (cardErr) throw cardErr;

  await supabase.from("concept_progress").insert({
    user_id: user.id,
    concept_id: conceptId,
    status: 1,
    introduced_at: new Date().toISOString(),
    fsrs_card_id: cards?.[0]?.id ?? null,
  });

  return { introduced: true };
}

/** Cold start: on a brand-new account, introduce the first unlocked concepts
 *  (which are phonology — tones/sounds — because they have no prerequisites). */
export async function ensureColdStart(): Promise<{ seeded: number }> {
  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("concept_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0) return { seeded: 0 };

  const { data: settings } = await supabase
    .from("user_settings")
    .select("daily_new_cards")
    .eq("user_id", user.id)
    .maybeSingle();
  const budget = settings?.daily_new_cards ?? 20;

  const next = await nextConcepts(user.id, budget);
  let seeded = 0;
  for (const c of next) {
    const r = await introduceConcept(c.id);
    if (r.introduced) seeded++;
  }
  return { seeded };
}
