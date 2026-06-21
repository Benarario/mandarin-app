// Builds the concept-graph datasets (components, characters, words) from the
// permissive sources, attaching prerequisite edges. Run: npm run etl:graph:build
// (after etl:build, so data/out/dictionary.ndjson exists, and etl:graph:download).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SOURCES, PATHS } from "./sources";

const RAW = PATHS.raw;
const OUT = PATHS.out;
const CJK = /\p{Script=Han}/u;
const isCjkChar = (s: string) => [...s].length === 1 && CJK.test(s);
const cp = (ch: string) => ch.codePointAt(0)!;
const fromHex = (hex: string) => String.fromCodePoint(parseInt(hex, 16));

// ── 1. Unihan: radical number + total strokes + grade level ─────────────────
function parseUnihan() {
  const radical = new Map<string, number>(); // char -> Kangxi radical number
  const strokes = new Map<string, number>();
  const grade = new Map<string, number>();

  const irg = readFileSync(join(RAW, "unihan", "Unihan_IRGSources.txt"), "utf8");
  for (const line of irg.split("\n")) {
    if (line.startsWith("#") || !line) continue;
    const [code, field, value] = line.split("\t");
    if (!code) continue;
    const ch = fromHex(code.replace("U+", ""));
    if (field === "kRSUnicode") {
      // e.g. "38.3" or "120'.3" (apostrophe = simplified radical variant)
      const first = value.split(" ")[0];
      const rad = parseInt(first.split(".")[0].replace("'", ""), 10);
      if (!Number.isNaN(rad)) radical.set(ch, rad);
    } else if (field === "kTotalStrokes") {
      strokes.set(ch, parseInt(value.split(" ")[0], 10));
    }
  }

  const dld = readFileSync(join(RAW, "unihan", "Unihan_DictionaryLikeData.txt"), "utf8");
  for (const line of dld.split("\n")) {
    if (line.startsWith("#") || !line) continue;
    const [code, field, value] = line.split("\t");
    if (field === "kGradeLevel") grade.set(fromHex(code.replace("U+", "")), parseInt(value, 10));
  }
  return { radical, strokes, grade };
}

