# Build Prompt for Claude Code — Personal Mandarin Chinese Learning App + Website

> **How to use this file:** Open Claude Code in an empty project folder, place the five uploaded zip files (`firecrawl-main.zip`, `lightnovel-crawler-dev.zip`, `Agent-Reach-main.zip`, `anki-main.zip`, `Anki-Android-main.zip`) in that folder, then paste this entire document as your first message. It is written as direct instructions to Claude Code. Build in the phased order at the end — do **not** try to build everything at once.
>
> **First step — unzip all five into `/tools/` as read-only reference, then read their licenses.** Two of them (`anki-main`, `Anki-Android-main`) are **copyleft-licensed reference source, NOT dependencies to copy from** — see Section 7A for the critical licensing rule before you use a single line of them.

---

## 0. Your role and mission

You are my senior full-stack engineer and Mandarin-pedagogy implementer. You are building a **personal Mandarin Chinese learning app and companion website** for one user (me). I am a **complete beginner, native English speaker**. I am **not technical** — explain setup steps in plain language, make sensible default choices for me, and never assume I know jargon.

Your build must be **evidence-based** (the pedagogy below is drawn from spaced-repetition and second-language-acquisition research) and **anti-fabrication** (the single most important rule in this document — see Section 3). When in doubt about a Chinese-language fact, you look it up in the authoritative data sources or you do not show it. You never invent grammar, definitions, tones, or etymology.

---

## 1. Who this is for (the learner profile — design around this)

- Complete beginner in Mandarin; native English speaker.
- **Phone-first.** I will mostly study on my phone in short, frequent sessions. The companion website is secondary but must exist and share the same data.
- **Simplified characters only.**
- **Goals:** reading + conversation are the priority, plus listening comprehension through music and audio. I love reading **web novels**. I may later work in import/trade with China, but mostly I enjoy the language and want real proficiency.
- **Recognition + pinyin typing is enough.** Do **NOT** build handwriting or stroke-order practice.
- Track my level separately across **four modalities: Reading, Listening, Speaking, Writing (typed)**.
- **Progressively reduce pinyin** as I improve, so I stop depending on it.
- **Varied learning modes** to prevent burnout.
- Integrate **web content**: YouTube transcripts, web novels, music lyrics, news (legal sources only — see Section 8).

---

## 2. Product definition (one paragraph)

A phone-first Progressive Web App (PWA) with a companion website, built from one codebase, that teaches Mandarin through **spaced-repetition review of sentence-context cards** (not isolated words), a **tap-to-define parallel reader** for real Chinese content, **pronunciation feedback**, **tone-pair drills**, and a **culture/idiom module** — all sequenced by **HSK level and word frequency**, with **progressive pinyin fading** and a **four-skill progress dashboard**. Every Chinese-language fact is grounded in authoritative, citable data. Content can be enriched legally from public-domain and openly-licensed sources using the three provided tools.

---

## 3. NON-NEGOTIABLE PRINCIPLE — NO FABRICATION

This rule outranks every other instruction in this document.

1. **Definitions and pinyin** come only from **CC-CEDICT** (or the Unihan database). Never let an LLM generate or guess a definition, reading, or tone. If a word is not in the dictionary, mark it "unverified" and do not teach it as fact.
2. **Grammar explanations** must be backed by an authoritative reference (the **Chinese Grammar Wiki** by AllSet Learning) and stored with a source link. If you cannot cite a grammar point, do not display an explanation for it.
3. **Idioms (chengyu) and culture facts** must store a verifiable source. Unsourced culture content is hidden, not shown.
4. **HSK level tags and frequency ranks** come only from the named datasets (Section 5). Do not estimate them.
5. Any **LLM-powered feature** (conversation roleplay, "explain this sentence," example generation) must use **Retrieval-Augmented Generation**: it pulls from the local dictionary/grammar database and is instructed to refuse to assert any grammar or vocabulary fact it cannot ground in that data. Build a system prompt for these features that says, in effect: *"Only state Chinese-language facts that appear in the provided dictionary/grammar context. If you are unsure, say so. Never invent characters, pinyin, tones, or definitions."*
6. A fabricated fact that I memorize through spaced repetition is **actively harmful and expensive to unlearn**. Validation before a card enters my deck is mandatory. When generating example sentences, prefer real sentences from **Tatoeba** (CC-licensed) or verified corpora over LLM-generated ones; if an LLM sentence is used, every word in it must validate against CC-CEDICT and it must be flagged as machine-generated.

