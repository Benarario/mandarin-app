// Downloads the v2 concept-graph datasets into data/raw/.
// Network-only; no Supabase needed. Run: npm run etl:graph:download
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SOURCES, PATHS } from "./sources";

async function get(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  mkdirSync(PATHS.raw, { recursive: true });

  // 1) Unihan.zip → extract only the files we use.
  console.log("↓ Unihan …");
  const zipPath = join(PATHS.raw, "Unihan.zip");
  writeFileSync(zipPath, await get(SOURCES.unihan.url));
  const unihanDir = join(PATHS.raw, "unihan");
  if (existsSync(unihanDir)) rmSync(unihanDir, { recursive: true, force: true });
  mkdirSync(unihanDir, { recursive: true });
  execFileSync("unzip", ["-o", "-q", zipPath, ...SOURCES.unihan.files, "-d", unihanDir]);
  console.log(`  extracted ${SOURCES.unihan.files.length} Unihan files`);

  // 2) Unicode radical mapping + names.
  console.log("↓ CJKRadicals.txt + UnicodeData.txt …");
  writeFileSync(join(PATHS.raw, "CJKRadicals.txt"), await get(SOURCES.cjkRadicals.url));
  writeFileSync(join(PATHS.raw, "UnicodeData.txt"), await get(SOURCES.unicodeData.url));

  // 3) Character decomposition (Apache-2.0).
  console.log("↓ cjk-decomp.txt …");
  writeFileSync(join(PATHS.raw, "cjk-decomp.txt"), await get(SOURCES.cjkDecomp.url));

  console.log("\n✓ graph dataset download complete");
}

main().catch((e) => {
  console.error("graph download failed:", e);
  process.exit(1);
});
