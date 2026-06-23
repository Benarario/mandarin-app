"use server";

import { requireUser } from "@/lib/require-user";
import { getDefaultDeckId } from "@/lib/decks";
import { newCardFields } from "@/lib/srs/fsrs";
import { lookupMany } from "@/lib/dict/lookup";
import { primaryGloss } from "@/lib/dict/gloss";
import { annotateMany } from "@/lib/annotate";
import { getCharStatusMap } from "@/lib/graph/mastery";
import type { ReviewItem } from "@/app/actions/study";
import type { VocabFields } from "@/lib/db/types";

const HAN = /\p{Script=Han}/u;
const HAN_RUN = /\p{Script=Han}+/gu;
const MAX_ROWS = 1000;

export interface ImportResult {
  imported: number; // verified against CC-CEDICT and added
  quarantined: number; // hanzi not found in CC-CEDICT — held back, not taught
  skipped: number; // already in your deck
  total: number; // data rows seen
  quarantinedSamples: string[];
}

/** Split CSV (comma, with quotes) or TSV text into rows of cells. */
function parseRows(text: string): string[][] {
  const useTab = text.includes("\t");
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue; // blanks / Anki comments
    rows.push(useTab ? raw.split("\t").map((s) => s.trim()) : splitCsv(raw));
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Extract the Han headword from a cell (strips HTML, pinyin, punctuation). */
function hanOf(cell: string): string {
  const noTags = cell.replace(/<[^>]*>/g, "");
  const runs = noTags.match(HAN_RUN);
  return runs ? runs.join("") : "";
}

/**
 * Import vocabulary from Anki CSV/TSV text. NO FABRICATION: the file only tells
 * us which hanzi the learner wants; the taught pinyin + meaning come from
 * CC-CEDICT. Any hanzi not found there is QUARANTINED (note.verified = false,
 * card suspended) so it is never taught until verified.
 */
export async function importCsv(text: string): Promise<ImportResult> {
  const { supabase, user } = await requireUser();
  const rows = parseRows(text);

  // First Han-bearing cell of each row = the headword; last cell = the learner's
  // own note (kept only as a label on quarantined items, never taught as fact).
  const entries: { han: string; note: string }[] = [];
  for (const r of rows) {
    const han = hanOf(r.find((c) => HAN.test(c)) ?? r[0] ?? "");
    if (!han) continue; // header row / no Chinese
    const note = (r.length > 1 ? r[r.length - 1] : "").replace(/<[^>]*>/g, "").trim();
    entries.push({ han, note });
  }
  const total = entries.length;
  if (total === 0) return { imported: 0, quarantined: 0, skipped: 0, total: 0, quarantinedSamples: [] };

  // Dedup within the file and against what's already in the deck.
  const { data: existingNotes } = await supabase
    .from("notes")
    .select("fields_json")
    .eq("user_id", user.id)
    .eq("note_type_id", "zh-vocab");
  const existing = new Set(
    ((existingNotes ?? []) as { fields_json: VocabFields }[]).map((n) => n.fields_json?.simplified).filter(Boolean),
  );

  const unique = new Map<string, string>(); // han -> note
  for (const e of entries) if (!unique.has(e.han)) unique.set(e.han, e.note);

  const dict = await lookupMany([...unique.keys()]);
  const deckId = await getDefaultDeckId(supabase, user.id);
  const now = new Date().toISOString();

  let imported = 0,
    quarantined = 0,
    skipped = 0;
  const quarantinedSamples: string[] = [];

  for (const [han, note] of unique) {
    if (existing.has(han)) { skipped++; continue; }

    const entry = dict.get(han);
    const verified = Boolean(entry);
    const fields: VocabFields = verified
      ? {
          simplified: han,
          pinyin: entry!.pinyin,
          english: primaryGloss(entry!.glosses),
          sentence_zh: han,
          sentence_en: primaryGloss(entry!.glosses),
          audio_key: "",
        }
      : { simplified: han, pinyin: "", english: note, sentence_zh: han, sentence_en: note, audio_key: "" };

    const { data: noteRow, error: noteErr } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        note_type_id: "zh-vocab",
        fields_json: fields,
        source: "anki-import",
        verified,
        tags: verified ? [] : ["quarantine"],
      })
      .select("id")
      .single();
    if (noteErr || !noteRow) continue;

    await supabase.from("cards").insert({
      note_id: noteRow.id,
      user_id: user.id,
      deck_id: deckId,
      template_index: 0,
      modality: "reading",
      suspended: !verified, // quarantined cards never enter study
      ...newCardFields(new Date(now)),
    });

    if (verified) imported++;
    else {
      quarantined++;
      if (quarantinedSamples.length < 12) quarantinedSamples.push(han);
    }
  }

  return { imported, quarantined, skipped, total, quarantinedSamples };
}

/**
 * Review session of the learner's own custom cards (imported + mined) — the
 * non-concept cards that the gated concept review doesn't cover. Reuses the v1
 * ReviewSession UI and submitReview.
 */
export async function getImportedSession(): Promise<{
  items: ReviewItem[];
  mastery: Record<string, number>;
  pinyinMode: string;
}> {
  const { supabase, user } = await requireUser();
  const nowIso = new Date().toISOString();
  const select = "id, modality, template_index, fsrs_state, notes(fields_json)";

  const [{ data: due }, { data: fresh }, settingsRow] = await Promise.all([
    supabase
      .from("cards")
      .select(select)
      .eq("user_id", user.id)
      .is("concept_id", null)
      .eq("suspended", false)
      .neq("fsrs_state", "new")
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(200),
    supabase
      .from("cards")
      .select(select)
      .eq("user_id", user.id)
      .is("concept_id", null)
      .eq("suspended", false)
      .eq("fsrs_state", "new")
      .order("created_at", { ascending: true })
      .limit(40),
    supabase.from("user_settings").select("pinyin_mode").eq("user_id", user.id).maybeSingle(),
  ]);

  type Row = {
    id: string;
    modality: ReviewItem["modality"];
    template_index: number;
    fsrs_state: string;
    notes: { fields_json: VocabFields } | null;
  };
  const toItem = (c: Row): ReviewItem | null => {
    const f = c.notes?.fields_json;
    if (!f) return null;
    const isRecognition = c.template_index === 0;
    return {
      cardId: c.id,
      modality: c.modality,
      templateIndex: c.template_index,
      isNew: c.fsrs_state === "new",
      front: isRecognition ? f.sentence_zh || f.simplified : f.sentence_en || f.english,
      back: isRecognition ? f.english : f.sentence_zh || f.simplified,
      fields: f,
      targetPinyin: f.pinyin,
      targetGloss: f.english,
    };
  };

  const items = [...((due ?? []) as unknown as Row[]), ...((fresh ?? []) as unknown as Row[])]
    .map(toItem)
    .filter(Boolean) as ReviewItem[];

  const chinese = items.map((it) => (it.templateIndex === 0 ? it.front : it.back));
  const annotated = await annotateMany(chinese);
  items.forEach((it, i) => {
    if (it.templateIndex === 0) it.frontTokens = annotated[i];
    else it.backTokens = annotated[i];
  });

  const mastery = await getCharStatusMap(supabase, user.id);
  return { items, mastery, pinyinMode: settingsRow.data?.pinyin_mode ?? "adaptive" };
}
