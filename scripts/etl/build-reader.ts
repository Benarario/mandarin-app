// Build a graded reader from real Tatoeba sentences (CC BY 2.0), already loaded
// in the `sentences` table. Sentences are levelled by the HSK band of their
// hardest word and grouped by topic, then assembled into short reading sets and
// written to the `texts` table as global rows (owner = null, type = 'reader').
//
// NO FABRICATION: every line is a real sentence + its real human translation;
// nothing is generated. Run: npm run etl:reader
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict";
import { TOPICS } from "../../lib/topics";

loadEnv({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const jieba = Jieba.withDict(dict);
const HAN = /\p{Script=Han}/u;
const hanWords = (text: string) => jieba.cut(text, false).filter((t) => HAN.test(t));
// Full segmentation (words + punctuation in order) — cached so the reader never
// runs jieba live for a passage. Matches lib/annotate.ts AnnToken shape.
const tokenize = (text: string) => jieba.cut(text, false).map((t) => ({ text: t, isWord: HAN.test(t) }));

const MAX_LEVEL = 6; // build beginner→intermediate sets (HSK 1–6)
const LINES_PER_SET = 12;
const MIN_LINES = 6;

const GENERAL = { id: "everyday", name: "Everyday", icon: "📄", members: [] as string[] };

interface Line {
  zh: string;
  en: string;
}

/** Fetch every row of a table in 1000-row pages (PostgREST caps page size). */
async function fetchAll<T>(table: string, columns: string, build: (q: any) => any = (q) => q): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(supabase.from(table).select(columns)).range(from, from + page - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

/** The HSK band of a sentence = its hardest word; null if any word is untagged. */
function levelOf(words: string[], hsk: Map<string, number>): number | null {
  if (words.length === 0) return null;
  let max = 0;
  for (const w of words) {
    const b = hsk.get(w);
    if (b == null) return null; // contains out-of-HSK vocab → out of graded scope
    if (b > max) max = b;
  }
  return max;
}

function topicOf(zh: string): { id: string; name: string; icon: string; members: string[] } {
  for (const t of TOPICS) if (t.members.some((m) => zh.includes(m))) return t;
  return GENERAL;
}

async function main() {
  console.log("Loading HSK bands from dictionary …");
  const dictRows = await fetchAll<{ simplified: string; hsk_30_band: number | null }>(
    "dictionary",
    "simplified, hsk_30_band",
    (q) => q.not("hsk_30_band", "is", null),
  );
  const hsk = new Map<string, number>();
  for (const r of dictRows) if (r.hsk_30_band != null) hsk.set(r.simplified, r.hsk_30_band);
  console.log(`  ${hsk.size} HSK-tagged words`);

  console.log("Loading Tatoeba sentences …");
  const sentences = await fetchAll<{ zh_text: string; en_text: string | null; license: string }>(
    "sentences",
    "zh_text, en_text, license",
    (q) => q.not("en_text", "is", null),
  );
  console.log(`  ${sentences.length} sentences`);

  // Bucket sentences by `${level}|${topicId}`.
  const buckets = new Map<string, { level: number; topic: typeof GENERAL; lines: Line[]; seen: Set<string> }>();
  let license = "CC BY 2.0 FR (Tatoeba.org)";
  for (const s of sentences) {
    if (!s.en_text) continue;
    if (s.license) license = s.license;
    const level = levelOf(hanWords(s.zh_text), hsk);
    if (level == null || level < 1 || level > MAX_LEVEL) continue;
    const topic = topicOf(s.zh_text);
    const key = `${level}|${topic.id}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { level, topic, lines: [], seen: new Set() }));
    if (b.seen.has(s.zh_text)) continue;
    b.seen.add(s.zh_text);
    b.lines.push({ zh: s.zh_text, en: s.en_text });
  }

  // Pick one reading set per non-trivial bucket (shortest sentences first).
  const sets: { level: number; topic: typeof GENERAL; lines: Line[] }[] = [];
  for (const b of buckets.values()) {
    if (b.lines.length < MIN_LINES) continue;
    sets.push({
      level: b.level,
      topic: b.topic,
      lines: [...b.lines].sort((x, y) => [...x.zh].length - [...y.zh].length).slice(0, LINES_PER_SET),
    });
  }

  // Precompute annotation (jieba segmentation + CC-CEDICT pinyin/gloss) once, so
  // the reader serves cached tokens and never runs jieba/dict live for passages.
  const tokenized = new Map<string, { text: string; isWord: boolean }[]>();
  const words = new Set<string>();
  for (const s of sets)
    for (const l of s.lines)
      if (!tokenized.has(l.zh)) {
        const toks = tokenize(l.zh);
        tokenized.set(l.zh, toks);
        for (const t of toks) if (t.isWord) words.add(t.text);
      }

  const best = new Map<string, { pinyin: string | null; gloss?: string; rank: number }>();
  const wordList = [...words];
  for (let i = 0; i < wordList.length; i += 400) {
    const { data } = await supabase
      .from("dictionary")
      .select("simplified, pinyin, glosses, freq_rank")
      .in("simplified", wordList.slice(i, i + 400));
    for (const d of (data ?? []) as { simplified: string; pinyin: string | null; glosses: string[] | null; freq_rank: number | null }[]) {
      const rank = d.freq_rank ?? Number.MAX_SAFE_INTEGER;
      const ex = best.get(d.simplified);
      if (!ex || rank < ex.rank) best.set(d.simplified, { pinyin: d.pinyin, gloss: d.glosses?.[0], rank });
    }
  }

  const annotate = (zh: string) =>
    tokenized.get(zh)!.map((t) => {
      if (!t.isWord) return { text: t.text, isWord: false };
      const b = best.get(t.text);
      const tok: { text: string; isWord: true; pinyin?: string; gloss?: string } = { text: t.text, isWord: true };
      if (b?.pinyin) tok.pinyin = b.pinyin;
      if (b?.gloss) tok.gloss = b.gloss;
      return tok;
    });

  const rows: Record<string, unknown>[] = sets.map((s) => {
    const lines = s.lines.map((l) => ({ zh: l.zh, en: l.en, tokens: annotate(l.zh) }));
    return {
      owner: null,
      title: `${s.topic.icon} ${s.topic.name} · HSK ${s.level}`,
      type: "reader",
      language_level: `HSK ${s.level}`,
      source_url: "https://tatoeba.org/",
      license,
      full_text: lines.map((l) => l.zh).join("\n"),
      segmented_json: { lines, topic: s.topic.name, level: s.level },
    };
  });
  rows.sort((a, b) =>
    String(a.language_level).localeCompare(String(b.language_level)) ||
    String(a.title).localeCompare(String(b.title)),
  );
  console.log(`Built ${rows.length} graded reader sets (annotated ${words.size} unique words).`);

  // Replace the existing global reader seeds (idempotent re-runs).
  console.log("Clearing old global reader texts …");
  const { error: delErr } = await supabase.from("texts").delete().is("owner", null).eq("type", "reader");
  if (delErr) throw delErr;

  console.log("Inserting …");
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("texts").insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
  console.log(`Done. ${rows.length} reader texts loaded.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
