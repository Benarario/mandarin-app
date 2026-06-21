// A small SVG pitch diagram for a Mandarin tone (5-level Chao pitch notation,
// 5 = high). Tones: 1 high-flat (55), 2 rising (35), 3 dipping (214),
// 4 falling (51), 5 neutral (a short mid dot).
const CONTOURS: Record<number, number[]> = {
  1: [5, 5],
  2: [3, 5],
  3: [2, 1, 4],
  4: [5, 1],
  5: [3],
};

export default function PitchContour({
  tone,
  width = 40,
  height = 30,
  color = "#0f766e",
}: {
  tone: number;
  width?: number;
  height?: number;
  color?: string;
}) {
  const pts = CONTOURS[tone] ?? [3];
  const y = (p: number) => ((5 - p) / 4) * (height - 6) + 3;
  const x = (i: number) => (pts.length === 1 ? width / 2 : (i / (pts.length - 1)) * (width - 6) + 3);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <line x1="1" y1={height - 1} x2={width - 1} y2={height - 1} stroke="#e7e5e4" strokeWidth="1" />
      {pts.length === 1 ? (
        <circle cx={x(0)} cy={y(pts[0])} r="3" fill={color} />
      ) : (
        <polyline
          points={pts.map((p, i) => `${x(i)},${y(p)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
