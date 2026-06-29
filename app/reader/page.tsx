import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { requireUser } from "@/lib/require-user";
import { annotateMany } from "@/lib/annotate";
import { segment } from "@/lib/segment/jieba";
import { getStatusMaps } from "@/lib/graph/mastery";
import { SEED_TEXTS, getSeedText } from "@/lib/seed/reader";
import { getGlobalReaderTexts, getReaderText, type ReaderText } from "@/lib/reader/texts";
import { isHan } from "@/lib/pinyin/fading";
import { timed, timedSync } from "@/lib/perf/timing";
import type { AnnToken } from "@/lib/annotate";
import ReaderView from "@/components/ReaderView";

export const dynamic = "force-dynamic";

/** Tokens for each line: cached (from etl:reader) when present, else live jieba. */
function linesTokensOf(t: ReaderText): AnnToken[][] {
  const cached = t.lines.every((l) => l.tokens && l.tokens.length > 0);
  if (cached) return t.lines.map((l) => l.tokens!);
  return t.lines.map((l) => segment(l.zh).map((s) => ({ text: s.text, isWord: s.isWord })));
}

/** Known-token % of a text for this learner (familiar = status ≥ 4). */
function coverageFromTokens(
  linesTokens: AnnToken[][],
  char: Record<string, number>,
  word: Record<string, number>,
): number {
  let known = 0,
    total = 0;
  for (const toks of linesTokens) {
    for (const t of toks) {
      if (!t.isWord || ![...t.text].some(isHan)) continue;
      total++;
      const s =
        word[t.text] ??
        ([...t.text].filter(isHan).every((c) => (char[c] ?? 0) >= 4) ? 4 : 0);
      if (s >= 4) known++;
    }
  }
  return total ? Math.round((known / total) * 100) : 0;
}

export default async function ReaderPage({ searchParams }: PageProps<"/reader">) {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");
  const { supabase } = await requireUser();
  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : null;

  const status = await getStatusMaps(supabase, user.id);

  // Graded reader texts from Tatoeba (global DB rows); seed texts as a fallback
  // so the reader still works before the ETL has been run.
  const dbTexts = await timed("reader.globalTexts", () => getGlobalReaderTexts(supabase));
  const library: ReaderText[] = dbTexts.length ? dbTexts : SEED_TEXTS;

  // ── No text chosen → the picker (spec §13) ──
  if (!id) {
    const items = timedSync("reader.coverage(cached tokens)", () =>
      library
        .map((t) => ({
          t,
          coverage: coverageFromTokens(linesTokensOf(t), status.char, status.word),
        }))
        .sort((a, b) => b.coverage - a.coverage),
    );

    return (
      <main className="mx-auto max-w-xl px-6 py-8">
        <h1 className="text-2xl font-bold text-orange-900">Read</h1>
        <p className="mt-1 text-sm text-stone-500">
          Pick a text. The percentage is how much of it you can already read.
        </p>
        <div className="mt-6 space-y-3">
          {items.map(({ t, coverage }) => {
            const comfortable = coverage >= 80;
            return (
              <Link
                key={t.id}
                href={`/reader?id=${t.id}`}
                className="block rounded-2xl border border-stone-200 bg-white p-4 hover:border-orange-300"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800">{t.title}</span>
                  <span className={`text-sm font-bold ${comfortable ? "text-emerald-700" : "text-amber-600"}`}>
                    {coverage}%
                  </span>
                </div>
                <div className="mt-1 flex gap-2 text-xs text-stone-500">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5">{t.level}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5">{t.topic}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5">{t.lines.length} lines</span>
                  {!comfortable && <span className="text-amber-600">stretch</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    );
  }

  // ── A text is chosen → the reader ──
  const text: ReaderText = (await getReaderText(supabase, id)) ?? getSeedText(id) ?? library[0] ?? SEED_TEXTS[0];
  const cached = text.lines.length > 0 && text.lines.every((l) => l.tokens && l.tokens.length > 0);
  const [lines, settingsRow] = await Promise.all([
    cached
      ? Promise.resolve(text.lines.map((l) => l.tokens!))
      : timed("reader.annotate(jieba+dict)", () => annotateMany(text.lines.map((l) => l.zh))),
    supabase.from("user_settings").select("pinyin_mode").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <ReaderView
      title={text.title}
      level={text.level}
      license={text.license}
      lines={lines}
      english={text.lines.map((l) => l.en)}
      charStatus={status.char}
      wordStatus={status.word}
      pinyinMode={settingsRow.data?.pinyin_mode ?? "adaptive"}
    />
  );
}
