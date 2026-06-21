-- ============================================================================
-- v2 Concept Graph — additive migration (never edits 0001_init.sql).
-- The prerequisite-gated curriculum DAG: phonology → components → characters →
-- words. Nothing may be taught/quizzed before its prerequisites are mastered.
-- ============================================================================

-- ── Reference data (loaded by the ETL; readable by any signed-in user) ──

create table if not exists public.components (
  char            text primary key,
  gloss           text,
  radical_number  smallint,
  source          text not null,
  license         text not null
);

create table if not exists public.characters (
  char                   text primary key,
  pinyin                 text,
  glosses                text[] not null default '{}',
  radical_number         smallint,
  radical_char           text,
  stroke_count           smallint,
  grade                  smallint,
  component_chars        text[] not null default '{}',  -- prerequisite components
  freq_rank              integer,
  hsk_band               smallint,
  decomposition_verified boolean not null default false,
  verified               boolean not null default false,
  image_url              text,
  mnemonic_image_url     text,
  source                 text not null,
  license                text not null
);
create index if not exists characters_freq_idx on public.characters (freq_rank);

create table if not exists public.words (
  simplified      text primary key,
  pinyin          text,
  glosses         text[] not null default '{}',
  character_chars text[] not null default '{}',  -- prerequisite characters
  hsk_band        smallint,
  freq_rank       integer,
  image_url       text,
  dictionary_id   bigint references public.dictionary (id),
  verified        boolean not null default true,
  source          text not null,
  license         text not null
);
create index if not exists words_hsk_freq_idx on public.words (hsk_band, freq_rank);

-- The unified DAG node table. id is e.g. 'phon:tone1', 'comp:女', 'char:你', 'word:我们'.
create table if not exists public.concepts (
  id             text primary key,
  type           text not null check (type in ('phoneme','component','character','word','grammar','topic')),
  tier           smallint not null,
  ref            text not null,            -- phoneme id / component / character / word
  label          text not null,
  gloss          text,
  prereq_ids     text[] not null default '{}',
  teaching_order integer not null          -- global canonical order (lower = earlier)
);
create index if not exists concepts_order_idx on public.concepts (teaching_order);
create index if not exists concepts_tier_idx on public.concepts (tier, teaching_order);

create table if not exists public.topics (
  id                 text primary key,
  name               text not null,
  stage              smallint,
  description        text,
  member_concept_ids text[] not null default '{}'
);

-- ── Per-user mastery of each concept (drives gating + fading) ──
-- status: 0 unknown · 1-3 learning · 4 familiar · 5 strong · 98 ignored · 99 well-known
create table if not exists public.concept_progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  concept_id    text not null references public.concepts (id) on delete cascade,
  status        smallint not null default 0,
  fsrs_card_id  uuid references public.cards (id) on delete set null,
  introduced_at timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (user_id, concept_id)
);
create index if not exists concept_progress_user_status_idx on public.concept_progress (user_id, status);

-- ── Row-Level Security (same pattern as 0001) ──
alter table public.components       enable row level security;
alter table public.characters       enable row level security;
alter table public.words            enable row level security;
alter table public.concepts         enable row level security;
alter table public.topics           enable row level security;
alter table public.concept_progress enable row level security;

create policy "read components" on public.components for select to authenticated using (true);
create policy "read characters" on public.characters for select to authenticated using (true);
create policy "read words"      on public.words      for select to authenticated using (true);
create policy "read concepts"   on public.concepts   for select to authenticated using (true);
create policy "read topics"     on public.topics     for select to authenticated using (true);

create policy "select own progress" on public.concept_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy "insert own progress" on public.concept_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update own progress" on public.concept_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own progress" on public.concept_progress for delete to authenticated
  using (user_id = (select auth.uid()));
