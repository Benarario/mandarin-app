// Derives a concept's mastery status from its FSRS card(s). Status drives both
// the prerequisite gate (≥4 = mastered) and pinyin fading. The SRS engine you
// already have *drives* mastery rather than being bolted on (spec §6C).
//
//   0 unknown · 1-3 learning · 4 familiar · 5 strong · 98 ignored · 99 well-known

import type { DbCardState } from "@/lib/srs/fsrs";

/** A card is "strong" once it survives this many days of stability in review. */
export const STRONG_STABILITY_DAYS = 21;

export interface CardStatusInput {
  fsrs_state: DbCardState;
  fsrs_stability: number | null;
}

/** Map a single card's FSRS state to a 1–5 mastery status. */
export function statusFromCard(card: CardStatusInput): number {
  switch (card.fsrs_state) {
    case "new":
      return 1; // introduced, not yet practised
    case "learning":
      return 2;
    case "relearning":
      return 3; // lapsed — actively being relearned (drops below mastered)
    case "review":
      return (card.fsrs_stability ?? 0) >= STRONG_STABILITY_DAYS ? 5 : 4;
    default:
      return 1;
  }
}

/**
 * A concept's status is the WEAKEST of its cards (e.g. a character is only
 * "strong" when both its recognition and production cards are strong).
 */
export function statusFromCards(cards: CardStatusInput[]): number {
  if (cards.length === 0) return 0;
  return Math.min(...cards.map(statusFromCard));
}
