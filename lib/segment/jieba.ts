import "server-only";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict";

// One shared Jieba instance (loading the dictionary is relatively expensive).
let instance: Jieba | null = null;
function getJieba(): Jieba {
  if (!instance) instance = Jieba.withDict(dict);
  return instance;
}

const HAN = /\p{Script=Han}/u;

export interface Token {
  text: string;
  isWord: boolean; // true if it contains Chinese characters (worth a lookup)
}

/** Segment Chinese text into tokens, preserving punctuation/whitespace order. */
export function segment(text: string): Token[] {
  const pieces = getJieba().cut(text, false);
  return pieces.map((t) => ({ text: t, isWord: HAN.test(t) }));
}

/** Unique Chinese words in a text (for batch dictionary lookups). */
export function uniqueWords(text: string): string[] {
  const set = new Set<string>();
  for (const t of segment(text)) if (t.isWord) set.add(t.text);
  return [...set];
}
