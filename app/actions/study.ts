"use server";

import { createClient } from "@/lib/supabase/server";
import { lookupBest } from "@/lib/dict/lookup";
import { annotateMany, type AnnToken } from "@/lib/annotate";
import {
  review as fsrsReview,
  newCardFields,
  RATING,
  type RatingValue,
} from "@/lib/srs/fsrs";
import type {
  CardRow,
  DictionaryRow,
  Modality,
  UserSettings,
  VocabFields,
} from "@/lib/db/types";

const HAN = /\p{Script=Han}/u;
const STARTER_COUNT = 15;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

async function getDefaultDeckId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Mandarin")
    .maybeSingle();
  if (data?.id) return data.id as string;
  const { data: created, error } = await supabase
    .from("decks")
    .insert({ user_id: userId, name: "Mandarin" })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}

export async function getSettings(): Promise<UserSettings> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data) return data as UserSettings;
  const { data: created } = await supabase
    .from("user_settings")
    .insert({ user_id: user.id })
    .select("*")
    .single();
  return created as UserSettings;
}

export async function updateSettings(
  patch: Partial<Omit<UserSettings, "user_id">>,
): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("user_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
}

/** Find a short verified example sentence containing the word, if one exists. */
async function findSentence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  word: string,
): Promise<{ id: number; zh: string; en: string | null } | null> {
  const { data } = await supabase
    .from("sentences")
    .select("id, zh_text, en_text")
    .ilike("zh_text", `%${word}%`)
    .limit(5);
  if (!data || data.length === 0) return null;
  const shortest = [...data].sort(
    (a, b) => [...a.zh_text].length - [...b.zh_text].length,
  )[0];
  return { id: shortest.id, zh: shortest.zh_text, en: shortest.en_text };
}

function buildVocabFields(entry: DictionaryRow, sentenceZh: string, sentenceEn: string): VocabFields {
  return {
    simplified: entry.simplified,
    pinyin: entry.pinyin,
    english: entry.glosses[0] ?? "",
    sentence_zh: sentenceZh,
    sentence_en: sentenceEn,
  };
}

/** Create a vocab note + its recognition & production cards from a dict entry. */
async function createVocabCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  deckId: string,
  entry: DictionaryRow,
  sentenceId: number | null,
  sentenceZh: string,
  sentenceEn: string,
): Promise<void> {
  const fields = buildVocabFields(entry, sentenceZh, sentenceEn);
  const { data: note, error: noteErr } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      note_type_id: "zh-vocab",
      fields_json: fields,
      source: entry.source,
      license: entry.license,
      verified: true, // sourced from CC-CEDICT => passes the anti-fabrication gate
      dictionary_id: entry.id,
      sentence_id: sentenceId,
    })
    .select("id")
    .single();
  if (noteErr) throw noteErr;

  const base = newCardFields(new Date());
  const cards = [
    { template_index: 0, modality: "reading" as Modality },
    { template_index: 1, modality: "writing" as Modality },
  ].map((c) => ({
    note_id: note.id,
    user_id: userId,
    deck_id: deckId,
    template_index: c.template_index,
    modality: c.modality,
    ...base,
  }));
  const { error: cardErr } = await supabase.from("cards").insert(cards);
  if (cardErr) throw cardErr;
}

/** Seed a starter deck of the most frequent HSK-1 words (idempotent). */
export async function ensureStarterDeck(): Promise<{ seeded: number }> {
  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0) return { seeded: 0 };

  const deckId = await getDefaultDeckId(supabase, user.id);
  const { data: words } = await supabase
    .from("dictionary")
    .select("*")
    .eq("hsk_30_band", 1)
    .order("freq_rank", { ascending: true, nullsFirst: false })
    .limit(STARTER_COUNT * 3);

  let seeded = 0;
  for (const w of (words ?? []) as DictionaryRow[]) {
    if (seeded >= STARTER_COUNT) break;
    if (![...w.simplified].some((c) => HAN.test(c))) continue;
    const sentence = await findSentence(supabase, w.simplified);
    await createVocabCards(
      supabase,
      user.id,
      deckId,
      w,
      sentence?.id ?? null,
      sentence?.zh ?? w.simplified,
      sentence?.en ?? (w.glosses[0] ?? ""),
    );
    seeded++;
  }
  return { seeded };
}

