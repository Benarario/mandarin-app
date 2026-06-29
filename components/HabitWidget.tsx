"use client";

import { useEffect, useState } from "react";
import type { HabitStats } from "@/lib/habit";

// Goal + reminder are per-device motivational prefs (localStorage) — deliberately
// kept out of the DB/scheduling so this can never affect review correctness.
const GOAL_KEY = "habit.dailyGoal";
const REMIND_KEY = "habit.reminder"; // JSON { on: boolean, time: "HH:MM" }
const DEFAULT_GOAL = 20;

interface Reminder {
  on: boolean;
  time: string;
}

export default function HabitWidget({ stats }: { stats: HabitStats }) {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [reminder, setReminder] = useState<Reminder>({ on: false, time: "19:00" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const g = Number(localStorage.getItem(GOAL_KEY));
    if (g > 0) setGoal(g);
    try {
      const r = JSON.parse(localStorage.getItem(REMIND_KEY) || "null");
      if (r && typeof r.on === "boolean") setReminder({ on: r.on, time: r.time || "19:00" });
    } catch {
      /* ignore */
    }
  }, []);

  function saveGoal(n: number) {
    const v = Math.max(1, Math.min(200, Math.round(n)));
    setGoal(v);
    localStorage.setItem(GOAL_KEY, String(v));
  }
  function saveReminder(r: Reminder) {
    setReminder(r);
    localStorage.setItem(REMIND_KEY, JSON.stringify(r));
  }

  const pct = Math.min(100, Math.round((stats.today / goal) * 100));
  const met = stats.today >= goal;

  // Gentle in-app nudge: reminder on, it's past the set time, and the goal isn't met yet.
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const nudge = reminder.on && nowHHMM >= reminder.time && !met;

  const max = Math.max(1, ...stats.week);

  return (
    <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🔥</span>
          <div>
            <div className="text-lg font-bold text-orange-900">
              {stats.streak} day{stats.streak === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-stone-500">practice streak</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-semibold ${met ? "text-emerald-700" : "text-stone-700"}`}>
            {stats.today} / {goal} {met && "✓"}
          </div>
          <button onClick={() => setEditing((e) => !e)} className="text-xs text-stone-400 underline hover:text-stone-600">
            goal &amp; reminder
          </button>
        </div>
      </div>

      {/* today's progress */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full transition-all ${met ? "bg-emerald-500" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
      </div>

      {/* 7-day strip */}
      <div className="mt-3 flex items-end justify-between gap-1" aria-hidden>
        {stats.week.map((c, i) => (
          <div key={i} className="flex-1 rounded bg-stone-100" style={{ height: 24 }}>
            <div className="w-full rounded bg-orange-300" style={{ height: `${(c / max) * 24}px` }} />
          </div>
        ))}
      </div>

      {nudge && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⏰ Time for today&apos;s practice — {goal - stats.today} more to hit your goal.
        </p>
      )}

      {editing && (
        <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
          <label className="block text-sm text-stone-600">
            Daily goal: <span className="font-semibold">{goal}</span> reviews
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={goal}
              onChange={(e) => saveGoal(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <div className="flex items-center gap-3 text-sm text-stone-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reminder.on}
                onChange={(e) => saveReminder({ ...reminder, on: e.target.checked })}
              />
              Daily reminder
            </label>
            <input
              type="time"
              value={reminder.time}
              disabled={!reminder.on}
              onChange={(e) => saveReminder({ ...reminder, time: e.target.value })}
              className="rounded-lg border border-stone-300 px-2 py-1 disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-stone-400">
            The reminder shows here when you open the app after that time and haven&apos;t met your
            goal. (Goal &amp; reminder are saved on this device.)
          </p>
        </div>
      )}
    </section>
  );
}
