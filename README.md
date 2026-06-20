# Mandarin — Personal Chinese Learning App

A phone-first Progressive Web App (PWA) + companion website for learning Mandarin Chinese,
built for one learner. It teaches through **spaced-repetition sentence cards**, a
**tap-to-define reader**, **progressive pinyin fading**, and a **four-skill progress
dashboard** — with one ironclad rule: **no fabricated facts**. Every definition, pinyin and
tone comes from an authoritative dataset, never from a language model's guess.

> **New here? Read [SETUP.md](./SETUP.md) first** — it walks you through the one-time setup in
> plain language.

## In plain language

The app is really a website that installs like an app. It runs locally (and later on Vercel),
stores your data in **Supabase**, and uses Microsoft neural voices for Chinese audio. Because
your data is in the cloud, your progress is identical on your phone, laptop, and any other
computer — you just open the same link and sign in.

## What's built (Phase 1 MVP)

- **Spaced repetition** with the **FSRS-6** algorithm (`ts-fsrs`, MIT) — four rating buttons
  (Again/Hard/Good/Easy), Anki's new → learning → review state machine, relearning on lapse,
  and a full review log so the schedule can be re-optimised from your own history later.
- **Sentence-context cards** (not isolated words): a vocab note spawns a recognition card and a
  typed-production card.
- **Tap-to-define reader** with `@node-rs/jieba` word segmentation and verified CC-CEDICT
  lookups; tap any word to add it to your deck.
- **Progressive pinyin fading**: pinyin fades per character as you master it (five modes).
- **Four-skill dashboard** (Reading / Listening / Speaking / Writing) with history charts.
- **Mandarin audio** via edge-tts (the same Microsoft voices Azure uses), behind a swappable
  provider interface.
- **Installable PWA** with offline caching of the review queue, dictionary lookups, and audio.
- **"Why you can trust this"** page citing every data source.

### Deferred to later phases
Azure pronunciation/tone scoring, tone-pair drills, content crawlers (Firecrawl /
lightnovel-crawler), Anki `.apkg` import, AI roleplay, YouTube/music/news study layer, and the
culture/idiom module. These are intentionally out of Phase 1.

## Data sources & licensing

| Data | Used for | License |
| --- | --- | --- |
| [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) | All definitions & pinyin | CC BY-SA 4.0 |
| [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | HSK 3.0 / 2.0 tags + frequency | see repo |
| [Tatoeba](https://tatoeba.org/) (via manythings.org) | Example sentences | CC BY 2.0 FR |

The exact license strings are captured at load time and shown on the in-app **/trust** page.

**Scheduler licensing:** the shipped scheduler is **`ts-fsrs` (MIT)**, which tracks the same
`fsrs-rs` crate Anki depends on. **Anki (AGPL-3.0) and AnkiDroid (GPL-3.0) were used only as a
behavioural reference** — their source lives in the git-ignored `/reference` folder and **none
of it ships** in this app. (Future note: if grammar content from the Chinese Grammar Wiki is
added, it is **CC BY-NC** — fine for personal, non-commercial use with attribution, but it
would need re-licensing if this app were ever monetised.)

## Tech stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage,
with Row-Level Security) · `ts-fsrs` · `@node-rs/jieba` · Recharts · a hand-written service
worker (no build-tool coupling).

## Project layout

```
app/                 Next.js routes (home, review, reader, dashboard, settings, trust, api/*)
app/actions/         Server actions (seed deck, build session, submit review, mine words)
components/          Client UI (ReviewSession, ReaderView, PinyinText, AudioButton, …)
lib/srs/             FSRS wrapper + validation tests
lib/dict/            CC-CEDICT lookup + the verification gate
lib/segment/         jieba segmentation
lib/pinyin/          numbered→diacritic conversion + fading logic
lib/tts/             text-to-speech provider interface (edge-tts now, Azure later)
scripts/etl/         download → parse → load the datasets
supabase/migrations/ database schema + RLS
reference/           Anki/Firecrawl/etc. — READ-ONLY reference, git-ignored, never shipped
```

## Common commands

```bash
npm run dev      # run the app locally
npm run build    # production build (type-check + compile)
npm test         # FSRS + pinyin unit tests
npm run etl      # download + parse + load all datasets into Supabase
npm run icons    # regenerate the PWA icons
```

## A note on the data model

The schema mirrors Anki's proven design: **notes** (content) are separate from **cards**
(scheduled items), with a separate **revlog**. One note can spawn several independently
scheduled cards, and the revlog preserves every review so FSRS parameters can be retrained from
real history.
