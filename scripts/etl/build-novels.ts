// Build a graded reader from public-domain / permissively-licensed long texts.
// Drop UTF-8 .txt files (optionally with a <name>.meta.json giving title/license/
// source_url) into scripts/etl/novels/ (or set NOVELS_DIR), then run this. Each
// text is split into chapters; each chapter becomes a global `texts` row
// (owner=null, type='novel') with sourced pinyin/gloss tokens precomputed.
//
// LICENSING: only add texts you may legally redistribute (public domain or a
// compatible CC licence). The per-text licence + source_url are shown in-app.
// Run: npm run etl:novels
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict";
import { splitChapters } from "../../lib/reader/chunk";

loadEnv({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const jieba = Jieba.withDict(dict);
const HAN = /\p{Script=Han}/u;
const NOVELS_DIR = process.env.NOVELS_DIR || join(__dirname, "novels");
const tokenize = (text: string) => jieba.cut(text, false).map((t) => ({ text: t, isWord: HAN.test(t) }));

interface Meta {
  title: string;
  license: string;
  source_url: string;
}
function metaFor(dir: string, file: string): Meta {
  const base = basename(file, ".txt");
  const metaPath = join(dir, `${base}.meta.json`);
  const fallback: Meta = { title: base, license: "Public domain", source_url: "" };
  if (!existsSync(metaPath)) return fallback;
  try {
    return { ...fallback, ...JSON.parse(readFileSync(metaPath, "utf8")) };
  } catch {
    return fallback;
  }
}

async function main() {
  if (!existsSync(NOVELS_DIR)) {
    console.error(`No novels dir at ${NOVELS_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(NOVELS_DIR).filter((f) => f.endsWith(".txt"));
  console.log(`Loading ${files.length} text(s) from ${NOVELS_DIR}`);

  // Parse + chapter-split everything; collect all words for one batched dict load.
  type Ch = { meta: Meta; title: string; seq: number; lines: string[]; toks: { text: string; isWord: boolean }[][] };
  const chapters: Ch[] = [];
  const words = new Set<string>();
  for (const file of files) {
    const meta = metaFor(NOVELS_DIR, file);
    const raw = readFileSync(join(NOVELS_DIR, file), "utf8");
    splitChapters(raw).forEach((c, i) => {
      const lines = c.lines.filter((l) => HAN.test(l));
      if (lines.length === 0) return;
      const toks = lines.map(tokenize);
      for (const t of toks) for (const w of t) if (w.isWord) words.add(w.text);
      chapters.push({ meta, title: c.title, seq: i + 1, lines, toks });
    });
  }
  console.log(`  ${chapters.length} chapters, ${words.size} unique words`);

  // Load best CC-CEDICT reading + HSK band per word.
  const best = new Map<string, { pinyin: string | null; gloss?: string; hsk: number | null; rank: number }>();
  const list = [...words];
  for (let i = 0; i < list.length; i += 400) {
    const { data } = await supabase
      .from("dictionary")
      .select("simplified, pinyin, glosses, hsk_30_band, freq_rank")
      .in("simplified", list.slice(i, i + 400));
    for (const d of (data ?? []) as { simplified: string; pinyin: string | null; glosses: string[] | null; hsk_30_band: number | null; freq_rank: number | null }[]) {
      const rank = d.freq_rank ?? Number.MAX_SAFE_INTEGER;
      const ex = best.get(d.simplified);
      if (!ex || rank < ex.rank) best.set(d.simplified, { pinyin: d.pinyin, gloss: d.glosses?.[0], hsk: d.hsk_30_band, rank });
    }
  }

  const rows = chapters.map((ch) => {
    let maxBand = 0;
    const lines = ch.lines.map((zh, j) => ({
      zh,
      en: "",
      tokens: ch.toks[j].map((t) => {
        if (!t.isWord) return { text: t.text, isWord: false };
        const b = best.get(t.text);
        if (b?.hsk && b.hsk > maxBand) maxBand = b.hsk;
        const tok: { text: string; isWord: true; pinyin?: string; gloss?: string } = { text: t.text, isWord: true };
        if (b?.pinyin) tok.pinyin = b.pinyin;
        if (b?.gloss) tok.gloss = b.gloss;
        return tok;
      }),
    }));
    return {
      owner: null,
      title: `${ch.meta.title} · ${ch.title}`,
      type: "novel",
      language_level: maxBand ? `HSK ${maxBand}` : "",
      source_url: ch.meta.source_url || null,
      license: ch.meta.license,
      full_text: ch.lines.join("\n"),
      segmented_json: { lines, topic: ch.meta.title, level: ch.seq },
    };
  });

  console.log("Clearing old global novel chapters …");
  const { error: delErr } = await supabase.from("texts").delete().is("owner", null).eq("type", "novel");
  if (delErr) throw delErr;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("texts").insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
  console.log(`Done. ${rows.length} novel chapters loaded.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
