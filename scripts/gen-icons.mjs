// Generates PWA icons from a simple geometric SVG (no text => no font needed).
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// `inset` = fraction of padding around the motif (maskable needs a safe zone).
function svg(inset = 0) {
  const pad = Math.round(512 * inset);
  const s = 512 - pad * 2;
  return `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ea580c"/>
      <stop offset="1" stop-color="#c2410c"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${Math.round(512 * 0.22)}" fill="url(#bg)"/>
  <g transform="translate(${pad},${pad})">
    <!-- speech bubble (a language app) -->
    <rect x="${s * 0.2}" y="${s * 0.24}" width="${s * 0.6}" height="${s * 0.42}" rx="${s * 0.1}" fill="#fffaf3"/>
    <path d="M ${s * 0.38} ${s * 0.66} L ${s * 0.5} ${s * 0.66} L ${s * 0.4} ${s * 0.8} Z" fill="#fffaf3"/>
    <!-- three "lines of text" + a tone-mark dot -->
    <rect x="${s * 0.3}" y="${s * 0.36}" width="${s * 0.4}" height="${s * 0.05}" rx="${s * 0.025}" fill="#c2410c"/>
    <rect x="${s * 0.3}" y="${s * 0.47}" width="${s * 0.28}" height="${s * 0.05}" rx="${s * 0.025}" fill="#ea580c"/>
    <circle cx="${s * 0.66}" cy="${s * 0.495}" r="${s * 0.035}" fill="#0f766e"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const targets = [
    { name: "icon-192.png", size: 192, inset: 0 },
    { name: "icon-512.png", size: 512, inset: 0 },
    { name: "maskable-512.png", size: 512, inset: 0.12 },
    { name: "apple-touch-icon.png", size: 180, inset: 0 },
  ];
  for (const t of targets) {
    await sharp(Buffer.from(svg(t.inset)))
      .resize(t.size, t.size)
      .png()
      .toFile(join(outDir, t.name));
    console.log("wrote", t.name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
