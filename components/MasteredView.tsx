"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { removeMastered, type MasteredItem } from "@/app/actions/progress";

type Tab = "words" | "characters";

const bandKey = (b: number | null) => (b == null ? "other" : `hsk${b}`);
const bandLabel = (b: number | null) => (b == null ? "Other" : `HSK ${b}`);

/** Group items into ordered HSK-band buckets (HSK 1…9, then Other). */
function groupByBand(items: MasteredItem[]): { key: string; label: string; items: MasteredItem[] }[] {
  const groups = new Map<string, { label: string; band: number; items: MasteredItem[] }>();
  for (const it of items) {
    const key = bandKey(it.hskBand);
    if (!groups.has(key)) groups.set(key, { label: bandLabel(it.hskBand), band: it.hskBand ?? 99, items: [] });
    groups.get(key)!.items.push(it);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].band - b[1].band)
    .map(([key, g]) => ({ key, label: g.label, items: g.items }));
}

export default function MasteredView({
  characters,
  words,
}: {
  characters: MasteredItem[];
  words: MasteredItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(words.length >= characters.length ? "words" : "characters");
  const [chars, setChars] = useState(characters);
  const [wordItems, setWordItems] = useState(words);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const active = tab === "words" ? wordItems : chars;
  const groups = groupByBand(active);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function remove(item: MasteredItem) {
    if (busy) return;
    setBusy(item.conceptId);
    const r = await removeMastered(item.conceptId);
    setBusy(null);
    if (!r.ok) {
      setMsg(`Could not remove ${item.text}`);
      return;
    }
    if (tab === "words") setWordItems((xs) => xs.filter((x) => x.conceptId !== item.conceptId));
    else setChars((xs) => xs.filter((x) => x.conceptId !== item.conceptId));
    setMsg(`Removed ${item.text} ✓`);
    router.refresh(); // keep the Progress counts in sync
  }

  const TabBtn = ({ id, label, n }: { id: Tab; label: string; n: number }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        tab === id ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
      }`}
    >
      {label} <span className={tab === id ? "text-orange-100" : "text-stone-400"}>({n})</span>
    </button>
  );

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <header className="mb-4">
        <Link href="/dashboard" className="text-xs text-stone-400 hover:text-stone-600">← Progress</Link>
        <h1 className="text-2xl font-bold text-orange-900">Mastered</h1>
        <p className="mt-1 text-sm text-stone-500">
          Everything you&apos;ve mastered, grouped by HSK level. Tap ✕ to reset an item so you can re-learn it.
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        <TabBtn id="words" label="Words" n={wordItems.length} />
        <TabBtn id="characters" label="Characters" n={chars.length} />
      </div>

      {msg && <p className="mb-3 text-center text-sm text-teal-700">{msg}</p>}

      {active.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          No mastered {tab} yet. Keep reviewing — items become &ldquo;familiar&rdquo; once they&apos;re solid.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const open = !collapsed.has(g.key);
            return (
              <section key={g.key}>
                <button
                  onClick={() => toggle(g.key)}
                  className="mb-2 flex w-full items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-left"
                >
                  <span className="text-sm font-semibold text-stone-700">
                    {g.label} <span className="font-normal text-stone-400">· {g.items.length}</span>
                  </span>
                  <span className="text-stone-400" aria-hidden>{open ? "▾" : "▸"}</span>
                </button>

                {open && (
                  <div className={`grid gap-3 ${tab === "characters" ? "grid-cols-3" : "grid-cols-2"}`}>
                    {g.items.map((it) => (
                      <div
                        key={it.conceptId}
                        className="relative rounded-2xl border border-stone-200 bg-white p-3 text-center shadow-sm"
                      >
                        <button
                          onClick={() => remove(it)}
                          disabled={busy === it.conceptId}
                          aria-label={`Remove ${it.text}`}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-stone-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        >
                          ✕
                        </button>
                        {it.emoji && <div className="text-2xl leading-none" aria-hidden>{it.emoji}</div>}
                        <div className={`mt-1 font-bold text-stone-900 ${tab === "characters" ? "text-3xl" : "text-2xl"}`}>
                          {it.text}
                        </div>
                        {it.pinyin && <div className="mt-0.5 text-sm font-medium text-teal-700">{it.pinyin}</div>}
                        {it.gloss && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-stone-500">{it.gloss}</div>
                        )}
                        {it.status >= 5 && (
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">strong</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
