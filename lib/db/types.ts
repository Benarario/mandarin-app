// Shared database row shapes (kept in sync with supabase/migrations/0001_init.sql).

export interface DictionaryRow {
  id: number;
  simplified: string;
  traditional: string;
  pinyin: string;
  pinyin_numbered: string;
  glosses: string[];
  hsk_30_band: number | null;
  hsk_20_level: number | null;
  freq_rank: number | null;
  freq_source: string | null;
  source: string;
  license: string;
}

export interface SentenceRow {
  id: number;
  zh_text: string;
  en_text: string | null;
  source: string;
  license: string;
  target_simplified: string | null;
}

export type Modality = "reading" | "listening" | "speaking" | "writing";

export interface VocabFields {
  simplified: string;
  pinyin: string;
  english: string;
  sentence_zh: string;
  sentence_en: string;
  audio_key?: string;
}

export interface CardRow {
  id: string;
  note_id: string;
  user_id: string;
  deck_id: string;
  template_index: number;
  modality: Modality;
  fsrs_state: "new" | "learning" | "review" | "relearning";
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  learning_step: number;
  due_at: string;
  last_reviewed_at: string | null;
  reps: number;
  lapses: number;
  scheduled_days: number;
  elapsed_days: number;
  suspended: boolean;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  daily_new_cards: number;
  desired_retention: number;
  learning_steps: number[];
  pinyin_mode: "full" | "on_tap" | "new_only" | "none" | "adaptive";
  voice_preference: "female" | "male";
}

export interface SkillProgressRow {
  user_id: string;
  modality: Modality;
  estimated_hsk_band: number;
  xp: number;
  history_json: { t: string; band: number }[];
  updated_at: string;
}
