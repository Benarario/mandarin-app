// Parses raw datasets into clean NDJSON in data/out/, merging HSK band +
// frequency tags onto CC-CEDICT entries by simplified headword.
// Run: npm run etl:build  (after etl:download)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SOURCES, PATHS } from "./sources";
import { numberedToDiacritic } from "../../lib/pinyin/convert";

type DictRow = {
  simplified: string;
  traditional: string;
  pinyin: string;
  pinyin_numbered: string;
  glosses: string[];
  hsk_30_band: number | null;
  hsk_20_level: number | null;
  freq_rank: number | null;
  freq_source: string | null;
  source: string;
  license: string;
};

// ── CC-CEDICT ──────────────────────────────────────────────────────────────
const CEDICT_LINE = /^(\S+)\s(\S+)\s\[([^\]]*)\]\s\/(.*)\/\s*$/;

function parseCedict(): { rows: Omit<DictRow, "hsk_30_band" | "hsk_20_level" | "freq_rank" | "freq_source">[]; license: string } {
  const text = readFileSync(join(PATHS.raw, "cedict.txt"), "utf8");
  let license: string = SOURCES.cedict.licenseFallback;
  const rows: Omit<DictRow, "hsk_30_band" | "hsk_20_level" | "freq_rank" | "freq_source">[] = [];

  for (const line of text.split("\n")) {
    if (line.startsWith("#")) {
      // The header carries the license as plain comment lines, e.g.
      //   # Creative Commons Attribution-ShareAlike 4.0 International License
      //   # https://creativecommons.org/licenses/by-sa/4.0/
      const m = line.match(/creativecommons\.org\/licenses\/([a-z-]+)\/([0-9.]+)/i);
      if (m) {
        const code = m[1].toUpperCase().replace(/-/g, "-"); // by-sa -> BY-SA
        license = `CC ${code} ${m[2]} (https://creativecommons.org/licenses/${m[1]}/${m[2]}/)`;
      }
      continue;
    }
    const m = line.match(CEDICT_LINE);
    if (!m) continue;
    const [, traditional, simplified, pinyinNumbered, gloss] = m;
    rows.push({
      simplified,
      traditional,
      pinyin: numberedToDiacritic(pinyinNumbered),
      pinyin_numbered: pinyinNumbered,
      glosses: gloss.split("/").filter(Boolean),
      source: "CC-CEDICT",
      license,
    });
  }
  return { rows, license };
}

// ── HSK (band / level + frequency) ─────────────────────────────────────────
type HskInfo = { band: number | null; level: number | null; freq: number | null };

function parseHsk(): Map<string, HskInfo> {
  const map = new Map<string, HskInfo>();
  const dir = join(PATHS.raw, "hsk");
  for (const file of readdirSync(dir)) {
    const m = file.match(/^(new|old)-(\d+)\.json$/);
    if (!m) continue;
    const kind = m[1];
    const num = parseInt(m[2], 10);
    const entries = JSON.parse(readFileSync(join(dir, file), "utf8")) as Array<{
      simplified: string;
      frequency?: number;
    }>;
    for (const e of entries) {
      const info = map.get(e.simplified) ?? { band: null, level: null, freq: null };
      if (kind === "new" && (info.band === null || num < info.band)) info.band = num;
      if (kind === "old" && (info.level === null || num < info.level)) info.level = num;
      if (typeof e.frequency === "number" && (info.freq === null || e.frequency < info.freq))
        info.freq = e.frequency;
      map.set(e.simplified, info);
    }
  }
  return map;
}

// ── Tatoeba sentence pairs ─────────────────────────────────────────────────
type SentRow = { zh_text: string; en_text: string; source: string; license: string };

function parseTatoeba(maxChars = 30, cap = 40000): SentRow[] {
  const dir = join(PATHS.raw, "tatoeba");
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt") && !f.startsWith("_"));
  // Prefer the sentence file (cmn.txt); skip the _about.txt metadata file.
  const txt = files.find((f) => /cmn/i.test(f)) ?? files[0];
  if (!txt) return [];
  const text = readFileSync(join(dir, txt), "utf8");
  const seen = new Set<string>();
  const out: SentRow[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (cols.length < 2) continue;
    const en = cols[0].trim();
    const zh = cols[1].trim();
    if (!zh || !en) continue;
    if ([...zh].length > maxChars) continue; // keep short, learner-friendly sentences
    if (seen.has(zh)) continue;
    seen.add(zh);
    out.push({ zh_text: zh, en_text: en, source: SOURCES.tatoeba.name, license: SOURCES.tatoeba.license });
    if (out.length >= cap) break;
  }
  return out;
}

function main() {
  mkdirSync(PATHS.out, { recursive: true });

  console.log("parsing CC-CEDICT …");
  const { rows: cedict, license: cedictLicense } = parseCedict();
  console.log("parsing HSK bands …");
  const hsk = parseHsk();

  const dict: DictRow[] = cedict.map((r) => {
    const info = hsk.get(r.simplified);
    return {
      ...r,
      hsk_30_band: info?.band ?? null,
      hsk_20_level: info?.level ?? null,
      freq_rank: info?.freq ?? null,
      freq_source: info?.freq != null ? SOURCES.hsk.name : null,
    };
  });

  writeFileSync(join(PATHS.out, "dictionary.ndjson"), dict.map((d) => JSON.stringify(d)).join("\n"));

  console.log("parsing Tatoeba sentences …");
  const sents = parseTatoeba();
  writeFileSync(join(PATHS.out, "sentences.ndjson"), sents.map((s) => JSON.stringify(s)).join("\n"));

  const taggedHsk = dict.filter((d) => d.hsk_30_band != null).length;
  const manifest = {
    generated_at: new Date().toISOString(),
    datasets: {
      dictionary: { rows: dict.length, hsk_tagged: taggedHsk, source: "CC-CEDICT", license: cedictLicense },
      hsk: { unique_words: hsk.size, source: SOURCES.hsk.name, license: SOURCES.hsk.license },
      sentences: { rows: sents.length, source: SOURCES.tatoeba.name, license: SOURCES.tatoeba.license },
    },
  };
  writeFileSync(join(PATHS.out, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("\n✓ build complete");
  console.log(`  dictionary: ${dict.length} entries (${taggedHsk} HSK-tagged)`);
  console.log(`  sentences:  ${sents.length}`);
  console.log(`  manifest:   data/out/manifest.json`);
}

main();
