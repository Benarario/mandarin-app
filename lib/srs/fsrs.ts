// FSRS scheduling wrapper around ts-fsrs (MIT). ts-fsrs tracks the same fsrs-rs
// crate Anki depends on, so this gives us Anki-equivalent scheduling under a
// permissive license. We translate between our database card rows and ts-fsrs.
import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
} from "ts-fsrs";

export type DbCardState = "new" | "learning" | "review" | "relearning";

/** Rating buttons — identical mapping to Anki. */
export const RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const;
export type RatingValue = (typeof RATING)[keyof typeof RATING];

const DB_TO_STATE: Record<DbCardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};
const STATE_TO_DB: Record<State, DbCardState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

/** The subset of card columns FSRS reads/writes. */
export interface SchedulerCardFields {
  fsrs_state: DbCardState;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  learning_step: number;
  due_at: string;
  last_reviewed_at: string | null;
  reps: number;
  lapses: number;
  scheduled_days: number;
  elapsed_days: number;
}

// Schedulers are cheap but we memoise per desired-retention value.
const cache = new Map<number, FSRS>();
export function getScheduler(desiredRetention = 0.9, enableFuzz = true): FSRS {
  const key = enableFuzz ? desiredRetention : -desiredRetention;
  let f = cache.get(key);
  if (!f) {
    f = fsrs(
      generatorParameters({
        request_retention: desiredRetention,
        enable_fuzz: enableFuzz, // fuzz spreads due dates so reviews don't clump
        // FSRS-6 defaults (21 weights) + learning steps ["1m","10m"] are used.
      }),
    );
    cache.set(key, f);
  }
  return f;
}

function toFsrsCard(db: SchedulerCardFields): FsrsCard {
  return {
    due: new Date(db.due_at),
    stability: db.fsrs_stability ?? 0,
    difficulty: db.fsrs_difficulty ?? 0,
    elapsed_days: db.elapsed_days,
    scheduled_days: db.scheduled_days,
    reps: db.reps,
    lapses: db.lapses,
    learning_steps: db.learning_step,
    state: DB_TO_STATE[db.fsrs_state],
    last_review: db.last_reviewed_at ? new Date(db.last_reviewed_at) : undefined,
  };
}

function fromFsrsCard(card: FsrsCard): SchedulerCardFields {
  return {
    fsrs_state: STATE_TO_DB[card.state],
    fsrs_stability: card.stability,
    fsrs_difficulty: card.difficulty,
    learning_step: card.learning_steps ?? 0,
    due_at: card.due.toISOString(),
    last_reviewed_at: card.last_review ? card.last_review.toISOString() : null,
    reps: card.reps,
    lapses: card.lapses,
    scheduled_days: card.scheduled_days,
    elapsed_days: card.elapsed_days,
  };
}

export interface ReviewResult {
  fields: SchedulerCardFields;
  log: {
    rating: RatingValue;
    state_before: DbCardState;
    state_after: DbCardState;
    stability_after: number;
    difficulty_after: number;
    scheduled_days: number;
  };
}

/** Apply one review and return the new card fields + a revlog payload. */
export function review(
  db: SchedulerCardFields,
  rating: RatingValue,
  now: Date = new Date(),
  desiredRetention = 0.9,
  enableFuzz = true,
): ReviewResult {
  const f = getScheduler(desiredRetention, enableFuzz);
  const before = toFsrsCard(db);
  const { card } = f.next(before, now, rating as unknown as Grade);
  const fields = fromFsrsCard(card);
  return {
    fields,
    log: {
      rating,
      state_before: db.fsrs_state,
      state_after: fields.fsrs_state,
      stability_after: card.stability,
      difficulty_after: card.difficulty,
      scheduled_days: card.scheduled_days,
    },
  };
}

/** Preview the next due date for each of the 4 buttons (for interval labels). */
export function previewIntervals(
  db: SchedulerCardFields,
  now: Date = new Date(),
  desiredRetention = 0.9,
): Record<RatingValue, Date> {
  const f = getScheduler(desiredRetention, false); // no fuzz for stable labels
  const card = toFsrsCard(db);
  const sched = f.repeat(card, now);
  return {
    [RATING.again]: sched[Rating.Again].card.due,
    [RATING.hard]: sched[Rating.Hard].card.due,
    [RATING.good]: sched[Rating.Good].card.due,
    [RATING.easy]: sched[Rating.Easy].card.due,
  } as Record<RatingValue, Date>;
}

/** Fresh card fields for a brand-new card due now. */
export function newCardFields(now: Date = new Date()): SchedulerCardFields {
  return {
    fsrs_state: "new",
    fsrs_stability: null,
    fsrs_difficulty: null,
    learning_step: 0,
    due_at: now.toISOString(),
    last_reviewed_at: null,
    reps: 0,
    lapses: 0,
    scheduled_days: 0,
    elapsed_days: 0,
  };
}

/** Human-friendly interval label, e.g. "1 min", "10 min", "3 d", "2 mo". */
export function intervalLabel(from: Date, to: Date): string {
  const mins = Math.round((to.getTime() - from.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}
