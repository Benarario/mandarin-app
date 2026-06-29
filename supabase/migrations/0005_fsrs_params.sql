-- ============================================================================
-- P5 — per-user FSRS parameters (additive; never edits an applied migration).
-- Personalized FSRS-6 weights, retrained from the user's revlog by the batch
-- job (scripts/fsrs/optimize.ts). NULL = use the ts-fsrs default weights.
-- `desired_retention` already exists (0001_init); this adds the weight vector.
-- ============================================================================

alter table public.user_settings
  add column if not exists fsrs_params jsonb;
