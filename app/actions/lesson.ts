"use server";

import { requireUser, type ActionDb } from "@/lib/require-user";
import { getDefaultDeckId } from "@/lib/decks";
import { newCardFields } from "@/lib/srs/fsrs";
import { nextConcepts, allowedVocabulary } from "@/lib/graph/gate";
import { findUntaughtTokens } from "@/lib/graph/logic";
import { segment } from "@/lib/segment/jieba";
import { primaryGloss } from "@/lib/dict/gloss";
import { parseSyllable } from "@/lib/pinyin/syllable";
import type { BreakdownPart, ConceptType } from "@/lib/db/concept-types";

interface ConceptRow {
  id: string;
  type: ConceptType;
  ref: string;
  label: string;
  gloss: string | null;
  prereq_ids: string[];
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
    const g = table === "components" ? (r.gloss as string | null) : primaryGloss((r.glosses as string[]) ?? []);
    map.set(key, g || null);
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

// Tone pronunciation examples (the classic mā/má/mǎ/mà series) — used only as
// illustration in Stage 0, before any character is formally taught (spec §7).
const TONE_EXAMPLE: Record<string, { char: string; pinyin: string }> = {
  tone1: { char: "妈", pinyin: "mā" },
  tone2: { char: "麻", pinyin: "má" },
  tone3: { char: "马", pinyin: "mǎ" },
  tone4: { char: "骂", pinyin: "mà" },
  tone5: { char: "吗", pinyin: "ma" },
};
const TONE_NOTE: Record<string, string> = {
  tone1: "High and flat — hold a steady high pitch.",
  tone2: "Rising — like asking “huh?”.",
  tone3: "Dips low, then rises.",
  tone4: "Sharp falling — like a firm “No!”.",
  tone5: "Light and short, with no tone.",
};

interface PhonemeExample {
  char: string; // a real word/character that features the sound
  pinyin: string; // its verified diacritic pinyin
}

// One real example word per initial/final, keyed by the phoneme ref
// (e.g. "initial_b", "final_ang"). Built once per server process from the most
// frequent dictionary entries — never invented — so every sound is illustrated
// the same way tones are. Single characters are preferred (clearest); a short
// common word fills in for sounds that have no common standalone character.
let phonemeExampleCache: Promise<Record<string, PhonemeExample>> | null = null;

async function buildPhonemeExampleMap(supabase: ActionDb): Promise<Record<string, PhonemeExample>> {
  const { data } = await supabase
    .from("dictionary")
    .select("simplified, pinyin, pinyin_numbered, freq_rank")
    .not("freq_rank", "is", null)
    .order("freq_rank", { ascending: true, nullsFirst: false })
    .limit(8000);

  const rows = (data ?? []) as { simplified: string; pinyin: string; pinyin_numbered: string }[];
  const map: Record<string, PhonemeExample> = {};

  const consider = (r: { simplified: string; pinyin: string; pinyin_numbered: string }) => {
    const chars = [...r.simplified];
    const syls = r.pinyin_numbered.trim().split(/\s+/);
    if (chars.length !== syls.length) return; // skip entries we can't align
    // Skip proper-noun / surname readings (capitalised in CC-CEDICT) so the
    // illustrative reading is a clean common word, e.g. "néng" not "Néng".
    if (r.pinyin && r.pinyin[0] !== r.pinyin[0].toLowerCase()) return;
    for (const syl of syls) {
      const parsed = parseSyllable(syl);
      if (!parsed) continue;
      if (parsed.initial) {
        const k = `initial_${parsed.initial}`;
        if (!map[k]) map[k] = { char: r.simplified, pinyin: r.pinyin };
      }
      const fk = `final_${parsed.final}`;
      if (!map[fk]) map[fk] = { char: r.simplified, pinyin: r.pinyin };
    }
  };

  // Pass 1: single characters (the clearest illustration of a sound).
  for (const r of rows) if ([...r.simplified].length === 1) consider(r);
  // Pass 2: short words fill any sound still without an example.
  for (const r of rows) if ([...r.simplified].length === 2) consider(r);

  return map;
}

function getPhonemeExampleMap(supabase: ActionDb): Promise<Record<string, PhonemeExample>> {
  if (!phonemeExampleCache) phonemeExampleCache = buildPhonemeExampleMap(supabase);
  return phonemeExampleCache;
}

async function phonemeFields(
  supabase: ActionDb,
  ref: string,
  label: string,
): Promise<Record<string, unknown>> {
  if (ref.startsWith("tone") && TONE_EXAMPLE[ref]) {
    const ex = TONE_EXAMPLE[ref];
    return { label, note: TONE_NOTE[ref] ?? "", example: ex.char, example_pinyin: ex.pinyin };
  }
  if (ref.startsWith("initial_") || ref.startsWith("final_")) {
    const note = ref.startsWith("initial_")
      ? "A starting sound (consonant) of a syllable."
      : "A syllable ending (vowel sound).";
    // Attach a real example word (with audio) for this sound, if one exists.
    const ex = (await getPhonemeExampleMap(supabase))[ref];
    return ex
      ? { label, note, example: ex.char, example_pinyin: ex.pinyin }
      : { label, note, example: "" };
  }
  if (ref.startsWith("pair_"))
    return { label, note: "Practise the two tones together (3 + 3 becomes 2 + 3).", example: "" };
  return { label, note: "", example: "" };
}

async function buildNote(
  supabase: ActionDb,
  userId: string,
  concept: ConceptRow,
): Promise<{ noteTypeId: string; fields: Record<string, unknown> }> {
  switch (concept.type) {
    case "phoneme":
      return { noteTypeId: "zh-phoneme", fields: await phonemeFields(supabase, concept.ref, concept.label) };
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
          english: primaryGloss((ch?.glosses as string[]) ?? []) || concept.gloss || "",
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
          english: primaryGloss((w?.glosses as string[]) ?? []) || concept.gloss || "",
          sentence_zh: sentence?.zh ?? concept.ref,
          sentence_en: sentence?.en ?? primaryGloss((w?.glosses as string[]) ?? []),
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
