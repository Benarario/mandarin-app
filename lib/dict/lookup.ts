import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DictionaryRow } from "@/lib/db/types";

// All definitions/pinyin come ONLY from CC-CEDICT via these helpers — nothing
// in the app ever generates or guesses a Chinese-language fact.

/** All dictionary entries for an exact simplified headword (most common first). */
export async function lookupExact(simplified: string): Promise<DictionaryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dictionary")
    .select("*")
    .eq("simplified", simplified)
    .order("freq_rank", { ascending: true, nullsFirst: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as DictionaryRow[];
}

/** Best single entry for a word (lowest freq rank = most common), or null. */
export async function lookupBest(simplified: string): Promise<DictionaryRow | null> {
  const rows = await lookupExact(simplified);
  return rows[0] ?? null;
}

/** Batch lookup: map of simplified -> best entry, for a list of words. */
export async function lookupMany(
  words: string[],
): Promise<Map<string, DictionaryRow>> {
  const result = new Map<string, DictionaryRow>();
  if (words.length === 0) return result;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dictionary")
    .select("*")
    .in("simplified", [...new Set(words)]);
  if (error) throw error;
  for (const row of (data ?? []) as DictionaryRow[]) {
    const existing = result.get(row.simplified);
    // Keep the most common reading (lowest freq rank, nulls last).
    if (!existing) {
      result.set(row.simplified, row);
    } else {
      const a = existing.freq_rank ?? Number.MAX_SAFE_INTEGER;
      const b = row.freq_rank ?? Number.MAX_SAFE_INTEGER;
      if (b < a) result.set(row.simplified, row);
    }
  }
  return result;
}

/**
 * Verify a (hanzi, pinyin) pair against CC-CEDICT — the anti-fabrication gate
 * used when importing or mining cards. Returns the matched dictionary entry if
 * the hanzi exists (and, when pinyin is supplied, the reading matches).
 */
export async function verifyAgainstDictionary(
  simplified: string,
  pinyinNumbered?: string,
): Promise<{ verified: boolean; entry: DictionaryRow | null }> {
  const rows = await lookupExact(simplified);
  if (rows.length === 0) return { verified: false, entry: null };
  if (!pinyinNumbered) return { verified: true, entry: rows[0] };
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const match = rows.find((r) => norm(r.pinyin_numbered) === norm(pinyinNumbered));
  return { verified: Boolean(match), entry: match ?? rows[0] };
}