/** The four skill-progress rows (reading/listening/speaking/writing). */
export async function getSkills(): Promise<
  { modality: Modality; estimated_hsk_band: number; xp: number; history_json: { t: string; band: number }[] }[]
> {
  const { supabase, user } = await requireUser();
  const order: Modality[] = ["reading", "listening", "speaking", "writing"];
  const { data } = await supabase
    .from("skill_progress")
    .select("modality, estimated_hsk_band, xp, history_json")
    .eq("user_id", user.id);
  const rows = (data ?? []) as {
    modality: Modality;
    estimated_hsk_band: number;
    xp: number;
    history_json: { t: string; band: number }[];
  }[];
  // Ensure all four are present (in a stable order) even before any review.
  return order.map(
    (m) =>
      rows.find((r) => r.modality === m) ?? {
        modality: m,
        estimated_hsk_band: 0,
        xp: 0,
        history_json: [],
      },
  );
}

/** Per-character pinyin mastery map for the current user. */
export async function getMastery(): Promise<Record<string, number>> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("pinyin_exposure")
    .select("character, mastery_score")
    .eq("user_id", user.id);
  const map: Record<string, number> = {};
  for (const r of data ?? [])
    map[(r as { character: string }).character] = (r as { mastery_score: number }).mastery_score;
  return map;
}

