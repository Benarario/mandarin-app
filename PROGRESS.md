# PROGRESS — Speed & Pedagogy passes

Running review log. One section per target: baseline → change → result.

Measurement notes:
- **Client JS** is measured with `node scripts/perf/bundle-sizes.mjs` after a build
  (raw + gzip; gzip ≈ transfer cost). Next 16's non-interactive build output omits the
  per-route size table, so we measure built chunks directly and attribute the heavy ones.
- Measured against a **`next build --webpack`** build for stable, comparable numbers across
  the pass (production deploys use Turbopack; relative deltas are what matter here).
- **Lighthouse** (mobile, by you): home, /review, /reader, /dashboard — FCP / LCP / TBT / total JS.
- **Server timing**: `lib/perf/timing.ts` logs `[perf] <label> <ms>` around hot Supabase
  queries + jieba/annotate. On in dev; in prod set `PERF_LOG=1`. Pure pass-through when off.

---

## Target 0 — Baseline & measurement

**Tooling added**
- `@next/bundle-analyzer`, wired into `next.config.ts` **only when `ANALYZE=true`** (it injects a
  webpack config, which would break the default Turbopack build). Run `npm run analyze`
  (`ANALYZE=true next build --webpack`) → treemap in `.next/analyze/`.
- `scripts/perf/bundle-sizes.mjs` — reproducible per-chunk raw/gzip measurement.
- `lib/perf/timing.ts` + instrumentation of the hot paths in `app/actions/session.ts`
  (due/fresh card queries, `nextConcepts`, `annotateMany`, char-status map) and
  `app/reader/page.tsx` (global texts fetch, jieba coverage, annotate).

**Baseline — client JS (webpack build)**

| Metric | Raw | Gzip |
|---|---|---|
| **Total client chunks** (36 files) | 1503.7 KB | 454.4 KB |
| `499-*.js` ← **recharts** (only `/dashboard` uses it) | 337.8 KB | **99.5 KB** |
| `4bd1b696-*.js` (React vendor) | 195.2 KB | 61.4 KB |
| `794-*.js` | 217.0 KB | 59.4 KB |
| `framework-*.js` | 185.2 KB | 58.4 KB |
| `845-*.js` | 183.7 KB | 50.8 KB |
| `main-*.js` | 134.6 KB | 38.8 KB |
| `polyfills-*.js` | 110.0 KB | 38.7 KB |

Key finding: **Recharts (99.5 KB gz) is the single largest chunk** and is pulled into the
initial load wherever its containing chunk is referenced — only `/dashboard` needs it. → **S1**.

**Baseline — Lighthouse (mobile)**

| Route | Perf | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|
| `/` (home) | 96 | 1.2 s | 2.3 s | 160 ms | 0 | 2.3 s |
| `/review` | 96 | 1.0 s | 1.6 s | 40 ms | 0 | 4.9 s |
| `/reader` | 97 | 1.4 s | 2.3 s | 90 ms | 0 | 3.5 s |
| `/dashboard` | 90 | 0.8 s | 1.3 s | **360 ms** | 0 | 3.8 s |

Home also: Accessibility 89, Best Practices 100, SEO 100.

Reads cleanly against the S1 plan: **`/dashboard` has by far the worst TBT (360 ms)** and the
lowest Perf (90) despite a fast FCP/LCP — classic symptom of a heavy JS chunk (Recharts,
99.5 KB gz) blocking the main thread after paint. S1 should cut dashboard TBT.

**Server-timing** — sample from a dev `/review` load and `/reader` load to be captured with
`PERF_LOG`/dev logs during the relevant targets (S3 will act on the jieba/annotate numbers).

**Risk/tradeoff:** none — measurement only; no learning behavior changed. The analyzer is
opt-in so the normal Turbopack build is unaffected.

---

## S1 — Lazy-load Recharts on /dashboard

**Baseline:** Recharts (`499-*.js`, 337.8 KB raw / **99.5 KB gz**) shipped as a synchronous
chunk in `/dashboard`'s initial load. `/dashboard` had the worst Lighthouse TBT (360 ms) and
lowest Perf (90) despite fast FCP/LCP — main-thread blocked after paint.

