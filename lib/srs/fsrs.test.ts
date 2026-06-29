import { describe, it, expect } from "vitest";
import { FSRSVersion, generatorParameters } from "ts-fsrs";
import {
  review,
  previewIntervals,
  newCardFields,
  getScheduler,
  RATING,
  intervalLabel,
} from "./fsrs";

const NOW = new Date("2026-06-20T00:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86400_000);

describe("FSRS configuration matches the Anki reference (FSRS-6)", () => {
  it("uses 21 weights (FSRS-6) and 0.9 default retention", () => {
    const p = generatorParameters();
    expect(p.w.length).toBe(21);
    expect(p.request_retention).toBe(0.9);
    expect(p.learning_steps).toEqual(["1m", "10m"]);
  });
  it("uses the FSRS-6 algorithm", () => {
    expect(FSRSVersion).toMatch(/FSRS-6/i);
  });
});

describe("review state machine mirrors Anki (new → learning → review, relearning on lapse)", () => {
  it("new + Again schedules ~1 minute, stays in learning", () => {
    const r = review(newCardFields(NOW), RATING.again, NOW, 0.9, false);
    expect(r.fields.fsrs_state).toBe("learning");
    const mins = (new Date(r.fields.due_at).getTime() - NOW.getTime()) / 60000;
    expect(mins).toBeCloseTo(1, 0);
  });

  it("new + Good moves to the 10-minute learning step", () => {
    const r = review(newCardFields(NOW), RATING.good, NOW, 0.9, false);
    expect(r.fields.fsrs_state).toBe("learning");
    const mins = (new Date(r.fields.due_at).getTime() - NOW.getTime()) / 60000;
    expect(mins).toBeCloseTo(10, 0);
  });

  it("graduates to review (scheduled_days >= 1) after passing the learning steps", () => {
    let f = newCardFields(NOW);
    f = review(f, RATING.good, NOW, 0.9, false).fields; // -> 10m step
    const second = review(f, RATING.good, new Date(NOW.getTime() + 10 * 60000), 0.9, false);
    expect(second.fields.fsrs_state).toBe("review");
    expect(second.fields.scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it("a lapse on a review card goes to relearning and increments lapses", () => {
    // Build a review card first.
    let f = newCardFields(NOW);
    f = review(f, RATING.easy, NOW, 0.9, false).fields; // Easy can graduate immediately
    expect(f.fsrs_state).toBe("review");
    const lapse = review(f, RATING.again, day(5), 0.9, false);
    expect(lapse.fields.fsrs_state).toBe("relearning");
    expect(lapse.fields.lapses).toBe(1);
  });
});

describe("scheduling is deterministic with fuzz disabled and ordered by rating", () => {
  it("Easy interval >= Good >= Hard for a review card", () => {
    // Promote to review.
    let f = newCardFields(NOW);
    f = review(f, RATING.good, NOW, 0.9, false).fields;
    f = review(f, RATING.good, new Date(NOW.getTime() + 10 * 60000), 0.9, false).fields;
    const reviewNow = day(3);
    const p = previewIntervals(f, reviewNow, 0.9);
    const again = p[RATING.again].getTime();
    const hard = p[RATING.hard].getTime();
    const good = p[RATING.good].getTime();
    const easy = p[RATING.easy].getTime();
    expect(again).toBeLessThanOrEqual(hard);
    expect(hard).toBeLessThanOrEqual(good);
    expect(good).toBeLessThanOrEqual(easy);
  });
});

describe("personalized FSRS weights (P5)", () => {
  it("uses a distinct scheduler for valid custom weights, and ignores invalid ones", () => {
    const def = getScheduler(0.9, true);
    const w = [...generatorParameters().w];
    w[20] = w[20] + 0.1; // a valid 21-length tweak
    expect(getScheduler(0.9, true, w)).not.toBe(def); // personalized
    expect(getScheduler(0.9, true, [1, 2, 3])).toBe(def); // wrong length → defaults
    expect(getScheduler(0.9, true, null)).toBe(def); // none → defaults
  });
});

describe("intervalLabel", () => {
  it("formats minutes, days, months", () => {
    expect(intervalLabel(NOW, new Date(NOW.getTime() + 60000))).toBe("1 min");
    expect(intervalLabel(NOW, day(3))).toBe("3 d");
    expect(intervalLabel(NOW, day(60))).toBe("2 mo");
  });
});
