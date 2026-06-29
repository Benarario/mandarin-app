"use client";

// Recharts is heavy (~99.5 KB gz). It lives in its own component so SkillDashboard
// can lazy-load it with next/dynamic (ssr:false) — keeping it out of the initial
// /dashboard JS and off the main thread until after paint.
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function SkillSparkline({
  data,
  color,
}: {
  data: { t: string; band: number }[];
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
        <XAxis dataKey="t" hide />
        <YAxis domain={[0, 9]} tick={{ fontSize: 10 }} width={28} />
        <Tooltip />
        <Line type="monotone" dataKey="band" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
