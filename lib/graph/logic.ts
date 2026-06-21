// Pure, framework-free graph + gating logic. No DB, no server-only imports, so
// it is fully unit-testable. The DB-backed authority (gate.ts) wraps these.

/** Mastery status at which a concept counts as a satisfied prerequisite. */
export const MASTERED = 4;

export interface ConceptNode {
  id: string;
  type: "phoneme" | "component" | "character" | "word" | "grammar" | "topic";
  ref: string;
  tier: number;
  prereq_ids: string[];
  teaching_order: number;
}

/** A concept is unlocked iff every prerequisite is mastered (status ≥ 4). */
export function isConceptUnlocked(prereqIds: string[], mastered: ReadonlySet<string>): boolean {
  return prereqIds.every((p) => mastered.has(p));
}

/**
 * The next `n` concepts to teach: the earliest (by teaching order) concepts that
 * are unlocked but not yet introduced. `concepts` MUST be sorted by teaching_order.
 */
export function pickNextConcepts(
  concepts: ConceptNode[],
  mastered: ReadonlySet<string>,
  introduced: ReadonlySet<string>,
  n: number,
): ConceptNode[] {
  const out: ConceptNode[] = [];
  for (const c of concepts) {
    if (introduced.has(c.id)) continue;
    if (isConceptUnlocked(c.prereq_ids, mastered)) {
      out.push(c);
      if (out.length >= n) break;
    }
  }
  return out;
}

export interface GateOptions {
  /** Reader/i+1 mode: a word is OK if every character in it is taught. */
  allowCharsOfWord?: boolean;
}

/**
 * Returns the tokens that have NOT been taught. `allowed` is the learner's
 * taught vocabulary (characters + words). This is the enforcement core of the
 * "never present, quiz, or ask about anything untaught" invariant.
 */
export function findUntaughtTokens(
  tokens: string[],
  allowed: ReadonlySet<string>,
  opts: GateOptions = {},
): string[] {
  const offending: string[] = [];
  for (const tok of tokens) {
    if (allowed.has(tok)) continue;
    if (opts.allowCharsOfWord && [...tok].every((ch) => allowed.has(ch))) continue;
    offending.push(tok);
  }
  return offending;
}
