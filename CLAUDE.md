# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Next.js 16 + Turbopack.** APIs differ from older Next: `params`/`searchParams`/`cookies()`/`headers()` are async (await them); middleware is renamed to `proxy.ts`; `next lint` is removed. Read `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` before writing Next code.

## What this is

A phone-first PWA + companion website that teaches Mandarin from zero knowledge. Next.js 16 (App Router, TS) + Tailwind v4 + Supabase (Postgres/Auth/Storage with RLS) + `ts-fsrs`. All learning state lives in Supabase so it syncs across devices.

## Commands

```bash
npm run dev          # dev server (uses 3001 if 3000 is taken)
npm run build        # production build — ALSO the type-check (tsc runs here; there is no separate typecheck script)
npm test             # vitest run (all tests)
npx vitest run lib/srs/fsrs.test.ts   # a single test file
npx vitest run -t "name of test"      # tests matching a name
npm run lint         # eslint
npm run icons        # regenerate PWA icons (scripts/gen-icons.mjs)
```

### Data pipeline (ETL — run in order; needs `.env.local`)
```bash
npm run etl                 # v1 data: download+build+LOAD CC-CEDICT, HSK, frequency, Tatoeba into Supabase
npm run etl:graph:download  # v2 concept-graph raw data (Unihan, cjk-decomp, radicals)
npm run etl:graph:build     # parse -> data/out/{components,characters,words}.ndjson
npm run etl:graph:compile   # compile concept DAG, assert acyclic, print teaching order
npm run etl:graph:load      # load components/characters/words/concepts into Supabase
```
`etl:graph:build` depends on `etl:build`'s `data/out/dictionary.ndjson`. `data/` and `reference/` are git-ignored. Verify gating against live data with `npx tsx scripts/verify-coldstart.ts`.

## The one rule that outranks everything: NO FABRICATION

Every Chinese-language fact (definition, pinyin, tone, HSK tag, frequency, decomposition) comes ONLY from authoritative datasets — never from an LLM or a guess. Sources: CC-CEDICT (definitions/pinyin), Unihan + cjk-decomp (radicals/strokes/decomposition), HSK list repo, Tatoeba (sentences). If a fact isn't in the data, it is marked unverified and not taught. Any LLM feature must be RAG-constrained to the learner's taught vocabulary and validated by `assertOnlyTaught` before display (see `lib/explain/llm.ts`, currently off without `ANTHROPIC_API_KEY`).

## Architecture (the parts that span files)

### Concept graph + prerequisite gating (the core)
The curriculum is a DAG of ~20k concepts in the `concepts` table: `phoneme → component → character → word` (tiers 0–3), each with `prereq_ids` and a global `teaching_order`. **`lib/graph/gate.ts` is the single gating authority** — `isUnlocked`, `allowedVocabulary`, `nextConcepts`, `assertOnlyTaught`. Pure, testable logic lives in `lib/graph/logic.ts`.

**THE invariant (enforce server-side, everywhere): never show, quiz, or ask about a concept before its prerequisites are mastered, and never surface a token the learner hasn't been taught.** `assertOnlyTaught(userId, text)` tokenizes any candidate text and rejects untaught tokens; it gates cards, reader text, and any LLM output. Tests in `lib/graph/logic.test.ts` prove no untaught token can pass.

### Mastery fused with FSRS
`lib/srs/fsrs.ts` wraps `ts-fsrs` (MIT; tracks the same FSRS-6 engine Anki uses). A concept's mastery `status` (0–5) is **derived from its FSRS card state** by `lib/srs/status.ts` (4 = familiar = "mastered" for gating). Status is stored in `concept_progress` and drives both the gate (≥4 unlocks dependents) and pinyin fading (`lib/pinyin/fading.ts`: pinyin fades only once a character's own status ≥ 4, and re-appears if it drops). `lib/graph/mastery.ts` is the source-of-truth per-character/word status map.

### Data model & migrations
Mirrors Anki: `notes` (content) are separate from `cards` (scheduled items) with a `revlog`. Concept cards link via `cards.concept_id`. **Migrations in `supabase/migrations/` are additive and applied manually by the user in the Supabase SQL Editor — never edit an applied migration; add a new numbered one.** (0001 init, 0002 concept graph, 0003 concept cards.) Loaders bypass RLS via the service-role key.

### Server actions
All study logic is server actions in `app/actions/` (`lesson`, `session`, `review`, `mine`, `topics`, `drills`, `progress`). Each re-derives the user via `lib/require-user` (`requireUser`) and trusts nothing from the client. `getConceptSession` cold-starts a new account at phonology, tops up new concepts via `nextConcepts` (gated), and interleaves card types. `introduceConcept` creates the note + card(s) + `concept_progress` row with the breakdown. `progress.getSkillStats` feeds the dashboard from real mastery (mastered char/word counts + HSK band from mastered words), not an XP heuristic.

### Teaching content that is authored vs. sourced
Sourced (from data): definitions, pinyin, tones, decomposition, HSK/frequency, example sentences. Authored (curated, allowed because they aren't word-facts): function-word usage notes (`lib/explain/context.ts`), topic membership (`lib/topics.ts`), emoji picture-words (`lib/visuals/emoji.ts` — public-domain pictographs), and the short reader passages (`lib/seed/reader.ts`, labelled illustrative). The reader's tap sheet shows the whole-sentence meaning + a usage note so words are never explained in isolation. Tone-pair example words (`/tones`) are pulled from CC-CEDICT so tones are never invented.

### Conventions & gotchas
- **PWA is hand-written** (`public/sw.js` + `app/manifest.ts`), not Serwist — Serwist needs webpack and conflicts with Next 16's Turbopack build.
- `@node-rs/jieba` is server-only (in `next.config.ts` `serverExternalPackages`); `lib/segment/jieba.ts` and other `server-only` modules must not be imported by client components (type-only imports are fine).
- `reference/` holds Anki/Firecrawl/etc. as **read-only reference (AGPL/GPL)** — study behavior, never copy code into the app; it's git-ignored and never shipped.
- `lib/supabase/env.ts` `hasSupabaseEnv()` treats blank/`REPLACE_ME` values as unconfigured so the app boots into a setup screen instead of crashing.
- Visuals use Unicode emoji (`lib/visuals/emoji.ts`) — public-domain pictographs, zero licensing/storage.
- TTS is behind a provider interface (`lib/tts/`): edge-tts in dev, Azure later.
- FSRS parameter re-optimization is intentionally deferred: `ts-fsrs` ships no optimizer, but every review is logged to `revlog` (the data a future optimizer needs is already captured).
- New screens: `/reader` is a text picker (or the reader when `?id=` is set), `/topics`, `/tones` (pitch diagrams). Home links them.
