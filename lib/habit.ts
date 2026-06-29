// Habit scaffolding — pure, testable. Computes a practice streak and daily
// counts from review timestamps. Purely motivational: derived from revlog,
// never feeds back into scheduling.

const dayKey = (d: Date) => d.toISOString().slice(0, 10); // UTC calendar day

export interface HabitStats {
  today: number; // reviews done today (UTC)
  streak: number; // consecutive days with ≥1 review, ending today or yesterday
  week: number[]; // last 7 days' counts, oldest → newest (today last)
}

/**
 * @param timestamps  ISO review times (any order)
 * @param now         current time (defaults to now)
 *
 * A day counts toward the streak if it had ≥1 review. The streak ends at today
 * if today has activity, otherwise at yesterday (today is still "in progress"
 * and shouldn't break a streak until the day is over).
 */
export function computeHabit(timestamps: string[], now: Date = new Date()): HabitStats {
  const counts = new Map<string, number>();
  for (const t of timestamps) {
    const k = t.slice(0, 10); // ISO date prefix (UTC)
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const today = counts.get(dayKey(now)) ?? 0;

  // Walk back day by day. Allow today to be empty without breaking the streak.
  let streak = 0;
  const cursor = new Date(now);
  if (today === 0) cursor.setUTCDate(cursor.getUTCDate() - 1); // start from yesterday
  while ((counts.get(dayKey(cursor)) ?? 0) > 0) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const week: number[] = [];
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 6);
  for (let i = 0; i < 7; i++) {
    week.push(counts.get(dayKey(d)) ?? 0);
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return { today, streak, week };
}
