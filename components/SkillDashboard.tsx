"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import AudioButton from "@/components/AudioButton";
import type { SkillStat } from "@/app/actions/progress";
import type { ConfusionItem } from "@/app/actions/drills";

// Lazy-load the Recharts sparkline (~99.5 KB gz) so it stays out of the initial
// /dashboard bundle and off the main thread. The h-16 wrapper reserves space, so
// no layout shift while it loads.
const SkillSparkline = dynamic(() => import("@/components/SkillSparkline"), {
  ssr: false,
  loading: () => <div className="h-full" />,
});

const META: Record<string, { label: string; icon: string; color: string; unit: string }> = {
  reading: { label: "Reading", icon: "📖", color: "#c2410c", unit: "read" },
  listening: { label: "Listening", icon: "🎧", color: "#0f766e", unit: "heard" },
  speaking: { label: "Speaking", icon: "🗣️", color: "#7c3aed", unit: "spoken" },
  writing: { label: "Writing (typed)", icon: "⌨️", color: "#be123c", unit: "typed" },
};

export default function SkillDashboard({
  stats,
  chars,
  words,
  reviews,
  confusable = [],
}: {
  stats: SkillStat[];
  chars: number;
  words: number;
  reviews: number;
  confusable?: { a: ConfusionItem; b: ConfusionItem }[];
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold text-orange-900">Your progress</h1>
      <p className="mt-1 text-sm text-stone-500">Estimates are based on what you&apos;ve actually mastered.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-orange-700">{chars}</div>
          <div className="mt-1 text-xs font-medium text-stone-500">characters mastered</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-teal-700">{words}</div>
          <div className="mt-1 text-xs font-medium text-stone-500">words mastered</div>
        </div>
      </div>

      <Link
        href="/dashboard/mastered"
        className="mt-3 flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 font-semibold text-stone-700 hover:bg-stone-50"
      >
        <span>📚 View mastered characters &amp; words</span>
        <span aria-hidden className="text-stone-400">→</span>
      </Link>

      <div className="mt-4 grid gap-4">
        {stats.map((s) => {
          const meta = META[s.modality] ?? { label: s.modality, icon: "•", color: "#999", unit: "" };
          const data = s.history.length ? s.history : [{ t: "start", band: s.band }];
          return (
            <div key={s.modality} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-stone-800">
                  <span aria-hidden>{meta.icon}</span>
                  {meta.label}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: meta.color }}>
                    {s.band > 0 ? `HSK ${s.band}` : "—"}
                  </div>
                  <div className="text-xs text-stone-400">
                    {s.known} {meta.unit}
                  </div>
                </div>
              </div>
              <div className="mt-2 h-16">
                <SkillSparkline data={data} color={meta.color} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-stone-400">
        Reading &amp; typed-writing track the HSK level of words you&apos;ve mastered. Listening &amp;
        speaking show activity counts until their Phase-2 features (audio dictation, pronunciation
        scoring) are added.
      </p>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-500">
        <span className="font-semibold text-stone-700">{reviews}</span> reviews logged. Every review
        is recorded, so the spaced-repetition schedule can later be re-tuned to your own memory once
        enough history has built up.
      </div>

      {confusable.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-stone-700">Easily confused</h2>
          <p className="mb-2 text-xs text-stone-400">
            Look-alikes you&apos;ve learned — compare them so they don&apos;t blur together.
          </p>
          <div className="grid gap-2">
            {confusable.map(({ a, b }) => (
              <div key={`${a.char}-${b.char}`} className="flex items-center justify-around rounded-2xl border border-stone-200 bg-white p-3">
                {[a, b].map((c, i) => (
                  <div key={c.char} className="flex items-center gap-2">
                    {i === 1 && <span className="mr-1 text-stone-300">vs</span>}
                    <span className="text-2xl text-stone-900">{c.char}</span>
                    <div className="text-left">
                      <div className="text-xs font-medium text-teal-700">{c.pinyin}</div>
                      <div className="max-w-[6rem] truncate text-[11px] text-stone-500">{c.gloss}</div>
                    </div>
                    <AudioButton
                      text={c.char}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
