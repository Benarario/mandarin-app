"use server";

import { requireUser } from "@/lib/require-user";
import { ensureColdStart, introduceConcept } from "@/app/actions/lesson";
import { nextConcepts } from "@/lib/graph/gate";
import { annotateMany, type AnnToken } from "@/lib/annotate";
import type { BreakdownPart, ConceptReviewItem, ConceptType } from "@/lib/db/concept-types";

const startOfTodayIso = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

interface CardJoin {
  id: string;
  concept_id: string;
  template_index: number;
  modality: ConceptReviewItem["modality"];
  fsrs_state: string;
  notes: { fields_json: Record<string, unknown> } | null;
  concepts: { type: ConceptType; ref: string } | null;
}

function toItem(c: CardJoin): ConceptReviewItem | null {
  const f = c.notes?.fields_json ?? {};
  const type = c.concepts?.type;
  if (!type) return null;
  const isNew = c.fsrs_state === "new";
  const breakdown = (f.components_json as BreakdownPart[] | undefined) ?? undefined;

  const base = {
    cardId: c.id,
    conceptId: c.concept_id,
    conceptType: type,
    modality: c.modality,
    templateIndex: c.template_index,
    isNew,
  };

  if (type === "phoneme") {
    return { ...base, front: String(f.label ?? ""), back: String(f.note ?? ""), pinyin: null, gloss: null, audioText: null, label: String(f.label ?? ""), note: (f.note as string) || null };
  }
  if (type === "component") {
    return { ...base, front: String(f.char ?? ""), back: String(f.gloss ?? ""), pinyin: null, gloss: String(f.gloss ?? ""), audioText: String(f.char ?? ""), breakdown };
  }
  if (type === "character") {
    const recog = c.template_index === 0;
    return {
      ...base,
      front: recog ? String(f.char ?? "") : String(f.english ?? ""),
      back: recog ? String(f.english ?? "") : String(f.char ?? ""),
      pinyin: (f.pinyin as string) || null,
      gloss: (f.english as string) || null,
      audioText: String(f.char ?? ""),
      breakdown,
    };
  }
  // word
  const recog = c.template_index === 0;
  return {
    ...base,
    front: recog ? String(f.sentence_zh ?? f.simplified ?? "") : String(f.sentence_en ?? ""),
    back: recog ? String(f.english ?? "") : String(f.sentence_zh ?? f.simplified ?? ""),
    pinyin: (f.pinyin as string) || null,
    gloss: (f.english as string) || null,
    audioText: String(f.sentence_zh ?? f.simplified ?? ""),
    breakdown,
  };
}

/** Interleave by concept type so the session mixes sounds/components/chars/words. */
function interleave(items: ConceptReviewItem[]): ConceptReviewItem[] {
  const buckets = new Map<string, ConceptReviewItem[]>();
  for (const it of items) {
    const key = `${it.conceptType}:${it.modality}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(it);
  }
  const queues = [...buckets.values()];
  const out: ConceptReviewItem[] = [];
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

export async function getConceptSession(): Promise<{
  items: ConceptReviewItem[];
  mastery: Record<string, number>;
  pinyinMode: string;
  seeded: number;
}> {
  const { supabase, user } = await requireUser();

  // Cold start on a fresh account (seeds phonology).
  const { seeded: coldSeeded } = await ensureColdStart();

  // Daily new-concept top-up (respecting the daily limit).
  const { data: settings } = await supabase
    .from("user_settings")
    .select("daily_new_cards, pinyin_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  const dailyNew = settings?.daily_new_cards ?? 20;
  const { count: introducedToday } = await supabase
    .from("concept_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("introduced_at", startOfTodayIso());
  const budget = Math.max(0, dailyNew - (introducedToday ?? 0));
  let topUp = 0;
  if (budget > 0) {
    for (const c of await nextConcepts(user.id, budget)) {
      if ((await introduceConcept(c.id)).introduced) topUp++;
    }
  }

  const select = "id, concept_id, template_index, modality, fsrs_state, notes(fields_json), concepts(type, ref)";
  const nowIso = new Date().toISOString();

  const { data: due } = await supabase
    .from("cards")
    .select(select)
    .eq("user_id", user.id)
    .not("concept_id", "is", null)
    .eq("suspended", false)
    .neq("fsrs_state", "new")
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(200);

  const { data: fresh } = await supabase
    .from("cards")
    .select(select)
    .eq("user_id", user.id)
    .not("concept_id", "is", null)
    .eq("suspended", false)
    .eq("fsrs_state", "new")
    .order("created_at", { ascending: true })
    .limit(200);

  const rows = [...((due ?? []) as unknown as CardJoin[]), ...((fresh ?? []) as unknown as CardJoin[])];
  const items = interleave(rows.map(toItem).filter(Boolean) as ConceptReviewItem[]);

  // Annotate every Chinese string with verified pinyin (one batched lookup).
  const chineseOf = (it: ConceptReviewItem): string | null => {
    if (it.conceptType === "phoneme") return null;
    if (it.conceptType === "component" || it.conceptType === "character") {
      return it.templateIndex === 0 ? it.front : it.back;
    }
    return it.templateIndex === 0 ? it.front : it.back; // word
  };
  const strings = items.map((it) => chineseOf(it) ?? "");
  const annotated = await annotateMany(strings);
  items.forEach((it, i) => {
    if (it.conceptType === "phoneme") return;
    const tokens: AnnToken[] = annotated[i];
    if (it.templateIndex === 0) it.frontTokens = tokens;
    else it.backTokens = tokens;
  });

  // Per-character mastery for pinyin fading.
  const { data: exp } = await supabase
    .from("pinyin_exposure")
    .select("character, mastery_score")
    .eq("user_id", user.id);
  const mastery: Record<string, number> = {};
  for (const r of exp ?? [])
    mastery[(r as { character: string }).character] = (r as { mastery_score: number }).mastery_score;

  return { items, mastery, pinyinMode: settings?.pinyin_mode ?? "adaptive", seeded: coldSeeded + topUp };
}
