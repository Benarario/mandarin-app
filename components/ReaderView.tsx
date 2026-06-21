"use client";

import { useMemo, useState } from "react";
import PinyinText from "@/components/PinyinText";
import AudioButton from "@/components/AudioButton";
import ImageCard from "@/components/ImageCard";
import { addWordToDeck, markKnown, mineSentence } from "@/app/actions/mine";
import { isHan } from "@/lib/pinyin/fading";
import type { AnnToken } from "@/lib/annotate";
import type { DictionaryRow } from "@/lib/db/types";
import type { PinyinMode } from "@/lib/pinyin/fading";

export default function ReaderView({
  title,
  level,
  license,
  lines,
  english,
  charStatus,
  wordStatus,
  pinyinMode,
}: {
  title: string;
  level: string;
  license: string;
  lines: AnnToken[][];
  english: string[];
  charStatus: Record<string, number>;
  wordStatus: Record<string, number>;
  pinyinMode: string;
}) {
  const mode = pinyinMode as PinyinMode;
  const [bilingual, setBilingual] = useState(true);
  const [word, setWord] = useState<string | null>(null);
  const [entries, setEntries] = useState<DictionaryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [bump, setBump] = useState(0); // re-render after status changes

  // Status of a token: word status if known, else derived from its characters.
  function tokenStatus(text: string): number | null {
    if (![...text].some(isHan)) return null;
    if (wordStatus[text] != null) return wordStatus[text];
    const chars = [...text].filter(isHan);
    const ss = chars.map((c) => charStatus[c] ?? 0);
    if (ss.every((s) => s >= 4)) return 4;
    if (ss.some((s) => s > 0)) return 2;
    return 0;
  }

  function colorFor(text: string): string {
    const s = tokenStatus(text);
    if (s === null) return "";
    if (s >= 5) return "text-emerald-700";
    if (s >= 4) return "text-stone-900";
    if (s >= 1) return "text-amber-600";
    return "text-orange-600 underline decoration-dotted decoration-orange-300 underline-offset-4";
  }

  const coverage = useMemo(() => {
    let known = 0,
      total = 0;
    for (const line of lines)
      for (const t of line)
        if (t.isWord && [...t.text].some(isHan)) {
          total++;
          if ((tokenStatus(t.text) ?? 0) >= 4) known++;
        }
    return total ? Math.round((known / total) * 100) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, charStatus, wordStatus, bump]);

  async function openWord(w: string) {
    setWord(w);
    setEntries(null);
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`/api/dict?w=${encodeURIComponent(w)}`);
      setEntries((await res.json()).entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!word) return;
    const r = await addWordToDeck(word);
    setMsg(r.added > 0 ? `Added ${r.added} to your deck ✓` : `Not added: ${r.reason}`);
  }
  async function know() {
    if (!word) return;
    await markKnown(word);
    setMsg("Marked as known ✓");
    setBump((b) => b + 1);
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-6">
      <header className="mb-3">
        <h1 className="text-2xl font-bold text-orange-900">{title}</h1>
        <p className="text-xs font-medium text-stone-500">{level} · tap any word</p>
      </header>

      {/* coverage + mode toggle */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
          You can read <span className="font-bold text-emerald-700">{coverage}%</span> of this text
        </span>
        <button
          onClick={() => setBilingual((b) => !b)}
          className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          {bilingual ? "Chinese only" : "Show English"}
        </button>
      </div>

      {coverage < 60 && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          This text is above your current level — that&apos;s expected early on. Tap words to learn
          them, or keep reviewing until more of it turns dark.
        </p>
      )}

      <article className="space-y-5">
        {lines.map((tokens, i) => (
          <div key={i}>
            <p className="text-3xl leading-loose">
              <PinyinText
                tokens={tokens}
                mastery={charStatus}
                mode={mode}
                onWordTap={openWord}
                colorFor={colorFor}
              />
              <button
                onClick={async () => {
                  const zh = tokens.map((t) => t.text).join("");
                  const r = await mineSentence(zh, english[i]);
                  setMsg(r.stretch ? "Added as a stretch card ✓" : "Sentence added to deck ✓");
                }}
                title="Add this sentence to my deck"
                className="ml-2 align-middle text-sm text-stone-300 hover:text-orange-500"
              >
                ＋
              </button>
            </p>
            {bilingual && <p className="mt-1 text-sm text-stone-500">{english[i]}</p>}
          </div>
        ))}
      </article>

      {/* legend */}
      <div className="mt-8 flex flex-wrap gap-3 text-xs text-stone-400">
        <span className="text-orange-600">● new</span>
        <span className="text-amber-600">● learning</span>
        <span className="text-stone-900">● familiar</span>
        <span className="text-emerald-700">● strong</span>
      </div>
      <p className="mt-2 text-xs text-stone-400">Source: {license}</p>
      {msg && <p className="mt-2 text-center text-sm text-teal-700">{msg}</p>}

      {/* definition sheet */}
      {word && (
        <div className="fixed inset-x-0 bottom-16 z-50 mx-auto max-w-xl px-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <ImageCard text={word} size="text-3xl" />
                <span className="text-3xl font-bold text-stone-900">{word}</span>
                <AudioButton text={word} />
              </div>
              <button onClick={() => setWord(null)} className="text-stone-400 hover:text-stone-600" aria-label="Close">
                ✕
              </button>
            </div>

            {loading && <p className="mt-3 text-sm text-stone-500">Looking up…</p>}
            {entries && entries.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">Not in CC-CEDICT — shown as unverified.</p>
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
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={add} className="rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
                    + Add to deck
                  </button>
                  <button onClick={know} className="rounded-xl border border-stone-300 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50">
                    I know this
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
