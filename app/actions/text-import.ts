"use server";

import { requireUser, type ActionDb } from "@/lib/require-user";
import { splitChapters } from "@/lib/reader/chunk";
import { annotateMany } from "@/lib/annotate";

const HAN = /\p{Script=Han}/u;
const CHAPTERS_PER_CALL = 15; // bounded so a long book never exceeds the function timeout
const MAX_CHAPTERS = 2000;
const MAX_LINES_PER_CHAPTER = 1200;

export interface ChapterInput {
  title: string;
  lines: string[];
}

export interface TextImportResult {
  inserted: number; // chapters inserted this call
  lines: number; // lines inserted this call
  total: number; // total chapters (raw path); echoes input length (chapters path)
  nextFrom: number | null; // pass back to continue, or null when done
}

/** Annotate + insert a batch of chapters as the learner's private reader texts. */
async function storeChapters(
  supabase: ActionDb,
  userId: string,
  bookTitle: string,
  chapters: ChapterInput[],
  startIndex: number,
): Promise<{ inserted: number; lines: number }> {
  let inserted = 0;
  let lines = 0;
  for (let k = 0; k < chapters.length; k++) {
    const chapterIndex = startIndex + k;
    const c = chapters[k];
    const zhLines = c.lines.filter((l) => HAN.test(l)).slice(0, MAX_LINES_PER_CHAPTER);
    if (zhLines.length === 0) continue;

    const tokens = await annotateMany(zhLines); // jieba + CC-CEDICT pinyin/gloss (sourced)
    const linesJson = zhLines.map((zh, j) => ({ zh, en: "", tokens: tokens[j] }));
    const chapterTitle = (c.title || `第${chapterIndex + 1}章`).slice(0, 80);

    const { error } = await supabase.from("texts").insert({
      owner: userId,
      title: `${bookTitle} · ${chapterTitle}`,
      type: "user",
      language_level: `第${chapterIndex + 1}章`,
      source_url: "",
      license: "User-provided",
      full_text: zhLines.join("\n"),
      segmented_json: { lines: linesJson, topic: bookTitle, level: chapterIndex + 1 },
    });
    if (error) continue;
    inserted++;
    lines += zhLines.length;
  }
  return { inserted, lines };
}

/**
 * Import a user-supplied text (a novel they have the rights to). Splits raw text
 * into chapters server-side, processed in bounded batches; the client loops with
 * `fromChapter` until done. pinyin/gloss come from CC-CEDICT — never invented.
 */
export async function importText(title: string, raw: string, fromChapter = 0): Promise<TextImportResult> {
  const { supabase, user } = await requireUser();
  const bookTitle = (title || "").trim().slice(0, 120) || "Untitled";
  const chapters = splitChapters(raw).slice(0, MAX_CHAPTERS);
  const total = chapters.length;
  const batch = chapters.slice(fromChapter, fromChapter + CHAPTERS_PER_CALL);
  const { inserted, lines } = await storeChapters(supabase, user.id, bookTitle, batch, fromChapter);
  const next = fromChapter + CHAPTERS_PER_CALL;
  return { inserted, lines, total, nextFrom: next < total ? next : null };
}

/**
 * Import pre-split chapters (e.g. parsed from an EPUB client-side). The client
 * sends one bounded slice per call with its `startIndex`, tracking pagination.
 */
export async function importChapters(
  title: string,
  chapters: ChapterInput[],
  startIndex = 0,
): Promise<{ inserted: number; lines: number }> {
  const { supabase, user } = await requireUser();
  const bookTitle = (title || "").trim().slice(0, 120) || "Untitled";
  const batch = chapters.slice(0, CHAPTERS_PER_CALL); // guard payload size
  return storeChapters(supabase, user.id, bookTitle, batch, startIndex);
}

/** Remove one of the learner's own imported books (all its chapters). RLS +
 *  the owner filter ensure a user can only ever delete their own texts. */
export async function deleteBook(series: string): Promise<{ deleted: number }> {
  const { supabase, user } = await requireUser();
  if (!series) return { deleted: 0 };
  const { data, error } = await supabase
    .from("texts")
    .delete()
    .eq("owner", user.id)
    .eq("type", "user")
    .eq("segmented_json->>topic", series)
    .select("id");
  if (error) return { deleted: 0 };
  return { deleted: (data ?? []).length };
}
