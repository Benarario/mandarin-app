import { describe, it, expect } from "vitest";
import { computeHabit } from "./habit";

const NOW = new Date("2026-06-20T12:00:00.000Z");
const on = (day: string, n = 1) => Array.from({ length: n }, () => `${day}T08:00:00.000Z`);

describe("computeHabit", () => {
  it("counts today's reviews and a run ending today", () => {
    const ts = [...on("2026-06-20", 3), ...on("2026-06-19"), ...on("2026-06-18")];
    const h = computeHabit(ts, NOW);
    expect(h.today).toBe(3);
    expect(h.streak).toBe(3); // 18,19,20
  });

  it("keeps the streak alive when today has no reviews yet (counts to yesterday)", () => {
    const ts = [...on("2026-06-19"), ...on("2026-06-18")];
    const h = computeHabit(ts, NOW);
    expect(h.today).toBe(0);
    expect(h.streak).toBe(2); // today in progress; 18,19 still count
  });

  it("breaks the streak on a gap", () => {
    const ts = [...on("2026-06-20"), ...on("2026-06-18"), ...on("2026-06-17")];
    const h = computeHabit(ts, NOW);
    expect(h.streak).toBe(1); // only today (19 missing breaks it)
  });

  it("is zero when there is no activity today or yesterday", () => {
    expect(computeHabit(on("2026-06-10"), NOW)).toMatchObject({ today: 0, streak: 0 });
  });

  it("returns last-7-day counts oldest→newest with today last", () => {
    const ts = [...on("2026-06-20", 2), ...on("2026-06-14", 5)];
    const h = computeHabit(ts, NOW); // window 06-14 … 06-20
    expect(h.week).toEqual([5, 0, 0, 0, 0, 0, 2]);
  });

  it("handles an empty history", () => {
    expect(computeHabit([], NOW)).toEqual({ today: 0, streak: 0, week: [0, 0, 0, 0, 0, 0, 0] });
  });
});
