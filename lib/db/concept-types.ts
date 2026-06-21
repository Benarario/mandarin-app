import type { AnnToken } from "@/lib/annotate";

export type ConceptType = "phoneme" | "component" | "character" | "word";

export interface BreakdownPart {
  text: string; // component char or constituent character
  gloss: string | null;
}

/** One reviewable item in a session (a card belonging to a concept). */
export interface ConceptReviewItem {
  cardId: string;
  conceptId: string;
  conceptType: ConceptType;
  modality: "reading" | "listening" | "speaking" | "writing";
  templateIndex: number;
  isNew: boolean; // first time the learner meets this concept

  front: string;
  back: string;
  frontTokens?: AnnToken[]; // annotated pinyin for the Chinese side
  backTokens?: AnnToken[];

  pinyin: string | null;
  gloss: string | null;
  audioText: string | null; // Chinese text to speak, if any

  // Shown on first introduction (dual-coded teaching): how the unit is built.
  breakdown?: BreakdownPart[];
  // Phoneme-only display.
  label?: string;
  note?: string | null;
}