// ── 2. Components: the 214 radicals, preferring SIMPLIFIED forms (马 not 馬),
// with sourced English glosses. This is a simplified-character app. ──────────
function parseComponents() {
  const radBase = new Map<number, string>(); // traditional / base CJK form
  const radVariant = new Map<number, string>(); // simplified variant (apostrophe rows)
  const kangxiByNum = new Map<number, string>(); // base Kangxi codepoint (for the gloss)
  const formToRadNum = new Map<string, number>(); // ANY radical glyph -> its radical number

  for (const line of readFileSync(join(RAW, "CJKRadicals.txt"), "utf8").split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const [numRaw, kangxiHex, cjkHex] = line.split(";").map((s) => s.trim());
    if (!cjkHex) continue;
    const num = parseInt(numRaw.replace(/'/g, ""), 10);
    const ch = fromHex(cjkHex);
    formToRadNum.set(ch, num);
    if (numRaw.includes("'")) radVariant.set(num, ch);
    else {
      if (!radBase.has(num)) radBase.set(num, ch);
      if (!kangxiByNum.has(num)) kangxiByNum.set(num, kangxiHex);
    }
  }

  // Canonical component form = simplified variant when one exists, else base.
  const radToChar = new Map<number, string>();
  for (const num of new Set([...radBase.keys(), ...radVariant.keys()])) {
    radToChar.set(num, radVariant.get(num) ?? radBase.get(num)!);
  }

  // Gloss per radical number, from the base Kangxi radical name in UnicodeData.
  const kangxiName = new Map<string, string>();
  for (const line of readFileSync(join(RAW, "UnicodeData.txt"), "utf8").split("\n")) {
    if (!line) continue;
    const cols = line.split(";");
    if (cols[1]?.startsWith("KANGXI RADICAL ")) kangxiName.set(cols[0], cols[1]);
  }
  const radNumToGloss = new Map<number, string | null>();
  for (const [num, kangxiHex] of kangxiByNum) {
    const name = kangxiName.get(kangxiHex);
    radNumToGloss.set(num, name ? name.replace("KANGXI RADICAL ", "").toLowerCase() : null);
  }

  const components = [...radToChar.entries()]
    .map(([num, char]) => ({
      char,
      gloss: radNumToGloss.get(num) ?? null,
      radical_number: num,
      source: "Unicode (CJKRadicals.txt + UnicodeData.txt)",
      license: SOURCES.cjkRadicals.license,
    }))
    .sort((a, b) => a.radical_number - b.radical_number);

  return { components, radToChar, formToRadNum };
}

// ── 3. cjk-decomp: character -> CJK-character components ─────────────────────
function parseDecomp() {
  const decomp = new Map<string, string[]>();
  for (const line of readFileSync(join(RAW, "cjk-decomp.txt"), "utf8").split("\n")) {
    const m = line.match(/^(.+?):([a-z]+)\((.*)\)$/);
    if (!m) continue;
    const [, char, , args] = m;
    if (!isCjkChar(char)) continue;
    const parts = args
      .split(",")
      .map((s) => s.trim())
      .filter((s) => isCjkChar(s) && s !== char); // keep only real CJK components
    if (parts.length) decomp.set(char, parts);
  }
  return decomp;
}

// ── 4. Read existing dictionary.ndjson (CC-CEDICT + HSK + freq) ──────────────
interface DictRow {
  simplified: string;
  pinyin: string;
  glosses: string[];
  hsk_30_band: number | null;
  freq_rank: number | null;
  source: string;
  license: string;
}
function readDictionary(): DictRow[] {
  const path = join(OUT, "dictionary.ndjson");
  if (!existsSync(path)) throw new Error("Run `npm run etl:build` first (dictionary.ndjson missing).");
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function main() {
  console.log("parsing Unihan …");
  const { radical, strokes, grade } = parseUnihan();
  console.log("parsing components (Kangxi radicals) …");
  const { components, radToChar, formToRadNum } = parseComponents();
  console.log("parsing decomposition …");
  const decomp = parseDecomp();
  console.log("reading dictionary …");
  const dict = readDictionary();

  // Best (most common) dictionary entry per simplified headword.
  const bestEntry = new Map<string, DictRow>();
  for (const d of dict) {
    const prev = bestEntry.get(d.simplified);
    const a = prev?.freq_rank ?? Number.MAX_SAFE_INTEGER;
    const b = d.freq_rank ?? Number.MAX_SAFE_INTEGER;
    if (!prev || b < a) bestEntry.set(d.simplified, d);
  }

  // ── Words: HSK-tagged multi-character entries (the teaching corpus) ──
  const words = dict
    .filter((d) => [...d.simplified].length > 1 && d.hsk_30_band != null && [...d.simplified].every(isCjkChar))
    .map((d) => ({
      simplified: d.simplified,
      pinyin: d.pinyin,
      glosses: d.glosses,
      character_chars: [...d.simplified],
      hsk_band: d.hsk_30_band,
      freq_rank: d.freq_rank,
      source: d.source,
      license: d.license,
    }));
  // Dedup words by simplified.
  const wordMap = new Map(words.map((w) => [w.simplified, w]));

  // ── Characters: every single-char dict entry + any char inside a word ──
  const charSet = new Set<string>();
  for (const d of dict) if (isCjkChar(d.simplified)) charSet.add(d.simplified);
  for (const w of wordMap.values()) for (const c of w.character_chars) charSet.add(c);

  function componentPrereqs(char: string): string[] {
    const set = new Set<string>();
    const radNum = radical.get(char);
    if (radNum != null && radToChar.has(radNum)) set.add(radToChar.get(radNum)!); // own radical
    for (const comp of decomp.get(char) ?? []) {
      // Normalise any radical form found in the decomposition to its canonical
      // (simplified) component, so 妈 = 女 + 马 picks up 马, not nothing.
      const n = formToRadNum.get(comp);
      if (n != null && radToChar.has(n)) set.add(radToChar.get(n)!);
    }
    set.delete(char); // a radical-character isn't its own prerequisite
    return [...set];
  }

  const characters = [...charSet].map((char) => {
    const d = bestEntry.get(char);
    const radNum = radical.get(char) ?? null;
    return {
      char,
      pinyin: d?.pinyin ?? null,
      glosses: d?.glosses ?? [],
      radical_number: radNum,
      radical_char: radNum != null ? radToChar.get(radNum) ?? null : null,
      stroke_count: strokes.get(char) ?? null,
      grade: grade.get(char) ?? null,
      component_chars: componentPrereqs(char),
      freq_rank: d?.freq_rank ?? null,
      hsk_band: d?.hsk_30_band ?? null,
      decomposition_verified: decomp.has(char),
      verified: Boolean(d), // in CC-CEDICT?
      source: d?.source ?? "Unihan",
      license: d?.license ?? SOURCES.unihan.license,
    };
  });

  writeFileSync(join(OUT, "components.ndjson"), components.map((c) => JSON.stringify(c)).join("\n"));
  writeFileSync(join(OUT, "characters.ndjson"), characters.map((c) => JSON.stringify(c)).join("\n"));
  writeFileSync(join(OUT, "words.ndjson"), [...wordMap.values()].map((w) => JSON.stringify(w)).join("\n"));

  // Update the manifest with the new datasets.
  const manifestPath = join(OUT, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { datasets: {} };
  manifest.datasets.components = { rows: components.length, source: "Unicode CJKRadicals/UnicodeData", license: SOURCES.cjkRadicals.license };
  manifest.datasets.characters = { rows: characters.length, source: "CC-CEDICT + Unihan + cjk-decomp", license: `${SOURCES.unihan.license}; ${SOURCES.cjkDecomp.license}` };
  manifest.datasets.words = { rows: wordMap.size, source: "CC-CEDICT (HSK-tagged)", license: dict[0]?.license ?? "CC BY-SA 4.0" };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const withComp = characters.filter((c) => c.component_chars.length > 0).length;
  console.log("\n✓ graph build complete");
  console.log(`  components: ${components.length} (${components.filter((c) => c.gloss).length} with glosses)`);
  console.log(`  characters: ${characters.length} (${withComp} with component prereqs, ${characters.filter((c) => c.decomposition_verified).length} decomposed)`);
  console.log(`  words:      ${wordMap.size} (HSK-tagged)`);
}

main();
