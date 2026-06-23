"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReviewItem } from "@/app/actions/study";
import { submitReview } from "@/app/actions/study";
import { RATING, type RatingValue } from "@/lib/srs/fsrs";
import type { PinyinMode } from "@/lib/pinyin/fading";
import PinyinText from "@/components/PinyinText";
import AudioButton from "@/components/AudioButton";

const BUTTONS: { rating: RatingValue; label: string; cls: string }[] = [
  { rating: RATING.again, label: "Again", cls: "bg-red-100 text-red-700 hover:bg-red-200" },
  { rating: RATING.hard, label: "Hard", cls: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { rating: RATING.good, label: "Good", cls: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
  { rating: RATING.easy, label: "Easy", cls: "bg-teal-100 text-teal-700 hover:bg-teal-200" },
];

export default function ReviewSession({
  initialItems,
  mastery,
  pinyinMode,
  seededCount,
}: {
  initialItems: ReviewItem[];
  mastery: Record<string, number>;
  pinyinMode: string;
  seededCount: number;
}) {
  const [items] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  const mode = pinyinMode as PinyinMode;
  const item = items[index];

  async function rate(rating: RatingValue) {
    if (busy || !item) return;
    setBusy(true);
    try {
      await submitReview(item.cardId, rating);
    } finally {
      setBusy(false);
    }
    setDone((d) => d + 1);
    setShowAnswer(false);
    if (index + 1 < items.length) setIndex(index + 1);
    else setIndex(items.length); // triggers completion screen
  }

  if (!item) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-orange-900">Session complete 🎉</h1>
        <p className="mt-3 text-stone-600">You reviewed {done} cards.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white">
          Back home
        </Link>
      </main>
    );
  }

  const chineseFront = item.templateIndex === 0;
  const chineseTokens = chineseFront ? item.frontTokens : item.backTokens;
  const chineseText = chineseFront ? item.front : item.back;

  return (
    <main className="mx-auto flex max-w-xl flex-col px-6 py-6">
      {/* progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-stone-500">
          <span>
            {done + 1} / {items.length}
          </span>
          <span className="capitalize">{item.modality}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
        {seededCount > 0 && index === 0 && done === 0 && (
          <p className="mt-2 text-center text-xs text-teal-700">
            ✓ Seeded a starter deck of {seededCount} frequency-ordered HSK-1 words.
          </p>
        )}
      </div>

      {/* card */}
      <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <span className="mb-2 rounded-full bg-stone-100 px-3 py-0.5 text-xs font-medium text-stone-500">
          {item.templateIndex === 0 ? "Read it" : "Say / type it in Chinese"}
        </span>

        {/* Front prompt */}
        {chineseFront ? (
          <ChineseBlock tokens={chineseTokens} text={chineseText} mastery={mastery} mode={mode} />
        ) : (
          <p className="text-2xl font-medium text-stone-800">{item.front}</p>
        )}

        {/* Answer */}
        {showAnswer && (
          <div className="mt-5 w-full border-t border-dashed border-stone-200 pt-5">
            {chineseFront ? (
              <p className="text-lg text-stone-700">{item.back}</p>
            ) : (
              <ChineseBlock tokens={chineseTokens} text={chineseText} mastery={mastery} mode={mode} glossHint />
            )}
            <div className="mt-3 text-sm text-stone-500">
              <span className="font-medium text-teal-700">{item.targetPinyin}</span> ·{" "}
              {item.targetGloss}
            </div>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="mt-5">
        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full rounded-2xl bg-stone-800 py-4 text-lg font-semibold text-white hover:bg-stone-900"
          >
            Show answer
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {BUTTONS.map((b) => (
              <button
                key={b.rating}
                disabled={busy}
                onClick={() => rate(b.rating)}
                className={`rounded-2xl py-4 text-sm font-semibold transition disabled:opacity-50 ${b.cls}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ChineseBlock({
  tokens,
  text,
  mastery,
  mode,
  glossHint,
}: {
  tokens?: ReviewItem["frontTokens"];
  text: string;
  mastery: Record<string, number>;
  mode: PinyinMode;
  glossHint?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-4xl leading-relaxed text-stone-900">
        {tokens ? (
          <PinyinText tokens={tokens} mastery={mastery} mode={mode} glossHint={glossHint} />
        ) : (
          text
        )}
      </div>
      <AudioButton text={text} />
    </div>
  );
}
