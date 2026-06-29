"use client";

import { useState } from "react";
import Link from "next/link";
import { submitConceptReview } from "@/app/actions/review";
import { RATING, type RatingValue } from "@/lib/srs/fsrs";
import type { PinyinMode } from "@/lib/pinyin/fading";
import type { ConceptReviewItem } from "@/lib/db/concept-types";
import PinyinText from "@/components/PinyinText";
import AudioButton from "@/components/AudioButton";
import ImageCard from "@/components/ImageCard";
import DrawCanvas from "@/components/DrawCanvas";
import { visualFor } from "@/lib/visuals/emoji";

const BUTTONS: { rating: RatingValue; label: string; cls: string }[] = [
  { rating: RATING.again, label: "Again", cls: "bg-red-100 text-red-700 hover:bg-red-200" },
  { rating: RATING.hard, label: "Hard", cls: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { rating: RATING.good, label: "Good", cls: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
  { rating: RATING.easy, label: "Easy", cls: "bg-teal-100 text-teal-700 hover:bg-teal-200" },
];

const TYPE_LABEL: Record<string, string> = {
  phoneme: "Sound",
  component: "Building block",
  character: "Character",
  word: "Word",
};

export default function ConceptReview({
  initialItems,
  mastery,
  pinyinMode,
  seeded,
}: {
  initialItems: ConceptReviewItem[];
  mastery: Record<string, number>;
  pinyinMode: string;
  seeded: number;
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
      await submitConceptReview(item.cardId, rating);
    } finally {
      setBusy(false);
    }
    setDone((d) => d + 1);
    setShowAnswer(false);
    setIndex(index + 1);
  }

  if (!item) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-orange-900">Session complete 🎉</h1>
        <p className="mt-3 text-stone-600">You practised {done} cards.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white">
          Back home
        </Link>
      </main>
    );
  }

  const chineseTokens = item.templateIndex === 0 ? item.frontTokens : item.backTokens;
  const chineseText = item.templateIndex === 0 ? item.front : item.back;
  const isProduction = item.templateIndex === 1;
  const isPhoneme = item.conceptType === "phoneme";
  // Handwriting recall: produce a character from its meaning/sound, then reveal
  // the form + how it's built. The attempt is the point; the rating is optional.
  const isWriting = isProduction && item.conceptType === "character";

  return (
    <main className="mx-auto flex max-w-xl flex-col px-6 py-6">
      {/* progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-stone-500">
          <span>{done + 1} / {items.length}</span>
          <span>{TYPE_LABEL[item.conceptType]}{item.isNew ? " · new" : ""}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-orange-500 transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        {seeded > 0 && done === 0 && index === 0 && (
          <p className="mt-2 text-center text-xs text-teal-700">
            ✓ Starting from zero — your first {seeded} lessons are sounds &amp; building blocks.
          </p>
        )}
      </div>

      <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        {/* Dual-coded picture for a new concrete concept */}
        {item.isNew && item.headword && visualFor(item.headword) && (
          <ImageCard text={item.headword} />
        )}

        {/* New-concept teaching banner with emoji-composed mnemonic */}
        {item.isNew && item.breakdown && item.breakdown.length > 0 && (
          <div className="my-3 w-full rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
            <span className="font-semibold">New {TYPE_LABEL[item.conceptType].toLowerCase()}.</span>{" "}
            Built from:{" "}
            {item.breakdown.map((p, i) => (
              <span key={i}>
                {i > 0 && " + "}
                {visualFor(p.text) && <span className="mr-0.5">{visualFor(p.text)}</span>}
                <span className="font-semibold">{p.text}</span>
                {p.gloss ? ` (${p.gloss})` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Front */}
        {isPhoneme ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-3xl font-semibold text-stone-900">{item.front}</p>
            {item.note && <p className="max-w-xs text-sm text-stone-600">{item.note}</p>}
            {item.example && (
              <div className="flex items-center gap-3 rounded-2xl bg-stone-50 px-4 py-2">
                <span className="text-xs text-stone-400">e.g.</span>
                <span className="text-3xl text-stone-900">{item.example}</span>
                {item.examplePinyin && (
                  <span className="text-lg font-medium text-teal-700">{item.examplePinyin}</span>
                )}
                <AudioButton text={item.example} />
              </div>
            )}
          </div>
        ) : isWriting ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-xl font-medium text-stone-800">{item.front}</p>
            <div className="flex items-center gap-2 text-sm">
              {item.pinyin && <span className="font-medium text-teal-700">{item.pinyin}</span>}
              {item.audioText && <AudioButton text={item.audioText} />}
            </div>
            <p className="text-xs text-stone-400">✍️ Write the character from memory, then reveal.</p>
            <DrawCanvas key={item.cardId} />
          </div>
        ) : isProduction ? (
          <p className="text-2xl font-medium text-stone-800">{item.front}</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-5xl leading-relaxed text-stone-900">
              {chineseTokens ? <PinyinText tokens={chineseTokens} mastery={mastery} mode={mode} /> : chineseText}
            </div>
            {item.audioText && <AudioButton text={item.audioText} />}
          </div>
        )}

        {/* Answer */}
        {showAnswer && !isPhoneme && (
          <div className="mt-5 w-full border-t border-dashed border-stone-200 pt-5">
            {isProduction ? (
              <div className="flex items-center justify-center gap-3">
                <div className="text-4xl text-stone-900">
                  {chineseTokens ? <PinyinText tokens={chineseTokens} mastery={mastery} mode={mode} glossHint /> : chineseText}
                </div>
                {item.audioText && <AudioButton text={item.audioText} />}
              </div>
            ) : (
              <p className="text-lg text-stone-700">{item.back}</p>
            )}
            {isWriting && item.breakdown && item.breakdown.length > 0 && (
              <div className="mt-3 text-sm text-stone-500">
                <span className="font-medium text-stone-600">Built from:</span>{" "}
                {item.breakdown.map((p, i) => (
                  <span key={i}>
                    {i > 0 && " + "}
                    {visualFor(p.text) && <span className="mr-0.5">{visualFor(p.text)}</span>}
                    <span className="font-semibold text-stone-700">{p.text}</span>
                    {p.gloss ? ` (${p.gloss})` : ""}
                  </span>
                ))}
              </div>
            )}
            {(item.pinyin || item.gloss) && (
              <div className="mt-3 text-sm text-stone-500">
                {item.pinyin && <span className="font-medium text-teal-700">{item.pinyin}</span>}
                {item.pinyin && item.gloss ? " · " : ""}
                {item.gloss}
              </div>
            )}
          </div>
        )}
      </div>

      {/* controls */}
      <div className="mt-5">
        {!isPhoneme && !showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full rounded-2xl bg-stone-800 py-4 text-lg font-semibold text-white hover:bg-stone-900"
          >
            {item.isNew ? "Got it — show details" : "Show answer"}
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