**Change:** extracted the chart into `components/SkillSparkline.tsx` and import it from
`SkillDashboard.tsx` via `next/dynamic(..., { ssr: false })`, with a `loading` placeholder
inside the existing `h-16` wrapper (no layout shift). `ssr:false` is valid here because
`SkillDashboard` is a Client Component (per Next 16 lazy-loading guide).

**Result (proof Recharts left the initial load):**
- `react-loadable-manifest.json` now has the dynamic boundary
  `components/SkillDashboard.tsx -> @/components/SkillSparkline`.
- The `/dashboard` page chunk contains **0** occurrences of `recharts` (was pulled in via the
  shared `499` chunk before).
- The recharts chunk renamed `499-*.js` → `499.*.js` (webpack async-chunk marker): it is now
  fetched on demand, after the dashboard renders, instead of blocking initial load.

| | Before | After |
|---|---|---|
| Recharts in `/dashboard` initial JS | yes (99.5 KB gz, blocking) | **no** (deferred, on-demand) |
| Total app chunk JS (all routes) | 454.4 KB gz | 455.6 KB gz (+1.2 KB split overhead) |
| `/dashboard` initial JS | — | **−~99.5 KB gz** (recharts deferred) |

Total bytes are ~unchanged by design (code is split, not removed); the win is `/dashboard`'s
**initial** JS and main-thread work. Expected Lighthouse effect: dashboard TBT drops from
360 ms. _Re-confirm TBT via Lighthouse once this branch is deployed._

**Risk/tradeoff:** the sparkline now renders a beat after the cards (placeholder reserves its
space, CLS stays 0). No data/behavior change. Build + 29 tests green.

---

## S2 — Pre-generate review audio into Supabase Storage (CDN)

**Baseline:** every 🔊 tap hit `/api/tts`, which synthesized via edge-tts on the server on
first play (slow first tap; repeated cost; depends on edge-tts working wherever the function
runs — uncertain on Vercel).

**Change (keeps the TtsProvider interface):**
- New public Storage bucket **`tts`** (created idempotently via the service role).
- `lib/tts/storage.ts`: deterministic object key `sha256("<voice>:<text>").mp3`, public-URL
  builder, bucket ensure + upload. `lib/supabase/admin.ts`: service-role client.
- `scripts/tts/pregen.ts` (`npm run tts:pregen`): batch-synthesizes the review-queue texts
  (characters + words in teaching order + tone examples) and uploads MP3s. Idempotent
  (skips clips already in the bucket); `TTS_LIMIT` controls how many concepts.
- `AudioButton`: tries the **CDN clip first** (no synthesis), falls back to `/api/tts`.
- `/api/tts`: still the fallback, but now also **uploads** what it synthesizes, so the bucket
  self-warms for every device.

**Result:**
- Bucket created; warmed **154 clips** (`TTS_LIMIT=150` + tone examples), generated 154 / failed 0.
- Verified `妈` served from the CDN: `HTTP 200`, `audio/mpeg`, 6048 bytes, at the exact URL the
  browser computes (node `sha256` ≡ browser `crypto.subtle` digest).
- Audio for pre-generated clips is now a **static CDN GET (0 synthesis, cacheable, offline via
  SW)** instead of a server edge-tts call. Cold clips fall back to `/api/tts` once, then are
  served from the CDN thereafter.
- Extend coverage anytime with `TTS_LIMIT=2000 npm run tts:pregen`.

**Risk/tradeoff:** cold (not-yet-generated) clips cost one extra failed CDN request before the
`/api/tts` fallback — negligible, and self-heals as the bucket warms. No learning behavior or
spoken text changed (same sourced text, same voice). Build + 29 tests green.

---

## S3 — Cache jieba segmentation in the ETL

**Baseline:** every `/reader` request ran live `@node-rs/jieba`:
- picker → `coverageOf` segmented **all** library lines on every load;
- open-a-text → `annotateMany` segmented the passage **and** ran a CC-CEDICT lookup query.

**Change:** `etl:reader` now precomputes each line's annotated tokens (jieba segmentation +
best-reading CC-CEDICT pinyin/gloss) and stores them in `texts.segmented_json.lines[].tokens`.
The reader renders from these cached tokens; coverage reads token `isWord` flags. Live jieba is
reserved for true tap-to-define mining (`addWordToDeck`/`mineSentence`/`assertOnlyTaught`) and
review-card annotation, untouched. Seed-text fallback still segments live if a text has no
cached tokens.

