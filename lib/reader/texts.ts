import "server-only";
import type { ActionDb } from "@/lib/require-user";

// Global graded reader texts live in the `texts` table (owner = null,
// type = 'reader'), assembled by scripts/etl/build-reader.ts from real Tatoeba
// sentences. The per-line English is genuine sentence translation, not a
// fabricated word-fact; per-word definitions are still looked up live.

export interface ReaderLine {
  zh: string;
  en: string;
}

export interface ReaderText {
  id: string;
  title: string;
  level: string;
  topic: string;
  license: string;
  source_url: string;
  lines: ReaderLine[];
}

interface TextRow {
  id: string;
  title: string;
  language_level: string | null;
  license: string;
  source_url: string | null;
  segmented_json: { lines?: ReaderLine[]; topic?: string } | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toReaderText(r: TextRow): ReaderText {
  const meta = r.segmented_json ?? {};
  return {
    id: r.id,
    title: r.title,
    level: r.language_level ?? "",
    topic: meta.topic ?? "",
    license: r.license,
    source_url: r.source_url ?? "",
    lines: meta.lines ?? [],
  };
}

/** All global graded reader texts (for the picker). */
export async function getGlobalReaderTexts(supabase: ActionDb): Promise<ReaderText[]> {
  const { data } = await supabase
    .from("texts")
    .select("id, title, language_level, license, source_url, segmented_json")
    .is("owner", null)
    .eq("type", "reader");
  return ((data ?? []) as TextRow[]).map(toReaderText);
}

/** A single global reader text by id (null if the id isn't a DB text). */
export async function getReaderText(supabase: ActionDb, id: string): Promise<ReaderText | null> {
  if (!UUID.test(id)) return null; // seed-text ids aren't UUIDs
  const { data } = await supabase
    .from("texts")
    .select("id, title, language_level, license, source_url, segmented_json")
    .eq("id", id)
    .is("owner", null)
    .maybeSingle();
  return data ? toReaderText(data as TextRow) : null;
}
