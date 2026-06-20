-- ============================================================================
-- Mandarin learning app — initial schema (Phase 1)
-- Mirrors Anki's proven model: NOTES (content) are separate from CARDS
-- (scheduled items), with a REVLOG (one row per review) so FSRS parameters can
-- be re-optimised later from real history.
--
-- Anti-fabrication: every taught Chinese fact is sourced. `notes.verified`
-- gates whether a card may enter normal study.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- REFERENCE DATA (global; loaded by the ETL with the service-role key).
-- Readable by any signed-in user; only the service role writes.
-- ----------------------------------------------------------------------------

-- CC-CEDICT dictionary (definition/pinyin backbone) + HSK + frequency tags.
create table if not exists public.dictionary (
  id                 bigint generated always as identity primary key,
  simplified         text not null,
  traditional        text not null,
  pinyin             text not null,            -- diacritic form, e.g. "nǐ hǎo"
  pinyin_numbered    text not null,            -- numbered form, e.g. "ni3 hao3"
  glosses            text[] not null,
  hsk_30_band        smallint,                 -- HSK 3.0 (2025) band 1-9, nullable
  hsk_20_level       smallint,                 -- HSK 2.0 level 1-6, nullable
  freq_rank          integer,                  -- word frequency rank (lower = more common)
  freq_source        text,                     -- provenance of freq_rank
  source             text not null default 'CC-CEDICT',
  license            text not null
);
create index if not exists dictionary_simplified_idx on public.dictionary (simplified);
create index if not exists dictionary_freq_idx on public.dictionary (freq_rank);
create index if not exists dictionary_hsk30_idx on public.dictionary (hsk_30_band);

-- Verified example sentences (Tatoeba etc.) for sentence-context cards.
create table if not exists public.sentences (
  id                bigint generated always as identity primary key,
  zh_text           text not null,
  en_text           text,
  source            text not null,
  license           text not null,
  difficulty_score  real,
  target_simplified text                       -- the focus word, if mined for one
);
create index if not exists sentences_target_idx on public.sentences (target_simplified);

-- Reading texts. Global seed rows have owner = null; users may add their own.
create table if not exists public.texts (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid references auth.users (id) on delete cascade,
  title           text not null,
  type            text not null check (type in ('novel','news','lyrics','youtube','user','reader')),
  language_level  text,
  source_url      text,
  license         text not null,
  full_text       text not null,
  segmented_json  jsonb,                        -- cached jieba segmentation
  created_at      timestamptz not null default now()
);
create index if not exists texts_owner_idx on public.texts (owner);

-- Note types (global templates). One note can spawn several cards.
create table if not exists public.note_types (
  id                   text primary key,        -- slug, e.g. 'zh-vocab'
  name                 text not null,
  fields_json          jsonb not null,          -- field definitions
  card_templates_json  jsonb not null           -- which cards + their modality
);

-- ----------------------------------------------------------------------------
-- PER-USER DATA (Row-Level Security: each user sees only their own rows).
-- ----------------------------------------------------------------------------

create table if not exists public.decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  parent_id   uuid references public.decks (id) on delete set null,
  config_json jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  note_type_id  text not null references public.note_types (id),
  fields_json   jsonb not null,
  tags          text[] not null default '{}',
  source        text,
  license       text,
  verified      boolean not null default false,  -- anti-fabrication gate
  dictionary_id bigint references public.dictionary (id),
  sentence_id   bigint references public.sentences (id),
  grammar_id    text,
  created_at    timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes (user_id);