Add a short "Why you can trust this" page in the app explaining that definitions come from CC-CEDICT, grammar from the Chinese Grammar Wiki, and frequency from published corpora, with links.

---

## 4. Technology stack and architecture

Use this stack. It is chosen to be cheap, low-maintenance, phone-first, and one codebase for app + website.

- **Framework:** **Next.js (React) configured as an installable PWA.** One codebase serves both the phone app (Add to Home Screen) and the companion website. Use the App Router, TypeScript, and a service worker for offline review caching. Include a web app manifest with icons so it installs cleanly on iOS and Android.
- **Backend + database + auth:** **Supabase** (managed Postgres, auth, storage, realtime). Free tier is plenty for one user. All learning state lives here so it syncs across every device.
- **Hosting:** **Vercel** (native Next.js host) on the free/hobby tier.
- **Mandarin text-to-speech (audio):** **Azure AI Speech** neural voices (`zh-CN-XiaoxiaoNeural` female, `zh-CN-YunyangNeural` male). Free tier = 0.5M characters/month — ample for one user. **Pre-generate and cache** audio for repeated content in Supabase storage to stay within limits. For local development without an account, you may use the open-source **edge-tts** (same Microsoft voices) — but note it uses an unofficial endpoint, so keep Azure as the production path.
- **Pronunciation feedback / speech recognition:** **Azure AI Speech — Speech-to-Text + Pronunciation Assessment** (free tier 5 audio hours/month), which returns Accuracy, Fluency, and Completeness sub-scores at word/phoneme level for Chinese. **Caveat to handle:** Azure's *Prosody* sub-score is currently English-only, so it will not score Mandarin tones directly. For tone feedback, additionally implement a simple **pitch-contour comparison** (compare the user's recorded pitch curve against the reference TTS audio's pitch curve) as a custom feature.
- **Offline:** cache the SRS review queue and dictionary lookups in the service worker / IndexedDB so reviews work without signal; sync to Supabase when back online.

**Plain-language summary for me (put a version of this in the README):** The app is really a website that installs like an app. It runs on Vercel, stores my data in Supabase, and uses Microsoft Azure for Chinese voices and pronunciation scoring. Because my data is in the cloud, my progress is identical on my phone, laptop, and any other computer — I just open the same link.

**iOS caveat to test early:** live microphone speech recognition inside an *installed* iOS PWA can be unreliable. Build the speaking feature so it degrades gracefully (e.g., falls back to recording-and-uploading audio for server-side scoring) and test it on a real iPhone in Phase 2 before depending on in-browser recognition.

---

## 5. Data foundation — ingest these FIRST (before any feature)

Set up an ETL step that downloads, parses, and loads these into Supabase. Store license metadata with each dataset.

1. **CC-CEDICT** — Chinese-English dictionary (the definition/pinyin backbone). Download from MDBG. Format is `Traditional Simplified [pin1 yin1] /gloss1/gloss2/`. **License: confirm whether it is CC BY-SA 3.0 or 4.0 (sources disagree) and store the correct attribution string.** Index by simplified headword.
2. **Unihan Database** (Unicode) — per-character properties; use as a secondary authority for single characters.
3. **HSK 3.0 vocabulary lists (2025 final version, 9 bands / 3 stages).** Use the **final 2025 lists, not the 2021 drafts** (they differ significantly). Also store a mapping to the older **HSK 2.0 (6 levels)** since most existing materials use it. Tag every dictionary word with its HSK band(s).
4. **Word/character frequency:** **Jun Da's Modern Chinese Character Frequency List** (characters) and **SUBTLEX-CH** (Cai & Brysbaert 2010, subtitle-corpus word + character frequency, CC-licensed — best proxy for spoken frequency). Tag every word with a frequency rank.
5. **Chinese Grammar Wiki** (AllSet Learning) — the grammar reference, organized by CEFR level (A1 → C1). **License: CC BY-NC (non-commercial). Fine for my personal, non-monetized use with attribution. If this app is ever monetized, grammar text must be re-authored or licensed.** Store grammar points with their level and source URL.
6. **Tatoeba** — CC-licensed Chinese↔English sentence pairs, for verified example sentences and sentence-mining seed material.