**Result:**
- Re-ran `etl:reader`: 70 sets, **813/813 lines cached with tokens**, 856 unique words annotated.
- Sample (sourced, not fabricated): `欢迎` → `pinyin "huān yíng"`, `gloss "to welcome"`.
- Picker: live jieba over all 813 lines measured at **6.1 ms** — now **0** (reads cached flags).
- Open-a-text: removes the live jieba pass **and** the per-open CC-CEDICT `annotateMany` DB
  round-trip — the larger latency win, plus it avoids triggering jieba's dictionary load on the
  reader path on cold serverless instances.

**Risk/tradeoff:** pinyin/gloss are baked at build time — re-run `npm run etl:reader` if CC-CEDICT
changes. Tokens reproduce `annotate()` exactly (same shape, same best-reading-by-freq choice), so
rendering is identical. No fabrication (facts from CC-CEDICT), no gating change (reader text was
never gated). Build + 29 tests green.

---

## S4 — Service worker: pre-cache shells + cap runtime caches

**Baseline:** SW (`v2`) pre-cached only `/` on install; `DICT_CACHE` and `AUDIO_CACHE` grew
**unbounded** (every distinct dict lookup / audio clip cached forever → storage bloat on a phone).

**Change (`public/sw.js` → `v3`):**
- Install now warms the core navigations `["/", "/review", "/reader", "/dashboard"]`, each added
  individually with a `catch` so an auth redirect (when signed out) doesn't abort the others.
- Added `LIMITS = { dict: 300, audio: 150 }` with `trim()` (evict oldest beyond the cap;
  `cache.keys()` is insertion-ordered) called after every write, plus `touch()` (re-insert on a
  cache hit → most-recently-used) so eviction is **LRU**, not just FIFO. Applied to `cacheFirst`
  (audio) and `staleWhileRevalidate` (dict).
- `VERSION` bump retires the old `v2` caches via the existing `activate` cleanup.

**Result:**
- Offline cold-open now covers Review/Reader/Dashboard, not just Home.
- `DICT_CACHE` ≤ 300 entries, `AUDIO_CACHE` ≤ 150 — bounded storage, LRU eviction.
- `node --check public/sw.js` passes; build + 29 tests green.

**Risk/tradeoff:** install-time shell fetches send cookies, so a signed-out install caches the
login redirect under those routes; it's corrected on the first online authed visit
(`networkFirstShell` refreshes on every success). Note from S2: pre-generated audio is now served
from the cross-origin Supabase CDN, which the SW doesn't cache — so `AUDIO_CACHE` mainly holds
`/api/tts` fallbacks. Restoring full offline audio for CDN clips (caching that origin) is a
possible follow-up, out of S4's scope. No learning behavior changed.

---

## S5 — /api/dict on the edge + Supabase preconnect

**Baseline:** `/api/dict` (tap-to-define lookup) ran on the Node.js runtime; cross-origin Supabase
(CDN audio + API) connections were established lazily on first use.

**Change:**
- `app/api/dict/route.ts`: `export const runtime = "edge"`. Verified the chain is edge-safe —
  `lookup.ts` → `@supabase/ssr` + `next/headers` (fetch-based, no Node APIs), no jieba/`node:*`.
  Kept the **authenticated** cookie client because the `dictionary` RLS policy is
  `to authenticated using (true)` — an anon client would read nothing.
- `app/layout.tsx`: `<link rel="preconnect">` + `dns-prefetch` to the Supabase origin in `<head>`,
  warming TLS for CDN audio and API calls before first use.

**Result:**
- Build marks `ƒ /api/dict` as edge and compiles clean (the edge build is itself the
  edge-compatibility proof — an incompatible import would fail the build). 29 tests pass.
- Expected: lower cold-start + execution at an edge POP near the user → faster tap-to-define;
  first audio/API hit skips DNS+TLS setup. (Edge latency is verifiable once deployed.)

**Risk/tradeoff:** edge has no Node APIs (none used). Response is unchanged (same authed query,
same RLS, same `Cache-Control` + SW SWR caching). No learning behavior changed.

---

## S6 — Index for the new-cards gating query