create table if not exists public.cards (
  id              uuid primary key default gen_random_uuid(),
  note_id         uuid not null references public.notes (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  deck_id         uuid not null references public.decks (id) on delete cascade,
  template_index  smallint not null default 0,
  modality        text not null check (modality in ('reading','listening','speaking','writing')),
  -- FSRS state (mirrors what ts-fsrs / Anki track)
  fsrs_state      text not null default 'new' check (fsrs_state in ('new','learning','review','relearning')),
  fsrs_stability  double precision,
  fsrs_difficulty double precision,
  learning_step   smallint not null default 0,   -- index into learning steps
  due_at          timestamptz not null default now(),
  last_reviewed_at timestamptz,
  reps            integer not null default 0,
  lapses          integer not null default 0,
  scheduled_days  integer not null default 0,
  elapsed_days    integer not null default 0,
  suspended       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists cards_user_due_idx on public.cards (user_id, suspended, due_at);
create index if not exists cards_note_idx on public.cards (note_id);

-- One row per review — the audit log that FSRS re-optimisation reads.
create table if not exists public.revlog (
  id               uuid primary key default gen_random_uuid(),
  card_id          uuid not null references public.cards (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  rating           smallint not null check (rating between 1 and 4),  -- 1 again,2 hard,3 good,4 easy
  reviewed_at      timestamptz not null default now(),
  elapsed_ms       bigint,
  state_before     text,
  state_after      text,
  stability_after  double precision,
  difficulty_after double precision,
  scheduled_days   integer
);
create index if not exists revlog_user_idx on public.revlog (user_id, reviewed_at);
create index if not exists revlog_card_idx on public.revlog (card_id);

-- Four-modality skill tracking.
create table if not exists public.skill_progress (
  user_id            uuid not null references auth.users (id) on delete cascade,
  modality           text not null check (modality in ('reading','listening','speaking','writing')),
  estimated_hsk_band numeric not null default 0,
  xp                 integer not null default 0,
  history_json       jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null default now(),
  primary key (user_id, modality)
);

-- Per-character pinyin mastery (drives progressive pinyin fading).
create table if not exists public.pinyin_exposure (
  user_id       uuid not null references auth.users (id) on delete cascade,
  character     text not null,
  mastery_score double precision not null default 0,
  reps          integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, character)
);

create table if not exists public.user_settings (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  daily_new_cards  integer not null default 20,
  desired_retention double precision not null default 0.90,
  learning_steps   integer[] not null default '{1,10}',  -- minutes
  pinyin_mode      text not null default 'adaptive'
                     check (pinyin_mode in ('full','on_tap','new_only','none','adaptive')),
  voice_preference text not null default 'female'
                     check (voice_preference in ('female','male')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.dictionary      enable row level security;
alter table public.sentences       enable row level security;
alter table public.note_types      enable row level security;
alter table public.texts           enable row level security;
alter table public.decks           enable row level security;
alter table public.notes           enable row level security;
alter table public.cards           enable row level security;
alter table public.revlog          enable row level security;
alter table public.skill_progress  enable row level security;
alter table public.pinyin_exposure enable row level security;
alter table public.user_settings   enable row level security;

-- Reference data: any authenticated user may read.
create policy "read dictionary" on public.dictionary for select to authenticated using (true);
create policy "read sentences"  on public.sentences  for select to authenticated using (true);
create policy "read note_types" on public.note_types for select to authenticated using (true);

-- Texts: read global seeds or your own; write only your own.
create policy "read texts" on public.texts for select to authenticated
  using (owner is null or owner = (select auth.uid()));
create policy "insert texts" on public.texts for insert to authenticated
  with check (owner = (select auth.uid()));
create policy "update texts" on public.texts for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "delete texts" on public.texts for delete to authenticated
  using (owner = (select auth.uid()));

-- Generic "owns the row" policies for the per-user tables.
do $$
declare t text;
begin
  foreach t in array array['decks','notes','cards','revlog','skill_progress','pinyin_exposure','user_settings']
  loop
    execute format($f$
      create policy "select own" on public.%1$I for select to authenticated
        using (user_id = (select auth.uid()));
      create policy "insert own" on public.%1$I for insert to authenticated
        with check (user_id = (select auth.uid()));
      create policy "update own" on public.%1$I for update to authenticated
        using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
      create policy "delete own" on public.%1$I for delete to authenticated
        using (user_id = (select auth.uid()));
    $f$, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- New-user provisioning: default settings, a deck, and the 4 skill rows.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  insert into public.decks (user_id, name) values (new.id, 'Mandarin') on conflict do nothing;
  insert into public.skill_progress (user_id, modality) values
    (new.id, 'reading'), (new.id, 'listening'), (new.id, 'speaking'), (new.id, 'writing')
    on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Seed the note types (global). A vocab note spawns a recognition card
-- (reading) and a production card (typed writing) — sentence-context cards.
-- ----------------------------------------------------------------------------
insert into public.note_types (id, name, fields_json, card_templates_json) values
(
  'zh-vocab',
  'Mandarin vocabulary (sentence context)',
  '["simplified","pinyin","english","sentence_zh","sentence_en","audio_key"]'::jsonb,
  '[
     {"name":"Recognition","modality":"reading","front":"sentence_zh","back":"english"},
     {"name":"Production","modality":"writing","front":"sentence_en","back":"sentence_zh"}
   ]'::jsonb
)
on conflict (id) do nothing;
