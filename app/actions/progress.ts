"use server";

import { requireUser } from "@/lib/require-user";
import { getStatusMaps } from "@/lib/graph/mastery";
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