**Finding:** the three indexes the spec named **already existed** —
`concept_progress(user_id, status)` (`0002:85`), `concepts(teaching_order)` (`0002:63`), and
`cards(user_id, concept_id)` (`0003:9`, the correct composite shape since every query filters
`user_id` first). So those would be no-ops. The one genuinely-missing index was for the
**new-cards** query (`user_id` + `fsrs_state='new'`, ordered by `created_at`), which the existing
`cards_user_due_idx (user_id, suspended, due_at)` doesn't serve.

**Change:** `0004_card_newcards_index.sql` →
`create index cards_user_state_created_idx on cards (user_id, fsrs_state, created_at)`.
Applied manually in the SQL Editor; kept only after `EXPLAIN` confirmed it's used.

**Result (EXPLAIN ANALYZE, reviewer-run):**

| | Plan | Exec |
|---|---|---|
| Before | `Seq Scan` + `Sort (quicksort) Sort Key: created_at` | 0.404 ms |
| After | `Index Scan using cards_user_state_created_idx`, `Index Cond (user_id, fsrs_state='new')`, **no sort** | 0.223 ms |

The planner chose the index unaided (no `enable_seqscan` coercion), and it **removed the explicit
sort** — exactly the intended win, and it scales with deck size. **Kept.**

**Risk/tradeoff:** one more index to maintain on writes — negligible. Purely a read-path
optimization; no behavior change. Build + 29 tests green.

---

## Pass 1 — Summary (speed)

All six targets landed on `perf/speed-pass`, one commit each, build + 29 tests green throughout,
**no learning behavior changed**.

| Target | Win |
|---|---|
| T0 | Baseline: 454.4 KB gz total client JS; Lighthouse mobile (dashboard TBT 360 ms worst); timing + analyzer tooling. |
| S1 | Recharts (99.5 KB gz) removed from `/dashboard` initial JS → lazy chunk; targets the 360 ms TBT. |
| S2 | Review audio served from Supabase Storage CDN (154 clips warmed); first-tap synthesis eliminated for warmed clips. |
| S3 | Reader passages render from ETL-cached tokens → 0 live jieba + 0 dict round-trip on the passage path (was ~6 ms jieba + a DB query). |
| S4 | SW pre-caches Review/Reader/Dashboard shells; DICT/AUDIO caches LRU-capped (300/150) — bounded storage. |
| S5 | `/api/dict` on the edge; Supabase preconnect/dns-prefetch. |
| S6 | New-cards gating query: `Seq Scan + Sort` → `Index Scan`, sort eliminated (EXPLAIN-verified). |

**To re-confirm on-device (reviewer):** deploy `perf/speed-pass` and re-run Lighthouse — expect
`/dashboard` TBT to drop materially (S1) and faster tap-to-define (S5). Optionally warm more audio
with `TTS_LIMIT=2000 npm run tts:pregen`.

Speed pass merged to `master` and deployed to production before starting Pass 2.

# ===================== PASS 2 — PEDAGOGY =====================

## P1 — Comprehensible-input layer (i+1 reading + audio)

**Goal:** surface graded passages at ~70–80% known-word coverage (the comprehensible-input
sweet spot) using the learner's gate-derived vocabulary, with audio. Existing sourced passages
only — no new Chinese facts.

**Change:**
- `lib/reader/recommend.ts` (pure, tested): `recommendForYou(scored, band)` picks passages with
  coverage in `[60, 90]` ranked by closeness to ideal 78, falling back to the easiest few for a
  near-beginner. 4 unit tests (`recommend.test.ts`).
- `app/reader/page.tsx`: picker now shows a **"For you"** section (the i+1 picks) above **"All
  texts"**. Coverage is computed from cached tokens (S3) against the gate's mastered vocab
  (`status ≥ 4`) — no live jieba.
- `components/ReaderView.tsx`: a **per-line audio** button (🔊) speaking the line's sourced text,
  via the S2 CDN-first `AudioButton` (cold sentences fall back to `/api/tts`, then self-warm).

**Gating + no-fabrication proof:**
- **No untaught-token leak:** P1 neither quizzes nor creates cards. It only *ranks* existing
  passages by coverage and *plays* their existing text. Word taps still flow through the existing
  gated paths (`mineSentence` runs `assertOnlyTaught` and tags out-of-vocabulary sentences
  `stretch`). The reader is extensive-reading *input* (unknown words are expected and tappable,
  by design) — nothing here surfaces a concept as taught/quizzed before its prerequisites.
