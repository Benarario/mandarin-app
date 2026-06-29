"use server";

import { requireUser } from "@/lib/require-user";
import { computeHabit, type HabitStats } from "@/lib/habit";

/**
 * Practice streak + recent activity, derived purely from the review log.
 * Motivational only — it never influences scheduling or gating.
 */
export async function getHabitStats(): Promise<HabitStats> {
  const { supabase, user } = await requireUser();
  // Last ~90 days of review timestamps is plenty for a streak + 7-day strip.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);
  const { data } = await supabase
    .from("revlog")
    .select("reviewed_at")
    .eq("user_id", user.id)
    .gte("reviewed_at", since.toISOString())
    .order("reviewed_at", { ascending: false })
    .limit(5000);
  const timestamps = ((data ?? []) as { reviewed_at: string }[]).map((r) => r.reviewed_at);
  return computeHabit(timestamps);
}