**Sequencing rule:** order what I learn by **HSK band first, then by frequency within the band.** Never present a raw alphabetical HSK list — frequency ordering is what makes the learning curve efficient.

---

## 6. Database schema (Supabase / Postgres) — mirror Anki's proven model

**Do not invent a card data model. Mirror Anki's battle-tested structure** (studied from `/tools/anki-main`, see Section 7A for the licensing rule — you are copying the *design*, not the code). The key idea you must replicate: **separate `notes` (the content) from `cards` (the scheduled items)**. One note can generate several cards (e.g. a vocab note produces a recognition card *and* a production card), and each card is scheduled independently. Keep a separate **review log** (`revlog`) so the scheduler can be re-optimized from real history — exactly as Anki does.

Core tables:
- `note_types` (id, name, fields_json, card_templates_json) — like Anki's notetypes; defines what fields a note has and which cards it spawns.
- `notes` (id, user_id, note_type_id, fields_json, tags[], source, license, **verified_bool**, dictionary_id?, sentence_id?, grammar_id?) — the content. `verified_bool` ties to the anti-fabrication gate.
- `cards` (id, note_id, user_id, template_index, modality [reading|listening|speaking|writing], **fsrs_stability, fsrs_difficulty, fsrs_state [new|learning|review|relearning], due_at, last_reviewed_at, reps, lapses, scheduled_days, elapsed_days**) — the scheduled items. These fields mirror what FSRS/Anki track.
- `revlog` (id, card_id, user_id, rating [1=again|2=hard|3=good|4=easy], reviewed_at, elapsed_ms, state_before, stability_after, difficulty_after) — one row per review, mirroring Anki's revlog columns so FSRS parameters can be retrained from my data.
- `decks` (id, user_id, name, parent_id, config_json) — supports nested decks and per-deck options (new/day, reviews/day, etc.), like Anki.
- `dictionary` (simplified, traditional, pinyin, pinyin_numbered, glosses[], hsk_30_band, hsk_20_level, freq_rank_subtlex, freq_rank_junda, source, license)
- `grammar_points` (id, title, cefr_level, summary, structure, examples[], source_url, license)
- `characters` (char, pinyin, radical, stroke_count, unihan_props, freq_rank)
- `sentences` (id, zh_text, en_text, source, license, difficulty_score, target_word_ids[])
- `texts` (id, title, type [novel|news|lyrics|youtube|user], language_level, source_url, license, full_text, segmented_json)
- `skill_progress` (user_id, modality, estimated_hsk_band, xp, history_json)
- `pinyin_exposure` (user_id, character, mastery_score)
- `culture_items` (id, type, chinese, pinyin, literal_meaning, figurative_meaning, origin_story, source, verified_bool)
- `import_log` (id, user_id, source_filename, format [apkg|csv], imported_count, quarantined_count, license_note, created_at) — tracks Anki-deck imports and the validation gate (Section 7B).
- `user_settings` (user_id, daily_new_cards, desired_retention, pinyin_mode, voice_preference)

---

## 7. Spaced-repetition engine — use FSRS, anchored to the Anki reference

This is the core of the app. Build it first and build it correctly. You now have the **official Anki source in `/tools/anki-main`** (desktop) and **`/tools/Anki-Android-main`** (AnkiDroid) as the authoritative reference. Anki's scheduler v3 is the gold-standard FSRS implementation — use it as your specification.

### 7A. CRITICAL LICENSING RULE — reference, do not copy