- **No fabricated facts:** passages are sourced Tatoeba sentences; audio is TTS of that exact
  text; coverage uses gate status. `recommendForYou` introduces zero Chinese facts.

**Result:** the reader leads with level-matched passages instead of a flat coverage sort; each
line is listenable. Build + **33 tests** (4 new) green.

**Risk/tradeoff:** sentence audio isn't pre-warmed (S2 warmed words/chars), so the first play of a
given line synthesizes via `/api/tts` then caches to the CDN — one slow first tap per sentence.

## P2 — Tone-perception (HVPT) drills

**Goal:** ear-training drills — "which tone did you hear?" and minimal-pair discrimination —
using existing edge-tts audio + CC-CEDICT words. No Azure. Wired into `/tones`.

**Change:**
- `app/actions/drills.ts` → `getToneDrills()`: builds single-syllable "which tone" items and
  minimal-pair families (same toneless base, contrasting tones) from the learner's **taught**
  single-syllable vocabulary (`allowedVocabulary`) plus the canonical Stage-0 contrast families
  (妈/麻/马/骂, 八/拔/把/爸). Tone parsed from `pinyin_numbered`, base via `parseSyllable`,
  gloss/pinyin from CC-CEDICT; proper-noun (capitalised) readings skipped.
- `components/ToneDrills.tsx`: client widget with two modes — hear a clip then pick the tone
  (1–4, with `PitchContour`), or pick which minimal-pair word was played. Immediate feedback +
  running score; audio via the S2 CDN-first `AudioButton` (word hidden until answered).
- `app/tones/page.tsx`: renders `<ToneDrills>` under the existing tone-pair grid.

**Gating + no-fabrication proof:**
- **No untaught-token leak:** drill words come from `allowedVocabulary` (taught, status ≥ 1),
  plus the Stage-0 canonical tone examples that `/tones` already shows non-gated as phonology
  illustration (sanctioned, pre-vocabulary). No cards/FSRS are created; it's ephemeral perception
  practice, so there's no path to schedule/quiz an untaught concept.
- **No fabricated facts:** verified against live data — `ba`: 八bā/拔bá/把bǎ/爸bà; `ma`:
  妈mā/麻má/马mǎ/骂mà. Every tone/pinyin/gloss is read from CC-CEDICT; the drill invents nothing.

**Result:** `/tones` now has an interactive ear-trainer. Build + 33 tests green.

**Risk/tradeoff:** the Stage-0 seed families are surfaced even to a brand-new learner (consistent
with the existing non-gated tone examples on `/tones`); if you want *strictly* taught-only words,
say so and I'll drop the seed. Drill clips for taught words may need one on-demand synth before
they're CDN-cached.

## P3 — Interference-aware scheduling

**Goal:** when `getConceptSession` tops up new concepts, don't introduce two visually-confusable
characters in the same session (use the component graph for visual similarity), and flag known
confusion-pairs for contrast practice.

