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
