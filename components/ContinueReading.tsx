"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Entry {
  series: string;
  id: string;
  label: string;
  n: number;
  total: number;
  ts: number;
}

// Reads the per-device reading progress that ReaderView records, and offers a
// resume link per book. Renders nothing until/unless there's saved progress (so
// no server/client hydration mismatch).
export default function ContinueReading() {
  const [items, setItems] = useState<Entry[]>([]);

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem("reader.progress") || "{}") as Record<string, Omit<Entry, "series">>;
      const list = Object.entries(all).map(([series, v]) => ({ series, ...v }));
      list.sort((a, b) => b.ts - a.ts);
      setItems(list.slice(0, 4));
    } catch {
      /* ignore */
    }
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-stone-700">Continue reading</h2>
      <div className="space-y-3">
        {items.map((it) => (
          <Link
            key={it.series}
            href={`/reader?id=${it.id}`}
            className="block rounded-2xl border border-orange-200 bg-orange-50/40 p-4 hover:border-orange-300"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-800">📖 {it.series}</span>
              <span className="text-xs font-medium text-stone-500">{it.n} / {it.total}</span>
            </div>
            <div className="mt-0.5 text-xs text-stone-500">Resume · {it.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