**Change:**
- `lib/graph/interference.ts` (pure, 10 tests): `visualComponents` (reads a concept's `comp:`
  prereqs — a char's components live right in `prereq_ids`, e.g. `char:是 → comp:日`),
  `confusable` (overlap-coefficient ≥ 0.5 — catches shared-phonetic look-alikes 请/清/晴 and
  near-identical 是/时), `selectNonInterfering` (greedy: pick up to the budget with no two chosen
  confusable, defer the rest), `confusionPairs`.
- `app/actions/session.ts`: top-up now pulls a **wider gated frontier** (`nextConcepts(budget*3)`)
  then introduces `selectNonInterfering(candidates, budget).chosen`.
- `app/actions/drills.ts` → `getConfusionPairs()`: confusable pairs among the learner's taught
  characters (component graph) with CC-CEDICT pinyin/gloss — the "flag".
- `components/SkillDashboard.tsx`: an **"Easily confused"** strip on Progress showing those
  look-alike pairs side by side with 🔊 to compare (the contrast surface).

**Gating + no-fabrication proof:**
- **No untaught-token leak / gating intact by construction:** interference logic only ever
  *reorders or defers* concepts that `nextConcepts` already returned (gated, unlocked) — `chosen`
  is always a subset of the gated frontier; nothing ungated is ever introduced. A deferred concept
  stays the next-in-order frontier and is introduced in a later session (nothing lost). The
  introduced count is still capped at `budget`. Cold start (phonemes — no components) is
  unaffected. Tests assert subset/defer/limit behavior.
- **No fabricated facts:** confusability is computed purely from the component graph
  (`prereq_ids`); `getConfusionPairs` reads pinyin/gloss from CC-CEDICT. Nothing invented.

**Result:** sessions spread visually-similar characters across days; the learner sees their own
confusable pairs on Progress. Build + **43 tests** (10 new) green.

**Risk/tradeoff:** when confusable items cluster in the frontier, a session may introduce slightly
fewer than `budget` new concepts (the deferred ones come next session) — intended. "Semantic"
confusability isn't implemented (no fabrication-free semantic source); visual (component-graph)
similarity is the signal, per the spec. Contrast practice is currently a compare-and-listen strip;
a graded contrast *drill* could consume `getConfusionPairs` later if wanted.

## P4 — Character production / handwriting recall

**Goal:** a recall card that prompts *production* of a character (write it from memory) with a
stroke/composition reveal. The retrieval attempt is the point; grading optional.

**Change:** upgraded the existing **character production card** (template 1, the "writing"
modality already in the deck) in `components/ConceptReview.tsx`:
- **Cue (front):** meaning + pinyin + 🔊 audio (not the character) and a prompt to write it.
- **Attempt:** `components/DrawCanvas.tsx` — a finger/mouse scratch pad with 米字格 guide lines,
  reset per card (`key={cardId}`). Purely a retrieval aid; nothing stored or graded.
- **Reveal:** the character (large) + its **component breakdown** ("Built from: 女 + 子") as the
  composition/writing scaffold + audio. Existing FSRS rating buttons remain (grading optional —
  the learner self-assesses their attempt).

Scoped to the `isWriting = isProduction && conceptType === "character"` branch only; word
production and all recognition cards are unchanged.

**Gating + no-fabrication proof:**
- **No untaught-token leak:** no new cards; the card reveals only its *own* character (already a
  taught/being-introduced concept) and that character's sourced component breakdown. Same gated
  pipeline, same scheduling — the change is purely the prompt/reveal UI.
- **No fabricated facts:** character, pinyin, gloss and breakdown all come from existing sourced
  note fields (CC-CEDICT / cjk-decomp). **No stroke-order data was invented** — the "stroke
  reveal" is the real glyph + component decomposition, not a fabricated stroke sequence. The
  canvas is just user ink.

**Result:** writing-modality reviews are now genuine handwriting recall. Build + 43 tests green.

**Risk/tradeoff:** without a licensed stroke-order dataset there's no animated stroke guidance —
the reveal shows the glyph + component breakdown instead. Adding animated stroke order would
require importing a permissively-licensed dataset (e.g. Make-Me-a-Hanzi) — a separate decision.

## P5 — FSRS personalization

**Goal:** a batch job that retrains FSRS parameters from `revlog` once enough reviews exist, plus
a user "desired retention" setting (0.8–0.9). Keep `ts-fsrs`; don't block on it shipping an optimizer.

**Found already done:** `desired_retention` is stored (`0001`), exposed via a Settings slider, and
**applied** in both review paths (`submitReview`, `submitConceptReview`). Verified — left as-is.

**Change (decision: plumbing + seam now; never store invented weights):**
- `0005_fsrs_params.sql`: additive `user_settings.fsrs_params jsonb` (NULL = ts-fsrs defaults).
- `lib/srs/fsrs.ts`: `getScheduler`/`review` accept optional per-user `weights`; applied only when
  valid (length 17/19/21, finite) via `generatorParameters({ w })`, else defaults. Scheduler cache
  keyed by (retention, fuzz, weights).
- `app/actions/{study,review}.ts`: pass `settings.fsrs_params` into scheduling (`review.ts` selects
  `*` so a not-yet-applied column can't error).
- `lib/srs/optimize.ts` (pure, tested): `summarizeReviews` (measured retention = pass-rate on
  mature reviews), `shouldOptimize` (gate at ≥1000), `isValidWeights`, and **`optimizeWeights` —
  the seam**, returns `null` today (ts-fsrs has no optimizer; a real fitter / fsrs-rs drops in here).
- `scripts/fsrs/optimize.ts` (`npm run fsrs:optimize`): per user, reads `revlog`, prints
  diagnostics, and stores weights only if `optimizeWeights` returns a valid vector (never otherwise).

**Gating + no-fabrication proof:**
- **No untaught-token leak / gating untouched:** P5 only changes *scheduling parameters* (retention,
  weights) — not what is unlocked or surfaced. `nextConcepts`/`assertOnlyTaught` are untouched.
- **No fabricated facts:** `optimizeWeights` returns `null` → no invented weights are ever stored;
  diagnostics come from the real `revlog`; weights are validated before use (invalid → defaults).

**Result:** ran `npm run fsrs:optimize` on live data — `reviews=23 mature=0 … ↳ need ≥1000 reviews,
keeping defaults` (correctly gated, stored nothing). Tests: gate, summary, validity, seam-returns-null,
and scheduler weight-application/fallback. Build + **50 tests** green.

**Risk/tradeoff:** real weight-fitting is **not active** — the seam returns null until a real
optimizer is wired (a from-scratch FSRS-6 fitter or an fsrs-rs/py-fsrs dependency), per your choice.
Migration `0005` should be applied in the SQL Editor before this branch deploys (code is resilient
if it isn't, but the column is needed to persist future fitted weights).

## P6 — Habit scaffolding (daily goal, streak, reminder)

**Goal:** a daily goal, a streak, and one optional reminder — purely motivational; must not alter
scheduling correctness.

**Change:**
- `lib/habit.ts` (pure, 6 tests): `computeHabit(timestamps, now)` → today's count, practice
  **streak** (consecutive days with ≥1 review; today-in-progress doesn't break it), and a 7-day strip.
- `app/actions/habit.ts` → `getHabitStats()`: **read-only** over `revlog` (last 90 days).
- `components/HabitWidget.tsx` (Home): 🔥 streak, today vs **daily goal** progress bar, 7-day strip,
  and an **optional reminder** (toggle + time) that shows a gentle in-app nudge when you open the app
  after that time without having met the goal. Goal + reminder are per-device (localStorage).

**Gating + no-fabrication proof:**
- **Scheduling untouched:** `getHabitStats` only `SELECT`s `revlog`; the widget only reads/writes
  `localStorage`. Nothing writes card/FSRS state or touches the gate — zero scheduling impact by
  construction.
- **No fabricated facts:** no Chinese-language facts are involved at all (just review timestamps).

**Result:** Home shows a streak + daily-goal ring + reminder. Build + **56 tests** (6 new) green.

**Risk/tradeoff:** the reminder is an in-app nudge (fires when the app is opened past the set time) —
true OS-scheduled push when the app is closed would need a push service (web-push + SW), deferred.
Goal/reminder are per-device (localStorage), not synced.

# ===================== PASS 2 — SUMMARY (pedagogy) =====================

All six targets on `feat/pedagogy-pass` (branched off the deployed `master` incl. Pass 1), one
commit each, build green throughout, **test count 33 → 56**. Every target proved gating-safe and
fabrication-free.

| Target | Feature | New logic tests | Gating/no-fab |
|---|---|---|---|
| P1 | Comprehensible-input "For you" (i+1) reader band + per-line audio | `recommend` (4) | ranks/plays sourced passages only; taps still gated |
| P2 | HVPT tone-perception drills on `/tones` | (uses tested `syllable`) | taught vocab + Stage-0 examples; tones from CC-CEDICT |
| P3 | Interference-aware scheduling + confusion-pair flag | `interference` (10) | `chosen ⊆ gated frontier`; similarity from component graph |
| P4 | Character handwriting-recall card | — (UI over existing cards) | reveals only the card's own sourced facts |
| P5 | FSRS personalization (per-user weights plumbing + seam) | `optimize` (6) + fsrs weights (1) | scheduling params only; no invented weights |
| P6 | Habit scaffolding (goal/streak/reminder) | `habit` (6) | read-only over revlog; no scheduling impact |

**Test coverage added in Pass 2:** 27 new unit tests (43 → 56 total at the file level after dedup),
concentrated on the gating/scheduling-adjacent logic (`recommend`, `interference`, `optimize`,
`fsrs` weights, `habit`).

**Migrations to apply before deploying `feat/pedagogy-pass`:** `0005_fsrs_params.sql` (P5). No other
schema changes. **Two follow-ups offered, not built:** a real FSRS optimizer to activate P5's seam,
and a graded contrast *drill* consuming P3's `getConfusionPairs`.
