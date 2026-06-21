"use server";

import { requireUser, type ActionDb } from "@/lib/require-user";
import { review as fsrsReview, RATING, type RatingValue } from "@/lib/srs/fsrs";
import { statusFromCards } from "@/lib/srs/status";
import type { CardRow } from "@/lib/db/types";

const HAN = /\p{Script=Han}/u;

/** Record a concept-card review: update FSRS, log it, recompute the concept's
 *  mastery status, and bump per-character pinyin mastery. */
export async function submitConceptReview(
  cardId: string,
  rating: RatingValue,
): Promise<{ dueAt: string }> {
  const { supabase, user } = await requireUser();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("desired_retention")
    .eq("user_id", user.id)
    .maybeSingle();
  const retention = settings?.desired_retention ?? 0.9;

  const { data: card, error } = await supabase
    .from("cards")
    .select("*, concepts(type, ref), notes(fields_json)")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
  const row = card as CardRow & {
    concept_id: string | null;
    concepts: { type: string; ref: string } | null;
  };

  const now = new Date();
  const result = fsrsReview(row, rating, now, retention);

  await supabase
    .from("cards")
    .update({ ...result.fields, last_reviewed_at: now.toISOString() })
    .eq("id", cardId);

  await supabase.from("revlog").insert({
    card_id: cardId,
    user_id: user.id,
    rating,
    reviewed_at: now.toISOString(),
    state_before: result.log.state_before,
    state_after: result.log.state_after,
    stability_after: result.log.stability_after,
    difficulty_after: result.log.difficulty_after,
    scheduled_days: result.log.scheduled_days,
  });

  // Recompute the concept's mastery from ALL its cards (now includes this one).
  if (row.concept_id) {
    const { data: sib } = await supabase
      .from("cards")
      .select("fsrs_state, fsrs_stability")
      .eq("user_id", user.id)
      .eq("concept_id", row.concept_id);
    const status = statusFromCards(
      (sib ?? []).map((c) => ({
        fsrs_state: (c as { fsrs_state: CardRow["fsrs_state"] }).fsrs_state,
        fsrs_stability: (c as { fsrs_stability: number | null }).fsrs_stability,
      })),
    );
    await supabase
      .from("concept_progress")
      .update({ status, updated_at: now.toISOString() })
      .eq("user_id", user.id)
      .eq("concept_id", row.concept_id);
  }

  const ref = row.concepts?.ref;
  if (ref) await bumpPinyin(supabase, user.id, ref, rating);
  await bumpSkill(supabase, user.id, row.modality, rating);

  return { dueAt: result.fields.due_at };
}

async function bumpPinyin(supabase: ActionDb, userId: string, text: string, rating: RatingValue) {
  const chars = [...text].filter((c) => HAN.test(c));
  if (chars.length === 0) return;
  const { data } = await supabase
    .from("pinyin_exposure")
    .select("character, mastery_score, reps")
    .eq("user_id", userId)
    .in("character", chars);
  const existing = new Map(
    (data ?? []).map((r) => [
      (r as { character: string }).character,
      r as { mastery_score: number; reps: number },
    ]),
  );
  const delta = rating >= RATING.good ? 1 : rating === RATING.hard ? 0 : -1;
  const rows = chars.map((c) => {
    const prev = existing.get(c);
    return {
      user_id: userId,
      character: c,
      mastery_score: Math.max(0, Math.min(5, (prev?.mastery_score ?? 0) + delta)),
      reps: (prev?.reps ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
  });
  await supabase.from("pinyin_exposure").upsert(rows, { onConflict: "user_id,character" });
}

async function bumpSkill(
  supabase: ActionDb,
  userId: string,
  modality: CardRow["modality"],
  rating: RatingValue,
) {
  const gain = rating >= RATING.good ? 10 : rating === RATING.hard ? 5 : 1;
  const { data } = await supabase
    .from("skill_progress")
    .select("xp, history_json")
    .eq("user_id", userId)
    .eq("modality", modality)
    .maybeSingle();
  const xp = (data?.xp ?? 0) + gain;
  const band = Math.min(9, 1 + Math.floor(xp / 300));
  const history = (data?.history_json ?? []) as { t: string; band: number }[];
  const today = new Date().toISOString().slice(0, 10);
  if (history.at(-1)?.t !== today) history.push({ t: today, band });
  else history[history.length - 1].band = band;
  await supabase.from("skill_progress").upsert(
    { user_id: userId, modality, xp, estimated_hsk_band: band, history_json: history, updated_at: new Date().toISOString() },
    { onConflict: "user_id,modality" },
  );
}
