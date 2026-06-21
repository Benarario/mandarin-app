"use server";

import { requireUser } from "@/lib/require-user";
import { primaryGloss } from "@/lib/dict/gloss";

export interface TonePairExample {
  word: string;
  pinyin: string;
  english: string;
  tones: [number, number];
}

const toneOf = (syllable: string): number => {
  const m = syllable.match(/([1-5])$/);
  return m ? parseInt(m[1], 10) : 5;
};

/**
 * One real, common two-syllable example word per tone pair, taken from CC-CEDICT
 * (so the tones shown are always sourced, never invented). Keyed "t1_t2".
 */
export async function getTonePairExamples(): Promise<Record<string, TonePairExample>> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("dictionary")
    .select("simplified, pinyin, pinyin_numbered, glosses, hsk_30_band, freq_rank")
    .not("hsk_30_band", "is", null)
    .order("freq_rank", { ascending: true, nullsFirst: false })
    .limit(4000);

  const byPair: Record<string, TonePairExample> = {};
  for (const d of (data ?? []) as {
    simplified: string;
    pinyin: string;
    pinyin_numbered: string;
    glosses: string[];
  }[]) {
    if ([...d.simplified].length !== 2) continue;
    const syl = d.pinyin_numbered.trim().split(/\s+/);
    if (syl.length !== 2) continue;
    const t1 = toneOf(syl[0]);
    const t2 = toneOf(syl[1]);
    if (t1 < 1 || t1 > 4) continue; // grid covers tones 1–4 on the first syllable
    const key = `${t1}_${t2}`;
    if (!byPair[key]) {
      byPair[key] = { word: d.simplified, pinyin: d.pinyin, english: primaryGloss(d.glosses), tones: [t1, t2] };
    }
  }
  return byPair;
}