/** Counts for the home screen: cards due now and new cards waiting. */
export async function getCounts(): Promise<{ due: number; newCards: number; total: number }> {
  const { supabase, user } = await requireUser();
  const nowIso = new Date().toISOString();
  const [due, fresh, total] = await Promise.all([
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("suspended", false)
      .neq("fsrs_state", "new")
      .lte("due_at", nowIso),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("suspended", false)
      .eq("fsrs_state", "new"),
    supabase.from("cards").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  return { due: due.count ?? 0, newCards: fresh.count ?? 0, total: total.count ?? 0 };
}

export interface ReviewItem {
  cardId: string;
  modality: Modality;
  templateIndex: number;
  isNew: boolean;
  front: string;
  back: string;
  fields: VocabFields;
  // Tokenised pinyin/gloss for whichever side(s) are Chinese.
  frontTokens?: AnnToken[];
  backTokens?: AnnToken[];
  targetPinyin: string;
  targetGloss: string;
}

/** Build today's interleaved session: due cards + a capped number of new ones. */
export async function getSession(): Promise<{
  items: ReviewItem[];
  mastery: Record<string, number>;
  pinyinMode: string;
}> {
  const { supabase, user } = await requireUser();
  const settings = await getSettings();
  const nowIso = new Date().toISOString();

  // Due (learning/review/relearning) cards.
  const { data: due } = await supabase
    .from("cards")
    .select("*, notes(fields_json)")
    .eq("user_id", user.id)
    .eq("suspended", false)
    .neq("fsrs_state", "new")
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(200);

  // New cards, capped by the daily setting.
  const { data: fresh } = await supabase
    .from("cards")
    .select("*, notes(fields_json)")
    .eq("user_id", user.id)
    .eq("suspended", false)
    .eq("fsrs_state", "new")
    .order("created_at", { ascending: true })
    .limit(settings.daily_new_cards);

  type Row = CardRow & { notes: { fields_json: VocabFields } | null };
  const toItem = (c: Row): ReviewItem | null => {
    const f = c.notes?.fields_json;
    if (!f) return null;
    const isRecognition = c.template_index === 0;
    return {
      cardId: c.id,
      modality: c.modality,
      templateIndex: c.template_index,
      isNew: c.fsrs_state === "new",
      front: isRecognition ? f.sentence_zh : f.sentence_en,
      back: isRecognition ? f.english : f.sentence_zh,
      fields: f,
      targetPinyin: f.pinyin,
      targetGloss: f.english,
    };
  };

  const dueItems = ((due ?? []) as Row[]).map(toItem).filter(Boolean) as ReviewItem[];
  const newItems = ((fresh ?? []) as Row[]).map(toItem).filter(Boolean) as ReviewItem[];

  // Interleave by modality so the same card type doesn't clump (spec §7D).
  const items = interleaveByModality([...dueItems, ...newItems]);

  // Annotate the Chinese side of each card with verified pinyin (one batched
  // dictionary lookup). Recognition shows Chinese on the front; production on back.
  const chineseStrings = items.map((it) =>
    it.templateIndex === 0 ? it.front : it.back,
  );
  const annotated = await annotateMany(chineseStrings);
  items.forEach((it, i) => {
    if (it.templateIndex === 0) it.frontTokens = annotated[i];
    else it.backTokens = annotated[i];
  });

  // Per-character mastery for pinyin fading.
  const { data: exp } = await supabase
    .from("pinyin_exposure")
    .select("character, mastery_score")
    .eq("user_id", user.id);
  const mastery: Record<string, number> = {};
  for (const r of exp ?? []) mastery[(r as { character: string }).character] = (r as { mastery_score: number }).mastery_score;

  return { items, mastery, pinyinMode: settings.pinyin_mode };
}

function interleaveByModality(items: ReviewItem[]): ReviewItem[] {
  const buckets = new Map<Modality, ReviewItem[]>();
  for (const it of items) {
    if (!buckets.has(it.modality)) buckets.set(it.modality, []);
    buckets.get(it.modality)!.push(it);
  }
  const queues = [...buckets.values()];
  const out: ReviewItem[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}

/** Record a review: update the card, write the revlog, bump skill + pinyin. */
export async function submitReview(
  cardId: string,
  rating: RatingValue,
): Promise<{ dueAt: string }> {
  const { supabase, user } = await requireUser();
  const settings = await getSettings();

  const { data: card, error } = await supabase
    .from("cards")
    .select("*, notes(fields_json)")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
  const row = card as CardRow & { notes: { fields_json: VocabFields } | null };

  const now = new Date();
  const result = fsrsReview(row, rating, now, settings.desired_retention);

  await supabase
    .from("cards")
    .update({ ...result.fields, last_reviewed_at: now.toISOString(), reps: result.fields.reps })
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

  await bumpSkill(supabase, user.id, row.modality, rating);
  await bumpPinyin(supabase, user.id, row.notes?.fields_json?.simplified ?? "", rating);

  return { dueAt: result.fields.due_at };
}

async function bumpSkill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  modality: Modality,
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
  const band = Math.min(9, 1 + Math.floor(xp / 300)); // honest XP-based estimate
  const history = (data?.history_json ?? []) as { t: string; band: number }[];
  const today = new Date().toISOString().slice(0, 10);
  if (history.at(-1)?.t !== today) history.push({ t: today, band });
  else history[history.length - 1].band = band;

  await supabase.from("skill_progress").upsert(
    {
      user_id: userId,
      modality,
      xp,
      estimated_hsk_band: band,
      history_json: history,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,modality" },
  );
}

async function bumpPinyin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  word: string,
  rating: RatingValue,
) {
  const chars = [...word].filter((c) => HAN.test(c));
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
  const rows = chars.map((c) => {
    const prev = existing.get(c);
    const delta = rating >= RATING.good ? 1 : rating === RATING.hard ? 0 : -1;
    const mastery = Math.max(0, Math.min(5, (prev?.mastery_score ?? 0) + delta));
    return {
      user_id: userId,
      character: c,
      mastery_score: mastery,
      reps: (prev?.reps ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
  });
  await supabase.from("pinyin_exposure").upsert(rows, { onConflict: "user_id,character" });
}

/** Mine a word from the reader into the deck (verified via CC-CEDICT). */
export async function addWordToDeck(
  simplified: string,
): Promise<{ added: boolean; reason?: string }> {
  const { supabase, user } = await requireUser();
  const entry = await lookupBest(simplified);
  if (!entry) return { added: false, reason: "not in dictionary" };

  // Skip if this word is already in the deck.
  const { data: existingNotes } = await supabase
    .from("notes")
    .select("id")
    .eq("user_id", user.id)
    .eq("dictionary_id", entry.id)
    .limit(1);
  if (existingNotes && existingNotes.length > 0) {
    return { added: false, reason: "already in deck" };
  }

  const deckId = await getDefaultDeckId(supabase, user.id);
  const sentence = await findSentence(supabase, entry.simplified);
  await createVocabCards(
    supabase,
    user.id,
    deckId,
    entry,
    sentence?.id ?? null,
    sentence?.zh ?? entry.simplified,
    sentence?.en ?? (entry.glosses[0] ?? ""),
  );
  return { added: true };
}
