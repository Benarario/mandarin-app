// Batch FSRS personalization: per user, read the revlog, and once there's
// enough history, fit personalized weights and store them in
// user_settings.fsrs_params (the scheduler then uses them). ts-fsrs ships no
// optimizer, so optimizeWeights() is currently a seam that returns null — we
// report diagnostics and NEVER store invented weights. Wire a real optimizer
// into lib/srs/optimize.ts:optimizeWeights and this job starts personalizing.
//
// Run: npm run fsrs:optimize            (all users)
//      FSRS_USER=<uuid> npm run fsrs:optimize   (one user)
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import {
  summarizeReviews,
  shouldOptimize,
  optimizeWeights,
  isValidWeights,
  MIN_REVIEWS_FOR_OPTIMIZE,
  type RevlogRow,
} from "../../lib/srs/optimize";

loadEnv({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function revlogFor(userId: string): Promise<RevlogRow[]> {
  const rows: RevlogRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("revlog")
      .select("rating, state_before")
      .eq("user_id", userId)
      .order("reviewed_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as RevlogRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function optimizeUser(userId: string) {
  const rows = await revlogFor(userId);
  const s = summarizeReviews(rows);
  const ret = s.retention == null ? "n/a" : `${(s.retention * 100).toFixed(1)}%`;
  console.log(
    `\nuser ${userId}\n  reviews=${s.reviewed} mature=${s.mature} measuredRetention=${ret} ` +
      `ratings={again:${s.ratingCounts[1]}, hard:${s.ratingCounts[2]}, good:${s.ratingCounts[3]}, easy:${s.ratingCounts[4]}}`,
  );

  if (!shouldOptimize(s.reviewed)) {
    console.log(`  ↳ need ≥${MIN_REVIEWS_FOR_OPTIMIZE} reviews to fit weights — keeping defaults.`);
    return;
  }
  const weights = optimizeWeights(rows);
  if (!isValidWeights(weights)) {
    console.log("  ↳ enough history, but no optimizer wired (optimizeWeights→null) — keeping defaults, storing nothing.");
    return;
  }
  const { error } = await supabase.from("user_settings").update({ fsrs_params: weights }).eq("user_id", userId);
  if (error) throw error;
  console.log(`  ↳ stored personalized weights (${weights.length}).`);
}

async function main() {
  const one = process.env.FSRS_USER;
  let userIds: string[];
  if (one) {
    userIds = [one];
  } else {
    const { data } = await supabase.from("user_settings").select("user_id");
    userIds = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  }
  console.log(`FSRS optimize: ${userIds.length} user(s).`);
  for (const id of userIds) await optimizeUser(id);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
