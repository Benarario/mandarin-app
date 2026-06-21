-- ============================================================================
-- v2 Phase B — link the proven notes/cards/revlog SRS model to concept nodes,
-- and add note types for the new concept card kinds. Additive; edits nothing.
-- ============================================================================

-- A card may belong to a concept (phoneme/component/character/word).
alter table public.cards add column if not exists concept_id text
  references public.concepts (id) on delete cascade;
create index if not exists cards_concept_idx on public.cards (user_id, concept_id);

alter table public.notes add column if not exists concept_id text
  references public.concepts (id) on delete cascade;

-- New note types (extend, don't replace). Each spawns the listed cards.
insert into public.note_types (id, name, fields_json, card_templates_json) values
(
  'zh-phoneme',
  'Phonology (sound / tone)',
  '["label","note","example"]'::jsonb,
  '[{"name":"Recognition","modality":"listening","front":"label","back":"note"}]'::jsonb
),
(
  'zh-component',
  'Character component / radical',
  '["char","gloss"]'::jsonb,
  '[{"name":"Recognition","modality":"reading","front":"char","back":"gloss"}]'::jsonb
),
(
  'zh-character',
  'Character (字) with component breakdown',
  '["char","pinyin","english","components_json"]'::jsonb,
  '[
     {"name":"Recognition","modality":"reading","front":"char","back":"english"},
     {"name":"Production","modality":"writing","front":"english","back":"char"}
   ]'::jsonb
)
on conflict (id) do nothing;
