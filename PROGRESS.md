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
