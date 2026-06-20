"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface Skill {
  modality: string;
  estimated_hsk_band: number;
  xp: number;
  history_json: { t: string; band: number }[];
}

const META: Record<string, { label: string; icon: string; color: string }> = {
  reading: { label: "Reading", icon: "📖", color: "#c2410c" },
  listening: { label: "Listening", icon: "🎧", color: "#0f766e" },
  speaking: { label: "Speaking", icon: "🗣️", color: "#7c3aed" },
  writing: { label: "Writing (typed)", icon: "⌨️", color: "#be123c" },
};

export default function SkillDashboard({ skills }: { skills: Skill[] }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold text-orange-900">Your progress</h1>
      <p className="mt-1 text-sm text-stone-500">
        Four skills, tracked separately. Estimates are based on your review activity.
      </p>

      <div className="mt-6 grid gap-4">
        {skills.map((s) => {
          const meta = META[s.modality] ?? { label: s.modality, icon: "•", color: "#999" };
          const data = s.history_json.length
            ? s.history_json
            : [{ t: "start", band: s.estimated_hsk_band }];
          return (
            <div key={s.modality} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-stone-800">
                  <span aria-hidden>{meta.icon}</span>
                  {meta.label}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: meta.color }}>
                    {s.estimated_hsk_band > 0 ? `HSK ${s.estimated_hsk_band}` : "—"}
                  </div>
                  <div className="text-xs text-stone-400">{s.xp} XP</div>
                </div>
              </div>
              <div className="mt-2 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
                    <XAxis dataKey="t" hide />
                    <YAxis domain={[0, 9]} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="band"
                      stroke={meta.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-stone-400">
        Reading & typed-writing are driven by your flashcard reviews and reader. Listening &
        speaking activate in Phase 2 (audio dictation + pronunciation scoring).
      </p>
    </main>
  );
}
