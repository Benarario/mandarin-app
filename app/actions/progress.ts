"use server";

import { requireUser } from "@/lib/require-user";
import { getStatusMaps } from "@/lib/graph/mastery";
import { primaryGloss } from "@/lib/dict/gloss";
import { visualFor } from "@/lib/visuals/emoji";
import type { Modality } from "@/lib/db/types";

export interface SkillStat {
  modality: Modality;
  known: number; // cards in long-term review for this modality
  band: number; // estimated HSK band (0 if none)
  history: { t: string; band: number }[];
}

const MASTERED = 4;

/**
 * Four-skill stats fed from REAL mastery data: per-modality counts come from the
 * cards in long-term review; the HSK band comes from the HSK levels of the words
 * the learner has actually mastered (never an arbitrary XP heuristic).
 */
export async function getSkillStats(): Promise<{ stats: SkillStat[]; chars: number; words: number; reviews: number }> {
  const { supabase, user } = await requireUser();

  // Total reviews logged — the history FSRS would re-optimise from (see below).
  const { count: reviews } = await supabase
    .from("revlog")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Per-modality "known" = cards that have reached the review state.
  const { data: cards } = await supabase
    .from("cards")
    .select("modality, fsrs_state")
    .eq("user_id", user.id);
  const known: Record<string, number> = { reading: 0, listening: 0, speaking: 0, writing: 0 };
  for (const c of (cards ?? []) as { modality: Modality; fsrs_state: string }[]) {
    if (c.fsrs_state === "review") known[c.modality] = (known[c.modality] ?? 0) + 1;
  }

  // Mastered characters / words, and the HSK bands of mastered words.
  const { char, word } = await getStatusMaps(supabase, user.id);
  const masteredChars = Object.values(char).filter((s) => s >= MASTERED).length;
  const masteredWords = Object.entries(word).filter(([, s]) => s >= MASTERED).map(([w]) => w);

  let band = 0;
  if (masteredWords.length) {
    const { data: wrows } = await supabase
      .from("words")
      .select("hsk_band")
      .in("simplified", masteredWords);
    const counts: Record<number, number> = {};
    for (const r of (wrows ?? []) as { hsk_band: number | null }[])
      if (r.hsk_band != null) counts[r.hsk_band] = (counts[r.hsk_band] ?? 0) + 1;
    // Highest band where at least 3 words are mastered at or below it.
    let cumulative = 0;
    for (let b = 1; b <= 9; b++) {
      cumulative += counts[b] ?? 0;
      if (cumulative >= 3) band = b;
    }
  }

  // History (the trend line) still comes from the accumulating skill_progress rows.
  const { data: sp } = await supabase
    .from("skill_progress")
    .select("modality, history_json")
    .eq("user_id", user.id);
  const history = new Map<string, { t: string; band: number }[]>();
  for (const r of (sp ?? []) as { modality: Modality; history_json: { t: string; band: number }[] }[])
    history.set(r.modality, r.history_json ?? []);

  const order: Modality[] = ["reading", "listening", "speaking", "writing"];
  const stats: SkillStat[] = order.map((m) => ({
    modality: m,
    known: known[m] ?? 0,
    // Reading & typed-writing reflect the real word-mastery band; the others
    // are activity counts until their Phase-2 features (audio, speech) exist.
    band: m === "reading" || m === "writing" ? band : 0,
    history: history.get(m) ?? [],
  }));

  return { stats, chars: masteredChars, words: masteredWords.length, reviews: reviews ?? 0 };
}

export interface MasteredItem {
  conceptId: string; // e.g. "char:你" or "word:我们"
  text: string;
  pinyin: string | null;
  gloss: string | null;
  hskBand: number | null;
  status: number; // 4 = familiar, 5 = strong
  emoji: string | null;
}

export interface MasteredData {
  characters: MasteredItem[];
  words: MasteredItem[];
}

/**
 * The user's mastered concepts (status ≥ 4), split into characters and words,
 * each enriched with verified pinyin + primary gloss + HSK band (all sourced
 * from the characters/words tables, never invented) and an optional emoji.
 */
export async function getMasteredItems(): Promise<MasteredData> {
  const { supabase, user } = await requireUser();
  const { char, word } = await getStatusMaps(supabase, user.id);

  const charEntries = Object.entries(char).filter(([, s]) => s >= MASTERED);
  const wordEntries = Object.entries(word).filter(([, s]) => s >= MASTERED);

  const charRows = charEntries.length
    ? (await supabase
        .from("characters")
        .select("char, pinyin, glosses, hsk_band")
        .in("char", charEntries.map(([r]) => r))).data ?? []
    : [];
  const wordRows = wordEntries.length
    ? (await supabase
        .from("words")
        .select("simplified, pinyin, glosses, hsk_band")
        .in("simplified", wordEntries.map(([r]) => r))).data ?? []
    : [];

  const charFacts = new Map(
    (charRows as { char: string; pinyin: string | null; glosses: string[]; hsk_band: number | null }[]).map((r) => [r.char, r]),
  );
  const wordFacts = new Map(
    (wordRows as { simplified: string; pinyin: string | null; glosses: string[]; hsk_band: number | null }[]).map((r) => [r.simplified, r]),
  );

  const byBandThenText = (a: MasteredItem, b: MasteredItem) =>
    (a.hskBand ?? 99) - (b.hskBand ?? 99) || a.text.localeCompare(b.text);

  const characters: MasteredItem[] = charEntries
    .map(([ref, status]) => {
      const f = charFacts.get(ref);
      return {
        conceptId: `char:${ref}`,
        text: ref,
        pinyin: f?.pinyin ?? null,
        gloss: primaryGloss(f?.glosses ?? []) || null,
        hskBand: f?.hsk_band ?? null,
        status,
        emoji: visualFor(ref),
      };
    })
    .sort(byBandThenText);

  const words: MasteredItem[] = wordEntries
    .map(([ref, status]) => {
      const f = wordFacts.get(ref);
      return {
        conceptId: `word:${ref}`,
        text: ref,
        pinyin: f?.pinyin ?? null,
        gloss: primaryGloss(f?.glosses ?? []) || null,
        hskBand: f?.hsk_band ?? null,
        status,
        emoji: visualFor(ref),
      };
    })
    .sort(byBandThenText);

  return { characters, words };
}

/**
 * Reset a mastered concept so it no longer counts as known and drops out of
 * study: status → 0 (the row is kept, never hard-deleted) and its cards are
 * suspended. Reversible — the concept can be re-learned later. Only ever
 * touches the current user's own rows.
 */
export async function removeMastered(conceptId: string): Promise<{ ok: boolean }> {
  if (!conceptId) return { ok: false };
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("concept_progress")
    .update({ status: 0, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("concept_id", conceptId);
  if (error) return { ok: false };

  await supabase
    .from("cards")
    .update({ suspended: true })
    .eq("user_id", user.id)
    .eq("concept_id", conceptId);

  return { ok: true };
}
