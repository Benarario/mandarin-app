// Reproducible client-JS measurement for the speed pass. Next 16's
// non-interactive build output omits the per-route size table, so we measure
// the built client chunks directly (raw + gzipped — gzip is the transfer cost).
// Run after a build:  node scripts/perf/bundle-sizes.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const DIR = ".next/static/chunks";
const kb = (n) => (n / 1024).toFixed(1) + " KB";

function jsFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

const files = jsFiles(DIR);
let totalRaw = 0;
let totalGz = 0;
const rows = files.map((f) => {
  const buf = readFileSync(f);
  const raw = statSync(f).size;
  const gz = gzipSync(buf).length;
  totalRaw += raw;
  totalGz += gz;
  const has = (s) => buf.includes(Buffer.from(s));
  const tags = [has("recharts") && "recharts", has("Your progress") && "dashboard-page"].filter(Boolean);
  return { name: f.replace(DIR + "/", ""), raw, gz, tags };
});

rows.sort((a, b) => b.gz - a.gz);
console.log(`Client chunks in ${DIR}: ${files.length} files`);
console.log(`TOTAL  raw ${kb(totalRaw)}  |  gzip ${kb(totalGz)}\n`);
console.log("Largest chunks (gzip):");
for (const r of rows.slice(0, 12)) {
  console.log(`  ${kb(r.gz).padStart(9)} gz  (${kb(r.raw).padStart(9)} raw)  ${r.name}${r.tags.length ? "  ← " + r.tags.join(", ") : ""}`);
}
