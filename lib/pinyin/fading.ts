// Progressive pinyin fading: decide, per character, whether to show pinyin.
// Tied to per-character mastery so the learner is weaned off pinyin as
// recognition strengthens (audio always remains available as a backstop).

export type PinyinMode = "full" | "on_tap" | "new_only" | "none" | "adaptive";

// Mastery score crosses this threshold => character is "known" enough to hide.
export const MASTERY_HIDE_THRESHOLD = 3;

export interface PinyinDecision {
  /** Show pinyin above the character by default? */
  show: boolean;
  /** Is it revealable on tap (even if hidden by default)? */
  tappable: boolean;
}

/**
 * @param mode      the user's pinyin display preference
 * @param mastery   per-character mastery score (0 if unseen); undefined = unknown
 */
export function decidePinyin(
  mode: PinyinMode,
  mastery: number | undefined,
): PinyinDecision {
  switch (mode) {
    case "full":
      return { show: true, tappable: true };
    case "none":
      return { show: false, tappable: true };
    case "on_tap":
      return { show: false, tappable: true };
    case "new_only":
      return { show: (mastery ?? 0) < MASTERY_HIDE_THRESHOLD, tappable: true };
    case "adaptive":
    default:
      // Hide once the character is mastered; re-show if mastery is low again.
      return { show: (mastery ?? 0) < MASTERY_HIDE_THRESHOLD, tappable: true };
  }
}

/** Split a string into individual Han characters (others passed through). */
const HAN = /\p{Script=Han}/u;
export function isHan(ch: string): boolean {
  return HAN.test(ch);
}
