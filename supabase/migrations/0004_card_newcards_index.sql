-- ============================================================================
-- S6 — index for the "new cards" gating query (additive; never edits an
-- applied migration). getConceptSession / getImportedSession select the next
-- new cards with:
--   where user_id = ? and fsrs_state = 'new' and suspended = false [and concept_id ...]
--   order by created_at
-- The existing cards_user_due_idx (user_id, suspended, due_at) serves the DUE
-- query but not this one (different filter + sort key). This index matches it.
--
-- KEEP only if EXPLAIN shows the planner uses it (see the statements provided
-- with this target). On a small cards table Postgres may prefer a seq scan; the
-- index pays off as the deck grows.
-- ============================================================================

create index if not exists cards_user_state_created_idx
  on public.cards (user_id, fsrs_state, created_at);
