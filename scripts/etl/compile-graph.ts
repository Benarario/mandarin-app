// Compiles the concept DAG (phonemes → components → characters → words),
// asserts it is acyclic, computes the canonical teaching order, writes
// concepts.ndjson, and prints the first 50 concepts as proof of zero-knowledge
// sequencing. Run: npm run etl:graph:compile  (after etl:graph:build)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "./sources";
import { buildPhonemes } from "./phonemes";

const OUT = PATHS.out;
const read = (f: string) =>
  readFileSync(join(OUT, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

export interface Concept {
  id: string;
  type: "phoneme" | "component" | "character" | "word";
  tier: number;
  ref: string; // the phoneme id / component char / character / word
  label: string;
  gloss: string | null;
  prereq_ids: string[];
  order: number; // canonical teaching order (lower = taught earlier)
}

function main() {
  const components = read("components.ndjson") as {
    char: string;
    gloss: string | null;
    radical_number: number;
  }[];
  const characters = read("characters.ndjson") as {
    char: string;
    pinyin: string | null;
    glosses: string[];
    component_chars: string[];
    freq_rank: number | null;
    hsk_band: number | null;
  }[];
  const words = read("words.ndjson") as {
    simplified: string;
    pinyin: string;
    glosses: string[];
    character_chars: string[];
    hsk_band: number | null;
    freq_rank: number | null;
  }[];

  const charNodeIds = new Set(characters.map((c) => `char:${c.char}`));
  const compNodeIds = new Set(components.map((c) => `comp:${c.char}`));

  // Component teaching order = by frequency of the characters that use them
  // (a component used by very common characters is taught earliest).
  const compBestFreq = new Map<string, number>();
  for (const ch of characters) {
    const f = ch.freq_rank ?? Number.MAX_SAFE_INTEGER;
    for (const comp of ch.component_chars) {
      compBestFreq.set(comp, Math.min(compBestFreq.get(comp) ?? Infinity, f));
    }
  }

  const concepts: Concept[] = [];

  // Tier 0 — phonemes
  for (const p of buildPhonemes()) {
    concepts.push({
      id: `phon:${p.id}`,
      type: "phoneme",
      tier: 0,
      ref: p.id,
      label: p.label,
      gloss: p.note ?? null,
      prereq_ids: (p.prereq_ids ?? []).map((x) => `phon:${x}`),
      order: p.order,
    });
  }

  // Tier 1 — components, ordered by usage frequency then radical number
  const compSorted = [...components].sort((a, b) => {
    const fa = compBestFreq.get(a.char) ?? Infinity;
    const fb = compBestFreq.get(b.char) ?? Infinity;
    return fa - fb || a.radical_number - b.radical_number;
  });
  compSorted.forEach((c, i) => {
    concepts.push({
      id: `comp:${c.char}`,
      type: "component",
      tier: 1,
      ref: c.char,
      label: c.char,
      gloss: c.gloss,
      prereq_ids: [],
      order: i,
    });
  });

  // Tier 2 — characters, ordered by frequency (most common first)
  const charSorted = [...characters].sort(
    (a, b) => (a.freq_rank ?? Infinity) - (b.freq_rank ?? Infinity),
  );
  charSorted.forEach((c, i) => {
    concepts.push({
      id: `char:${c.char}`,
      type: "character",
      tier: 2,
      ref: c.char,
      label: c.char,
      gloss: c.glosses[0] ?? null,
      prereq_ids: c.component_chars.map((x) => `comp:${x}`).filter((id) => compNodeIds.has(id)),
      order: i,
    });
  });

  // Tier 3 — words, ordered by HSK band then frequency
  const wordSorted = [...words].sort(
    (a, b) =>
      (a.hsk_band ?? 99) - (b.hsk_band ?? 99) ||
      (a.freq_rank ?? Infinity) - (b.freq_rank ?? Infinity),
  );
  wordSorted.forEach((w, i) => {
    concepts.push({
      id: `word:${w.simplified}`,
      type: "word",
      tier: 3,
      ref: w.simplified,
      label: w.simplified,
      gloss: w.glosses[0] ?? null,
      prereq_ids: w.character_chars.map((x) => `char:${x}`).filter((id) => charNodeIds.has(id)),
      order: i,
    });
  });

  assertAcyclic(concepts);

  // Canonical teaching order: tier first, then within-tier order. Because every
  // edge points from a lower (tier,order) to a higher one, this is a valid
  // topological order.
  const ordered = [...concepts].sort((a, b) => a.tier - b.tier || a.order - b.order);
  ordered.forEach((c, i) => (c.order = i)); // global teaching-order index

  writeFileSync(join(OUT, "concepts.ndjson"), ordered.map((c) => JSON.stringify(c)).join("\n"));

  // ── Phase A deliverable: prove zero-knowledge sequencing ──
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const pos = new Map(ordered.map((c) => [c.id, c.order]));

  // Hard proof: every prerequisite is taught STRICTLY BEFORE the concept.
  let edges = 0;
  for (const c of ordered) {
    for (const p of c.prereq_ids) {
      const pp = pos.get(p);
      if (pp === undefined) continue;
      if (pp >= c.order) {
        throw new Error(`SEQUENCING VIOLATION: ${c.id} (#${c.order}) taught before prereq ${p} (#${pp})`);
      }
      edges++;
    }
  }

  console.log(`\n✓ concept DAG compiled and verified acyclic`);
  console.log(`✓ verified: all ${edges} prerequisite edges point backwards in teaching order`);
  console.log(`  (nothing is ever taught before its prerequisites — the zero-knowledge guarantee)\n`);
  console.log(`  ${concepts.length} concepts: ` +
    `${concepts.filter((c) => c.type === "phoneme").length} phonemes, ` +
    `${concepts.filter((c) => c.type === "component").length} components, ` +
    `${concepts.filter((c) => c.type === "character").length} characters, ` +
    `${concepts.filter((c) => c.type === "word").length} words`);

  const fmt = (c: Concept) => {
    const label = c.type === "phoneme" ? c.label : c.ref;
    const detail = c.type === "phoneme" ? "" : c.gloss ?? "";
    const prereqs = c.prereq_ids.map((id) => byId.get(id)?.label ?? id).join(" ") || "—";
    return `  #${String(c.order + 1).padStart(5)}  ${c.type.padEnd(10)} ${label.padEnd(28)} ${detail.slice(0, 26).padEnd(27)} ⇐ ${prereqs}`;
  };
  const window = (type: Concept["type"], n: number, title: string) => {
    console.log(`\n${title}`);
    ordered.filter((c) => c.type === type).slice(0, n).forEach((c) => console.log(fmt(c)));
  };

  window("phoneme", 6, "Stage 0 — first sounds (no prerequisites):");
  window("component", 14, "Stage 1 — first components, by how common the characters that use them are:");
  window("character", 16, "Stage 2 — first characters (each shown only after its components):");
  window("word", 12, "Stage 3 — first words (each shown only after its characters):");
}

/** Kahn's algorithm — removes nodes with no unmet prereqs; leftovers = a cycle. */
function assertAcyclic(concepts: Concept[]) {
  const indeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const ids = new Set(concepts.map((c) => c.id));
  for (const c of concepts) indeg.set(c.id, 0);
  for (const c of concepts) {
    for (const p of c.prereq_ids) {
      if (!ids.has(p)) continue; // dangling prereq (filtered earlier) — ignore
      indeg.set(c.id, (indeg.get(c.id) ?? 0) + 1);
      (dependents.get(p) ?? dependents.set(p, []).get(p)!).push(c.id);
    }
  }
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    for (const dep of dependents.get(id) ?? []) {
      indeg.set(dep, indeg.get(dep)! - 1);
      if (indeg.get(dep) === 0) queue.push(dep);
    }
  }
  if (visited !== concepts.length) {
    const inCycle = [...indeg.entries()].filter(([, d]) => d > 0).slice(0, 10).map(([id]) => id);
    throw new Error(
      `CONCEPT GRAPH HAS A CYCLE — ${concepts.length - visited} nodes unresolved. e.g. ${inCycle.join(", ")}`,
    );
  }
}

main();
