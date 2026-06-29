import "server-only";
import type { ActionDb } from "@/lib/require-user";
import type { AnnToken } from "@/lib/annotate";

// Global graded reader texts live in the `texts` table (owner = null,
// type = 'reader'), assembled by scripts/etl/build-reader.ts from real Tatoeba
// sentences. The per-line English is genuine sentence translation, not a
// fabricated word-fact; per-word definitions are still looked up live.

export interface ReaderLine {
  zh: string;
  en: string;
  tokens?: AnnToken[]; // precomputed by etl:reader (segmentation + pinyin/gloss)
}

export interface ReaderText {
  id: string;
  title: string;
  level: string;
  topic: string;
  license: string;
  source_url: string;
  type?: string; // 'reader' | 'novel' | 'user' | … (undefined for seed texts)
  seq?: number; // chapter order within a series
  lines: ReaderLine[];
}

interface TextRow {
  id: string;
  title: string;
  type: string;
  language_level: string | null;
  license: string;
  source_url: string | null;
  segmented_json: { lines?: ReaderLine[]; topic?: string; level?: number } | null;
}

const COLS = "id, title, type, language_level, license, source_url, segmented_json";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Long-form reading types are grouped by their series/book title in the picker.
export const SERIES_TYPES = new Set(["novel", "user"]);

function toReaderText(r: TextRow): ReaderText {
  const meta = r.segmented_json ?? {};
  return {
    id: r.id,
    title: r.title,
    level: r.language_level ?? "",
    topic: meta.topic ?? "",
    license: r.license,
    source_url: r.source_url ?? "",
    type: r.type,
    seq: typeof meta.level === "number" ? meta.level : undefined,
    lines: meta.lines ?? [],
  };
}

/** All global reading texts (Tatoeba 'reader' sets + public-domain 'novel' chapters). */
export async function getGlobalReaderTexts(supabase: ActionDb): Promise<ReaderText[]> {
  const { data } = await supabase
    .from("texts")
    .select(COLS)
    .is("owner", null)
    .in("type", ["reader", "novel"]);
  return ((data ?? []) as TextRow[]).map(toReaderText);
}

/** The learner's own imported texts (RLS already restricts to their rows). */
export async function getUserTexts(supabase: ActionDb, userId: string): Promise<ReaderText[]> {
  const { data } = await supabase.from("texts").select(COLS).eq("owner", userId);
  return ((data ?? []) as TextRow[]).map(toReaderText);
}

/** A single reader text by id — own or global (RLS scopes it). */
export async function getReaderText(supabase: ActionDb, id: string): Promise<ReaderText | null> {
  if (!UUID.test(id)) return null; // seed-text ids aren't UUIDs
  const { data } = await supabase.from("texts").select(COLS).eq("id", id).maybeSingle();
  return data ? toReaderText(data as TextRow) : null;
}

/** Chapter ids of a series (same type + book title), in reading order. RLS keeps
 *  this to the learner's own + global rows, so a user book and the PD corpus
 *  never bleed together for different users. */
export async function getSeriesSiblings(
  supabase: ActionDb,
  type: string,
  series: string,
): Promise<{ id: string; seq: number }[]> {
  const { data } = await supabase
    .from("texts")
    .select("id, segmented_json")
    .eq("type", type)
    .eq("segmented_json->>topic", series);
  return ((data ?? []) as { id: string; segmented_json: { level?: number } | null }[])
    .map((r) => ({ id: r.id, seq: typeof r.segmented_json?.level === "number" ? r.segmented_json.level : 0 }))
    .sort((a, b) => a.seq - b.seq);
}