- **Anki is licensed AGPL-3.0; AnkiDroid is GPL-3.0.** These are strong copyleft licenses. If you copy their source code into this app, the **entire app becomes AGPL/GPL and — because it's a hosted web app — you would be legally required to publish all of its source to every user.** That is almost certainly not what I want for a personal project, and it would also pull in obligations around any content.
- **Therefore: read the Anki/AnkiDroid code to understand exact behavior, but implement our engine using permissively-licensed libraries.** Specifically:
  - Use **`ts-fsrs`** (MIT license) as the actual scheduler in our TypeScript/Next.js app. It is the official TypeScript port that tracks the **`fsrs-rs` (BSD-3-Clause)** crate — which is exactly the crate Anki itself depends on (`fsrs = 5.2.0` in Anki's `Cargo.toml`). So `ts-fsrs` gives us *the same algorithm Anki uses*, under a license we can freely use in a hosted app.
  - Treat `/tools/anki-main/pylib/anki/scheduler/v3.py`, `/tools/anki-main/rslib/src/` (scheduling + storage), and the `.proto` files in `/tools/anki-main/proto/anki/` (`scheduler.proto`, `deck_config.proto`, `import_export.proto`) as the **behavioral spec** to match — not as code to paste.
- **Do not vendor, fork, or copy AGPL/GPL files into the app's source tree.** Keep `/tools/anki-main` and `/tools/Anki-Android-main` out of the deployed bundle (add to `.gitignore` for the app package, or keep them in a separate non-shipped `/reference` folder). Put a note in the README stating that Anki was used as a behavioral reference and that the shipped scheduler is `ts-fsrs` (MIT).

### 7B. Scheduler implementation

- Implement reviews with **`ts-fsrs`** using **FSRS-6 default parameters**. FSRS does ~20–30% fewer reviews than legacy SM-2 for the same retention; it models each card with **Stability, Difficulty, Retrievability**.
- **Match Anki's review state machine** (from scheduler v3): card states **new → learning → review**, with **relearning** on lapse. Four rating buttons **Again(1) / Hard(2) / Good(3) / Easy(4)** — identical mapping to Anki. Honor **learning steps (1m, 10m)** before a card graduates to FSRS review scheduling.
- **Adopt Anki's proven deck behaviors** (study `deck_config.proto` and `deckoptions.py`): per-deck **new-cards/day** and **reviews/day** limits; **bury siblings** (don't show two cards from the same note on the same day); **set due date** and **forget card** maintenance actions; **load balancing** of due counts across days if `ts-fsrs` supports it.
- **Defaults (initial `user_settings`):** desired retention **0.90**; new cards/day **20** (range 15–25); learning steps **1m, 10m**; ratings **Again/Hard/Good/Easy**.
- **Validation (do this in Phase 1):** verify our scheduler's outputs against Anki's behavior. Use the FSRS test fixtures and the scheduling examples in `/tools/anki-main` (the Rust tests under `rslib/src` and the FSRS FAQ in `docs-site`) as expected-value references. Write unit tests asserting that, given the same card state + rating + elapsed time, our `ts-fsrs` next-interval matches the reference within tolerance. **If they diverge, fix ours — Anki is the source of truth for scheduling.**
- Log every review to `revlog` so FSRS parameters can later be **re-optimized from my own history** (Anki calls this "optimize FSRS parameters"; `ts-fsrs` exposes an optimizer — wire it up as a periodic background job once I have enough reviews).

### 7C. Cards are sentence-context cards, not isolated words

Follow the **i+1 / one-new-word-per-sentence** principle (sentence mining). A vocab note shows the target word inside a short (~3–8 word) verified sentence with audio, and spawns recognition + production cards via templates. Pull sentences from Tatoeba or texts I've read.

### 7D. Interleave card types within a session

Mix vocab + grammar + tone-pair + listening + cloze in each session. Interleaving substantially beats blocked practice for retention even though it feels harder. Do not group all of one type together. (Anki achieves this naturally by drawing due cards across decks — replicate that.)

---

## 8. Content pipeline + how to use the three uploaded tools (LEGAL USE ONLY)

I uploaded three open-source repos as zips. Unzip them into a `/tools` directory. Use them **only** to ingest content that is **public-domain, Creative-Commons-licensed, openly/government/educationally licensed, or that I personally own.** Never pirate copyrighted commercial novels, paywalled content, or anything I don't own. Store the source URL + license with every imported text in the `texts` table; refuse to import anything without a known license.

