"use client";

import { useState } from "react";
import PinyinText from "@/components/PinyinText";
import AudioButton from "@/components/AudioButton";
import { addWordToDeck } from "@/app/actions/study";
import type { AnnToken } from "@/lib/annotate";
import type { DictionaryRow } from "@/lib/db/types";
import type { PinyinMode } from "@/lib/pinyin/fading";

export default function ReaderView({
  title,
  level,
  license,
  lines,
  mastery,
  pinyinMode,
}: {
  title: string;
  level: string;
  license: string;
  lines: AnnToken[][];
  mastery: Record<string, number>;
  pinyinMode: string;
}) {
  const mode = pinyinMode as PinyinMode;
  const [word, setWord] = useState<string | null>(null);
  const [entries, setEntries] = useState<DictionaryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<string>("");

  async function openWord(w: string) {
    setWord(w);
    setEntries(null);
    setAdded("");
    setLoading(true);
    try {
      const res = await fetch(`/api/dict?w=${encodeURIComponent(w)}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!word) return;
    const res = await addWordToDeck(word);
    setAdded(res.added ? "Added to your deck ✓" : `Not added: ${res.reason}`);
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-orange-900">{title}</h1>
        <p className="text-xs font-medium text-stone-500">
          {level} · tap any word for its verified definition
        </p>
      </header>

      <article className="space-y-4 text-3xl leading-loose text-stone-900">
        {lines.map((tokens, i) => (
          <p key={i}>
            <PinyinText tokens={tokens} mastery={mastery} mode={mode} onWordTap={openWord} />
          </p>
        ))}
      </article>

      <p className="mt-8 text-xs text-stone-400">Source: {license}</p>

      {/* definition sheet */}
      {word && (
        <div className="fixed inset-x-0 bottom-16 z-50 mx-auto max-w-xl px-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-stone-900">{word}</span>
                <AudioButton text={word} />
              </div>
              <button onClick={() => setWord(null)} className="text-stone-400 hover:text-stone-600" aria-label="Close">
                ✕
              </button>
            </div>

            {loading && <p className="mt-3 text-sm text-stone-500">Looking up…</p>}

            {entries && entries.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                Not found in CC-CEDICT — shown as unverified, not taught as fact.
              </p>
            )}

            {entries && entries.length > 0 && (
              <div className="mt-3">
                <div className="text-teal-700">{entries[0].pinyin}</div>
                <ul className="mt-1 list-disc pl-5 text-sm text-stone-700">
                  {entries[0].glosses.slice(0, 4).map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {entries[0].hsk_30_band != null && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700">
                      HSK {entries[0].hsk_30_band}
                    </span>
                  )}
                  {entries[0].freq_rank != null && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
                      freq #{entries[0].freq_rank}
                    </span>
                  )}
                </div>

                <button
                  onClick={add}
                  disabled={Boolean(added)}
                  className="mt-3 w-full rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {added || "+ Add to my deck"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
