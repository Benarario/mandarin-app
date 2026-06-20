import "server-only";
import { segment } from "@/lib/segment/jieba";
import { lookupMany } from "@/lib/dict/lookup";

export interface AnnToken {
  text: string;
  isWord: boolean;
  pinyin?: string; // verified CC-CEDICT reading (word-level, space-separated syllables)
  gloss?: string; // first verified gloss
}

/** Segment Chinese text and attach verified pinyin + gloss to each word. */
export async function annotate(text: string): Promise<AnnToken[]> {
  const tokens = segment(text);
  const words = tokens.filter((t) => t.isWord).map((t) => t.text);
  const dict = await lookupMany(words);
  return tokens.map((t) => {
    const entry = t.isWord ? dict.get(t.text) : undefined;
    return entry
      ? { text: t.text, isWord: true, pinyin: entry.pinyin, gloss: entry.glosses[0] }
      : { text: t.text, isWord: t.isWord };
  });
}

/** Annotate many strings with a single batched dictionary lookup. */
export async function annotateMany(texts: string[]): Promise<AnnToken[][]> {
  const segmented = texts.map((t) => segment(t));
  const words = new Set<string>();
  for (const toks of segmented) for (const t of toks) if (t.isWord) words.add(t.text);
  const dict = await lookupMany([...words]);
  return segmented.map((toks) =>
    toks.map((t) => {
      const entry = t.isWord ? dict.get(t.text) : undefined;
      return entry
        ? { text: t.text, isWord: true, pinyin: entry.pinyin, gloss: entry.glosses[0] }
        : { text: t.text, isWord: t.isWord };
    }),
  );
}