### 8a. Firecrawl (`firecrawl-main.zip`) — web-to-markdown ingestion
- **What it is:** a scraper that turns web pages into clean LLM-ready markdown/JSON. It's a monorepo; it self-hosts via Docker and has a JS SDK (`apps/js-sdk`). It also has a `/parse` endpoint that converts local files (PDF/DOCX, up to ~50 MB) to markdown.
- **How to wire it in:** stand up the Firecrawl service (Docker) or use the JS SDK from a Next.js server action / Supabase edge function. Feed it **legal sources only**: Project Gutenberg Chinese texts, Chinese Text Project (ctext.org, classical), Wikisource (zh), Wikipedia/Wiktionary Chinese (CC BY-SA), openly-licensed graded readers and slow-news-for-learners sites, and **my own uploaded files**. Output clean markdown → segmentation → vocab-mining pipeline (below). Markdown uses far fewer tokens than raw HTML, which keeps any LLM steps cheap.

### 8b. lightnovel-crawler (`lightnovel-crawler-dev.zip`) — novel ingestion
- **What it is:** a Python tool (`lncrawl` CLI, also a local web UI) that downloads web/light novels into EPUB and other formats. Its own README states it is **for personal use of content you legitimately have access to — do not redistribute or pirate.**
- **How to wire it in:** run it only against **public-domain or explicitly free/CC-licensed Chinese web novels**, or novels I personally own. Output EPUB → extract chapter text → run through the same segmentation + grading pipeline → store as `texts` of type `novel`. Because I love web novels, build a "graded novel reader" view on top of these (parallel Chinese/English, tap-to-define, mine sentences into my deck). Enforce the license check: if a novel's license is unknown or copyrighted, do not import it.

### 8c. Agent-Reach (`Agent-Reach-main.zip`) — keep OUT of the content pipeline
- **What it is:** a Python outreach/automation agent with channels (web, RSS, GitHub, Reddit, Bilibili, Xiaohongshu, V2EX, etc.) and a `CLAUDE.md` indicating it's meant to be driven by Claude Code.
- **Legitimate, narrow uses only:** (1) automating polite **licensing/permission-request outreach** to rights holders of Chinese texts I'd like to use; (2) pulling **public RSS feeds** of openly-licensed Chinese learning content I'm entitled to. It is **not** a primary content source and must never be used to scrape or redistribute copyrighted material. Do not put it in the runtime learning loop. If unsure whether a given use is permitted, leave it out and tell me.

### 8d. The shared pipeline (build this once, all sources feed it)
`legal source → Firecrawl / crawler → clean text → Chinese word segmentation (use jieba) → look up each word in CC-CEDICT (pinyin + gloss) → tag each word with HSK band + frequency → compute text difficulty as % of words I already know → produce: (a) a parallel bilingual reader with tap-to-define, (b) i+1 sentence candidates I can add to my SRS deck, (c) optional cached TTS audio.` Store everything with source + license metadata.

### 8e. YouTube / music / news (Phase 3)
- For YouTube: pull the **transcript/captions** (prefer human-made Chinese captions; auto-captions are lower quality) and run them through the shared pipeline so the app becomes a "study layer" — I watch on YouTube, the app helps me study the language in it. Do **not** download or re-host video. For caption-less videos, server-side **Whisper** transcription is an optional later add-on.
- Music lyrics and news: same pattern — text/transcript in, study layer on top, legal sources only.

---

## 8B. Importing existing Anki decks (.apkg) — with a validation gate

I want to import ready-made Mandarin Anki decks (there are excellent free ones — HSK decks, "Spoonfed Chinese," frequency decks, etc.). Build an **`.apkg` importer**, but pass everything through the anti-fabrication gate, because community decks vary in quality and some contain wrong tones or definitions.

