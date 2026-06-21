// Sentence-aware explanation: fixes "translated each word in isolation" by
// framing a word's meaning within its sentence, plus concise usage notes for
// high-frequency function/grammar words.
//
// These function-word notes describe standard, widely-documented grammatical
// usage (the same usage CC-CEDICT encodes in its glosses, e.g. 了 "(completed
// action marker)"). Fuller grammar points with Chinese-Grammar-Wiki citations
// arrive with the grammar tier. The genuinely sentence-disambiguating layer
// (which sense applies HERE) is the optional RAG-LLM path in ./llm.ts.

export const FUNCTION_NOTES: Record<string, string> = {
  了: "marks a completed action or a change of state",
  的: "links a modifier to a noun (often possessive, like “’s”)",
  是: "“to be” — links two nouns (A 是 B = “A is B”)",
  在: "“at/in”, or marks an action happening right now",
  不: "negates verbs and adjectives (“not”)",
  没: "negates 有 or past actions (“didn’t / haven’t”)",
  吗: "turns a statement into a yes/no question",
  呢: "softens a question or asks “and …?”",
  吧: "softens a sentence into a suggestion or guess",
  把: "moves the object before the verb to stress what happens to it",
  被: "marks the passive (“by”)",
  和: "“and”, joining two nouns",
  也: "“also / too”",
  都: "“all / both”",
  很: "“very”; also just links an adjective (很好 = “good”)",
  太: "“too (much)”",
  会: "“will” (likely) or “can” (a learned skill)",
  要: "“want / need / will”",
  想: "“want to / would like”, or “to think / miss”",
  能: "“can / be able to”",
  可以: "“may / can” (permission or possibility)",
  过: "marks a past experience (“have done before”)",
  着: "marks an ongoing state",
  就: "“then / right away / only”",
  才: "“only then / not until”",
  还: "“still / also / in addition”",
  给: "“to / for (someone)”",
  让: "“let / make (someone do something)”",
  得: "links a verb to how it’s done (degree complement)",
  地: "turns a word into an adverb (links it to a verb)",
  比: "“compared to” (A 比 B … = “A is more … than B”)",
  因为: "“because”",
  所以: "“so / therefore”",
  但是: "“but”",
  如果: "“if”",
  已经: "“already”",
  正在: "marks an action in progress right now",
  这: "“this / these”",
  那: "“that / those”",
  什么: "“what”",
  怎么: "“how / why”",
};

export interface WordExplanation {
  /** The best dictionary meaning to show for this word. */
  meaning: string;
  /** A usage note when the word is a known function/grammar word. */
  functionNote: string | null;
  /** The full sentence's meaning, so the word is never explained in isolation. */
  sentenceMeaning: string | null;
}

export function explainInContext(
  word: string,
  meaning: string,
  sentenceMeaning: string | null,
): WordExplanation {
  return {
    meaning,
    functionNote: FUNCTION_NOTES[word] ?? null,
    sentenceMeaning,
  };
}
