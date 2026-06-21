// Progressive pinyin fading: decide, per character, whether to show pinyin.
// Tied to per-character mastery so the learner is weaned off pinyin as
// recognition strengthens (audio always remains available as a backstop).

export type PinyinMode = "full" | "on_tap" | "new_only" | "none" | "adaptive";

// A character's pinyin may only fade once THAT character is mastered.
// `mastery` here is the per-character concept status (0–5); 4 = familiar.
// This is the fix for "dropped pinyin too fast": pinyin stays visible until the
// learner has genuinely mastered the character, and re-appears if mastery drops.
export const STATUS_MASTERED = 4;
export const STATUS_STRONG = 5;

export interface PinyinDecision {
  /** Show pinyin above the character by default? */
  show: boolean;
  /** Is it revealable on tap (even if hidden by default)? */
  tappable: boolean;
}

/**
 * @param mode    the user's pinyin display preference
 * @param mastery the character's mastery STATUS (0–5); undefined = never seen
 */
export function decidePinyin(
  mode: PinyinMode,
  mastery: number | undefined,
): PinyinDecision {
  const status = mastery ?? 0;
  switch (mode) {
    case "full":
      return { show: true, tappable: true };
    case "none":
      return { show: false, tappable: true };
    case "on_tap":
      return { show: false, tappable: true };
    case "new_only":
      // Show until the character is familiar (status ≥ 4).
      return { show: status < STATUS_MASTERED, tappable: true };
    case "adaptive":
    default:
      // Never hide below "familiar" (status 4); fully drop once "strong" (5).
      // Always tappable so it can be revealed — and re-appears if mastery drops.
      return { show: status < STATUS_MASTERED, tappable: true };
  }
}

/** Split a string into individual Han characters (others passed through). */
const HAN = /\p{Script=Han}/u;
export function isHan(ch: string): boolean {
  return HAN.test(ch);
}
