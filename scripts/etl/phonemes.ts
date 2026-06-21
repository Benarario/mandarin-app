// Stage 0 phonology concepts. These describe the standard Hanyu Pinyin system
// (a phonological reference, not invented word-facts), so they are authored here
// and sourced to "Standard Hanyu Pinyin (GB/T 16159)".

export interface Phoneme {
  id: string;
  kind: "tone" | "initial" | "final" | "tone_pair";
  label: string;
  note?: string;
  prereq_ids?: string[];
  order: number;
}

const TONES: Phoneme[] = [
  { id: "tone1", kind: "tone", label: "Tone 1 — high level (ā)", order: 0 },
  { id: "tone2", kind: "tone", label: "Tone 2 — rising (á)", order: 1 },
  { id: "tone3", kind: "tone", label: "Tone 3 — dipping (ǎ)", order: 2 },
  { id: "tone4", kind: "tone", label: "Tone 4 — falling (à)", order: 3 },
  { id: "tone5", kind: "tone", label: "Neutral tone (a)", order: 4 },
];

const INITIALS = "b p m f d t n l g k h j q x zh ch sh r z c s".split(" ");
const FINALS =
  "a o e i u ü ai ei ao ou an en ang eng ong er ia ie iao iu ian in iang ing iong ua uo uai ui uan un uang ueng üe üan ün".split(
    " ",
  );

// A representative set of two-syllable tone-pair drills (incl. 3-3 sandhi).
const TONE_PAIRS: [number, number][] = [
  [1, 1], [1, 2], [1, 3], [1, 4],
  [2, 1], [2, 2], [2, 3], [2, 4],
  [3, 1], [3, 2], [3, 3], [3, 4],
  [4, 1], [4, 2], [4, 3], [4, 4],
  [1, 5], [2, 5], [3, 5], [4, 5],
];

export function buildPhonemes(): Phoneme[] {
  const out: Phoneme[] = [...TONES];
  let order = 10;
  for (const i of INITIALS)
    out.push({ id: `initial_${i}`, kind: "initial", label: `Initial ${i}-`, order: order++ });
  for (const f of FINALS)
    out.push({ id: `final_${f}`, kind: "final", label: `Final -${f}`, order: order++ });
  order = 200; // tone pairs come after single tones/sounds
  for (const [a, b] of TONE_PAIRS) {
    const note = a === 3 && b === 3 ? "Third-tone sandhi: 3+3 → 2+3" : undefined;
    out.push({
      id: `pair_${a}_${b}`,
      kind: "tone_pair",
      label: `Tone pair ${a}–${b}`,
      note,
      prereq_ids: [`tone${a}`, `tone${b}`],
      order: order++,
    });
  }
  return out;
}

export const PHONEME_SOURCE = "Standard Hanyu Pinyin (GB/T 16159)";
