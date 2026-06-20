// Downloads raw datasets into data/raw/. Network-only; no Supabase needed.
// Run: npm run etl:download
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SOURCES, PATHS } from "./sources";

async function get(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  mkdirSync(PATHS.raw, { recursive: true });

  // 1) CC-CEDICT (gzip) -> plain text
  console.log("↓ CC-CEDICT …");
  const gz = await get(SOURCES.cedict.url);
  writeFileSync(join(PATHS.raw, "cedict.txt"), gunzipSync(gz));
  console.log("  saved data/raw/cedict.txt");

  // 2) HSK band files (new = HSK 3.0 bands, old = HSK 2.0 levels)
  const hskDir = join(PATHS.raw, "hsk");
  mkdirSync(hskDir, { recursive: true });
  for (const n of SOURCES.hsk.newBands) {
    const buf = await get(`${SOURCES.hsk.baseUrl}/new/${n}.json`);
    writeFileSync(join(hskDir, `new-${n}.json`), buf);
  }
  for (const n of SOURCES.hsk.oldLevels) {
    const buf = await get(`${SOURCES.hsk.baseUrl}/old/${n}.json`);
    writeFileSync(join(hskDir, `old-${n}.json`), buf);
  }
  console.log(`  saved HSK band files to data/raw/hsk/`);

  // 3) Tatoeba zip -> extract cmn.txt
  console.log("↓ Tatoeba sentence pairs …");
  const zipPath = join(PATHS.raw, "cmn-eng.zip");
  writeFileSync(zipPath, await get(SOURCES.tatoeba.url));
  const tatDir = join(PATHS.raw, "tatoeba");
  if (existsSync(tatDir)) rmSync(tatDir, { recursive: true, force: true });
  mkdirSync(tatDir, { recursive: true });
  execFileSync("unzip", ["-o", "-q", zipPath, "-d", tatDir]);
  console.log("  extracted data/raw/tatoeba/");

  console.log("\n✓ download complete");
}

main().catch((e) => {
  console.error("download failed:", e);
  process.exit(1);
});