- **The `.apkg` format is simple and not copyrighted** (only Anki's *code* is AGPL): an `.apkg` is a **ZIP** containing a SQLite database (`collection.anki2` / `collection.anki21`), a `media` JSON map, and numbered media files. **Reimplement a reader from this documented structure** (use a permissively-licensed SQLite reader + unzip), referencing `/tools/anki-main/proto/anki/import_export.proto` and `/tools/anki-main/pylib/anki/importing/apkg.py` only to understand the layout. **Do not copy Anki's importer code** (AGPL — see 7A).
- **Import mapping:** read Anki notes/cards → map fields to our `notes`/`cards` model → preserve the original scheduling state if present (so a partially-studied deck keeps its progress), otherwise initialize fresh FSRS state.
- **VALIDATION GATE (required):** for every imported card, extract the Chinese (hanzi) field and **validate it against CC-CEDICT**. If the card's pinyin/definition matches the dictionary → mark `verified_bool = true`. If it conflicts, is missing, or can't be matched → mark `verified_bool = false`, **quarantine** it (visible in a "needs review" area, excluded from normal study until I approve or the app auto-corrects pinyin/gloss from CC-CEDICT). Record counts in `import_log`.
- **Never silently trust imported content.** Show me an import summary: "Imported N cards — X verified against the dictionary, Y quarantined for review." Offer one-click "replace pinyin/definition with CC-CEDICT's verified version" for quarantined cards.
- Also support **CSV import** (Chinese, pinyin, English columns) through the same gate, since many shared decks are distributed as CSV.
- **Note on export:** I chose *import only* for now (not full two-way Anki export). Keep the data model close enough to Anki's that adding `.apkg` *export* later is feasible, but don't build export now.

## 9. Progressive pinyin fading

Make me gradually less dependent on pinyin, tied to **per-character mastery**, not a global switch.

- Track exposure/mastery per character in `pinyin_exposure`.
- Four display modes (a `user_settings` default of "adaptive"):
  1. **Full pinyin** above all characters (start here).
  2. **Pinyin on tap** (hidden by default, tap a character to reveal).
  3. **Pinyin only for new/low-frequency/low-mastery** characters; mastered characters show none.
  4. **No pinyin** (characters + audio only).
- In **adaptive** mode, automatically hide pinyin for a character once its mastery score crosses a threshold (e.g., several correct recalls), and re-show it if I start failing. Always keep audio available so I can check pronunciation without falling back to reading pinyin. (Rationale: pinyin bridges early reading, but over-reliance weakens character recognition, so fade it as recognition strengthens.)

---

## 10. Four-modality skill tracking

- Maintain a separate estimated level (mapped to HSK bands) for **Reading, Listening, Speaking, Writing (typed)** in `skill_progress`.
- Each activity feeds the relevant modality: reader + flashcards → reading; audio/dictation/listening cards → listening; pronunciation scoring + roleplay → speaking; typed cloze / pinyin-to-character production → writing.
- Build a **dashboard** (like the progress screens in my reference screenshots) showing all four as separate tracks with history charts and a current HSK-band estimate each.
- **Let weak modalities pull more practice:** the daily session composer should weight in more cards from whichever modality is lagging (this also keeps sessions varied → less burnout).

---

## 11. Varied learning modes (anti-burnout) — build a rotating set

Compose each daily session from a **mix** of these so it never feels repetitive:
- SRS sentence-card review (core)
- Tap-to-define **parallel reader** (novels/news/lyrics)
- **Tone-pair drills** — practice tones in two-syllable pairs (~20 combinations), not single tones; enforce third-tone sandhi (3+3→2+3), the half-third rule, and 不/一 sandhi in the audio. Use a 4×N grid of real words with audio + pitch diagrams.
- **Pronunciation challenge** (record → Azure score → pitch-contour tone feedback)
- **Listening dictation** (hear a sentence, type what you heard)
- **Cloze / fill-the-gap** sentence cards
- **Drag-to-bucket** vocab game (group words by category/part of speech — like my reference screenshots)
- **AI roleplay conversation** (RAG-grounded; e.g., "order food," "negotiate a price with a supplier" — relevant to my possible import/trade goal). Must follow the anti-fabrication system prompt in Section 3.
- **Culture/idiom** card of the day (Section 12)
- **Streaks and a daily goal** for habit formation — but no manipulative dark patterns (no guilt-tripping, no fake urgency, no punishing lapses harshly).

Target dosage default: **~20–30 minutes/day**, splittable into short sessions (≈10–15 min reviews + ≈10 min reading/listening + short drills).

---

## 12. Culture, history, and expressions module (starter content included — verify each before display)

Build a `culture_items`-driven module. Seed it with the items below, but **before displaying any, verify the fact against an authoritative source** (Chinese Text Project / Wikisource for primary texts; reputable references for idiom origins) and set `verified_bool`. Draw Confucian sayings and Tang poems **verbatim from public-domain sources with attribution** — never paraphrase them as if original.

**Short history/tradition overview to teach a beginner** (verify, then present in small cards): one of the world's oldest continuous civilizations; writing traced to **oracle-bone script of the Shang dynasty** (~3,000+ years ago) evolving to today's regular script; touchstones include **Confucian thought (the Analects 论语)**, the **Four Great Classical Novels** — Journey to the West 西游记, Dream of the Red Chamber 红楼梦, Water Margin 水浒传, Romance of the Three Kingdoms 三国演义 — **Tang poetry (Li Bai 李白, Du Fu 杜甫)**, and the social concept of **面子 (miànzi, "face")**.

**Chengyu starter set (成语) — store literal meaning, figurative meaning, and origin story for each:**
- **画蛇添足 huà shé tiān zú** — "draw a snake, add feet" → ruining something by overdoing it. (Warring States drawing-contest story.)
- **守株待兔 shǒu zhū dài tù** — "guard the stump, wait for rabbits" → waiting passively for luck. (Farmer and the hare.)
- **塞翁失马 sài wēng shī mǎ** — "the old man loses his horse" → a blessing in disguise. (Horse lost → returns with another → son's broken leg → exemption from war.)
- **望梅止渴 wàng méi zhǐ kě** — "gaze at plums to quench thirst" → consoling oneself with illusions. (Thirsty soldiers spurred by talk of plum trees.)
- **画龙点睛 huà lóng diǎn jīng** — "paint a dragon, dot the eyes" → the crucial finishing touch.
- **一石二鸟 yī shí èr niǎo** — "one stone, two birds" → kill two birds with one stone.
- **对牛弹琴 duì niú tán qín** — "play the lute to a cow" → wasted effort on the wrong audience.
- **井底之蛙 jǐng dǐ zhī wā** — "frog at the bottom of a well" → someone of narrow outlook.
- **指鹿为马 zhǐ lù wéi mǎ** — "point at a deer, call it a horse" → deliberately distorting truth to mislead. (Qin official Zhao Gao.)

Surface one culture/idiom card per day, and let me add any to my SRS deck.

---

## 13. Visual design / UX

Use the uploaded app-store screenshots as **inspiration** for look and feel (clean, friendly, card-based, big tap targets, progress dashboards, parallel-reading view, AI-roleplay screens, smart-dictionary tap-to-translate). Read the `frontend-design` skill before building UI. Phone-first layouts; the website is a responsive wider version of the same components. Warm, encouraging, uncluttered. Do not clone any specific app's branding — take patterns, not identity.

---

## 14. MCP servers to set up for this build

Configure these in Claude Code (keep 3–6 active at once; too many degrades tool selection):

**Build-time (set up now):**
1. **GitHub MCP** — repo, branches, PRs, issues.
2. **Context7 MCP** — pulls live, version-accurate docs for Next.js, Supabase, FSRS, etc., so you don't write outdated/hallucinated API calls. (High value for correctness.)
3. **Supabase MCP** (or a **Postgres MCP** in read-only mode) — inspect schema and run queries directly against the database.
4. **Filesystem MCP** — scoped file access (Claude Code has built-in file tools, so this is optional/secondary).
5. **Playwright MCP** — end-to-end UI testing in a real browser (token-heavy; enable only when running tests).
6. **Firecrawl MCP** (official) — lets you drive the scraping pipeline and fetch docs directly.

**Recommended starting set:** GitHub + Context7 + Supabase + Firecrawl.

**Runtime features** (translation, TTS, dictionary, ASR) should be **direct API integrations** (Azure Speech, local CC-CEDICT lookups), **not** MCP servers — MCP is a dev/agent protocol, not a runtime app dependency. Likewise, the **Anki repos in `/tools` are local read-only reference** for you (Claude Code) to study while implementing the scheduler and importer — they are not MCP servers and not app dependencies.

---

## 15. Build order — do this in phases, verify each before moving on

**Phase 1 — MVP (build and confirm this works first):**
1. Scaffold Next.js PWA + Supabase + Vercel; confirm it installs to a phone home screen and syncs across devices.
2. Build the data ETL: load CC-CEDICT, HSK 3.0 (2025) lists, frequency data, a Tatoeba sentence subset. Store license metadata.
3. Build the **FSRS review engine** with `ts-fsrs` (MIT), the four rating buttons, Anki's review state machine, and the daily-new-cards setting. **Write the validation tests that assert our scheduling matches the Anki reference** (Section 7B).
4. Build the **tap-to-define parallel reader** with one or two legal seed texts.
5. Add **Azure TTS** with audio caching.
6. Add the **pinyin-fading** toggle (modes 1–4).
7. Ship a basic four-skill **dashboard**.

**Phase 2:**
8. **Pronunciation feedback** (Azure Pronunciation Assessment) + custom **pitch-contour tone feedback**; test on a real iPhone.
9. **Tone-pair drills** with sandhi rules and pitch diagrams.
10. **Content pipeline** (Firecrawl + lightnovel-crawler) wired to legal sources, with the license-gate.
10b. **Anki deck import** (`.apkg` + CSV) with the CC-CEDICT validation gate and quarantine flow (Section 8B).
11. Listening dictation, cloze, and drag-to-bucket modes; interleaved session composer; weak-modality weighting.

**Phase 3:**
12. **AI roleplay conversation** (RAG-grounded, anti-fabrication system prompt), including import/trade scenarios.
13. **YouTube / music / news** study-layer integration (transcripts only, legal).
14. **Culture/idiom** module with the seed set, verified.
15. Web-novel graded reader on top of legally imported novels; optional Whisper transcription; FSRS parameter re-optimization from my own review history.

---

## 16. Setup the owner (me) must do — list these for me explicitly in a SETUP.md

Walk me through, in plain language, exactly how to:
1. Create free accounts: **Vercel**, **Supabase**, **Azure** (for the Speech free tier).
2. Where to paste each API key (use a `.env.local` file; never commit secrets).
3. How to deploy to Vercel and get my app link.
4. How to install the app on my **iPhone/Android** ("Add to Home Screen") and how to open it on **other computers** (just visit the same link and sign in — data syncs automatically).
5. (Optional) how to point a custom domain at it.

Keep secrets out of git. Add a clear README explaining the architecture in non-technical terms.

---

## 17. Known caveats to handle (don't let these silently break the build)

- **HSK 3.0** word lists are newly finalized (Nov 2025, effective July 2026). Use the **final 2025 lists**, not 2021 drafts. Keep an HSK 2.0 mapping too.
- **CC-CEDICT license version** is reported inconsistently (BY-SA 3.0 vs 4.0) — confirm and store the correct attribution.
- **Chinese Grammar Wiki is CC BY-NC** — fine for my personal non-commercial use with attribution; a licensing problem if this is ever monetized. Flag this in the README.
- **Azure free TTS = 0.5M chars/month** (some blogs wrongly say 5M); cache aggressively. **Mandarin prosody scoring is English-only** in Azure — that's why we add custom pitch-contour tone feedback.
- **edge-tts** uses an unofficial endpoint — dev only, not production.
- **iOS PWA microphone/STT** may be unreliable — build the graceful fallback and test early.
- **Anki = AGPL-3.0, AnkiDroid = GPL-3.0 (strong copyleft).** Use them as a *behavioral reference only*; the shipped scheduler must be **`ts-fsrs` (MIT)**, which tracks the same `fsrs-rs` crate Anki uses. Copying Anki/AnkiDroid source into this hosted app would force the whole app to be AGPL with mandatory public source disclosure. Keep `/tools/anki-main` and `/tools/Anki-Android-main` out of the shipped bundle.
- **Imported Anki/CSV decks can contain errors** (wrong tones, bad definitions). The CC-CEDICT validation gate + quarantine (Section 8B) is mandatory — never let unverified imported cards into normal study silently.
- **Comprehensible-input theory** (Krashen) is influential but contested — that's why we pair input (reader) with active retrieval (SRS) and output (speaking), not input alone.

---

*End of build prompt. Build Phase 1 first, show me it working on my phone, then continue. At every step where you would state a Chinese-language fact, ground it in the data sources or don't show it.*
