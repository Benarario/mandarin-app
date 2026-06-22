"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { SkillStat } from "@/app/actions/progress";

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
}: {
  stats: SkillStat[];
  chars: number;
  words: number;
  reviews: number;
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
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
                    <XAxis dataKey="t" hide />
                    <YAxis domain={[0, 9]} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip />
                    <Line type="monotone" dataKey="band" stroke={meta.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
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
    </main>
  );
}
