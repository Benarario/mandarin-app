"use server";

import { requireUser } from "@/lib/require-user";
import { splitChapters } from "@/lib/reader/chunk";
import { annotateMany } from "@/lib/annotate";

const HAN = /\p{Script=Han}/u;
const CHAPTERS_PER_CALL = 15; // bounded so a long book never exceeds the function timeout
const MAX_CHAPTERS = 2000;
const MAX_LINES_PER_CHAPTER = 1200;

export interface TextImportResult {
  inserted: number; // chapters inserted this call
  lines: number; // lines inserted this call
  total: number; // total chapters detected
  nextFrom: number | null; // pass back to continue, or null when done
}

/**
 * Import a user-supplied text (a novel they have the rights to) into their own
 * reader. Splits into chapters, annotates each line with sourced pinyin/gloss
 * (CC-CEDICT, never invented), and stores private `texts` rows (owner = user).
 * Processed in bounded batches; the client loops with `fromChapter` until done.
 */
export async function importText(
  title: string,
  raw: string,
  fromChapter = 0,
): Promise<TextImportResult> {
  const { supabase, user } = await requireUser();
  const cleanTitle = (title || "").trim().slice(0, 120) || "Untitled";

  const chapters = splitChapters(raw).slice(0, MAX_CHAPTERS);
  const total = chapters.length;
  const batch = chapters.slice(fromChapter, fromChapter + CHAPTERS_PER_CALL);

  let inserted = 0;
  let lines = 0;
  for (let k = 0; k < batch.length; k++) {
    const chapterIndex = fromChapter + k;
    const c = batch[k];
    const zhLines = c.lines.filter((l) => HAN.test(l)).slice(0, MAX_LINES_PER_CHAPTER);
    if (zhLines.length === 0) continue;

    const tokens = await annotateMany(zhLines); // jieba + CC-CEDICT pinyin/gloss
    const linesJson = zhLines.map((zh, j) => ({ zh, en: "", tokens: tokens[j] }));

    const { error } = await supabase.from("texts").insert({
      owner: user.id,
      title: `${cleanTitle} · ${c.title}`,
      type: "user",
      language_level: `第${chapterIndex + 1}章`,
      source_url: "",
      license: "User-provided",
      full_text: zhLines.join("\n"),
      segmented_json: { lines: linesJson, topic: cleanTitle, level: chapterIndex + 1 },
    });
    if (error) continue;
    inserted++;
    lines += zhLines.length;
  }

  const next = fromChapter + CHAPTERS_PER_CALL;
  return { inserted, lines, total, nextFrom: next < total ? next : null };
}
