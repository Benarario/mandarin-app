"use client";

import { useMemo, useState } from "react";
import AudioButton from "@/components/AudioButton";
import PitchContour from "@/components/PitchContour";
import type { ToneWord, ToneFamily } from "@/app/actions/drills";

const TONE_LABEL = ["", "1st · high", "2nd · rising", "3rd · dipping", "4th · falling"];

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Mode = "menu" | "tone" | "pair";
interface PairRound {
  family: ToneFamily;
  target: ToneWord;
}

export default function ToneDrills({ whichTone, pairs }: { whichTone: ToneWord[]; pairs: ToneFamily[] }) {
  const [mode, setMode] = useState<Mode>("menu");
  const [toneQ, setToneQ] = useState<ToneWord[]>([]);
  const [pairQ, setPairQ] = useState<PairRound[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | string | null>(null);
  const [score, setScore] = useState(0);

  function start(m: Mode) {
    if (m === "tone") setToneQ(shuffle(whichTone).slice(0, 10));
    if (m === "pair") setPairQ(shuffle(pairs).map((f) => ({ family: f, target: f.options[Math.floor(Math.random() * f.options.length)] })));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setMode(m);
  }

  const total = mode === "tone" ? toneQ.length : pairQ.length;

  if (mode === "menu") {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-bold text-orange-900">Train your ear</h2>
        <p className="mt-1 text-sm text-stone-500">
          Listen and identify the tone — the fastest way to hear the difference. Audio and words are
          real (CC-CEDICT).
        </p>
        <div className="mt-3 grid gap-3">
          <button
            onClick={() => start("tone")}
            disabled={whichTone.length === 0}
            className="rounded-2xl bg-orange-600 px-5 py-4 text-left font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
          >
            Which tone did you hear? <span className="font-normal text-orange-100">· {whichTone.length} words</span>
          </button>
          <button
            onClick={() => start("pair")}
            disabled={pairs.length === 0}
            className="rounded-2xl border border-stone-300 px-5 py-4 text-left font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Minimal pairs — which did you hear? <span className="font-normal text-stone-400">· {pairs.length} sets</span>
          </button>
        </div>
      </section>
    );
  }

  // Completion
  if (index >= total) {
    return (
      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <p className="text-lg font-semibold text-stone-800">
          {score} / {total} correct
        </p>
        <button onClick={() => setMode("menu")} className="mt-3 rounded-xl bg-orange-600 px-5 py-2.5 font-semibold text-white">
          Back to drills
        </button>
      </section>
    );
  }

  const answered = picked !== null;

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between text-xs font-medium text-stone-500">
        <span>{index + 1} / {total}</span>
        <span>Score {score}</span>
        <button onClick={() => setMode("menu")} className="text-stone-400 underline">end</button>
      </div>

      {mode === "tone" ? (
        <ToneRound
          word={toneQ[index]}
          picked={picked as number | null}
          onPick={(tone) => {
            if (answered) return;
            setPicked(tone);
            if (tone === toneQ[index].tone) setScore((s) => s + 1);
          }}
        />
      ) : (
        <PairRoundView
          round={pairQ[index]}
          picked={picked as string | null}
          onPick={(char) => {
            if (answered) return;
            setPicked(char);
            if (char === pairQ[index].target.char) setScore((s) => s + 1);
          }}
        />
      )}

      {answered && (
        <button onClick={next} className="mt-4 w-full rounded-2xl bg-stone-800 py-3 font-semibold text-white hover:bg-stone-900">
          {index + 1 >= total ? "See score" : "Next"}
        </button>
      )}
    </section>
  );
}

function ToneRound({ word, picked, onPick }: { word: ToneWord; picked: number | null; onPick: (t: number) => void }) {
  const answered = picked !== null;
  return (
    <div className="mt-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <AudioButton text={word.char} className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-3xl text-teal-700 hover:bg-teal-100" />
        <span className="text-xs text-stone-400">Tap to listen, then pick the tone</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((t) => {
          const correct = answered && t === word.tone;
          const wrong = answered && t === picked && t !== word.tone;
          return (
            <button
              key={t}
              onClick={() => onPick(t)}
              disabled={answered}
              className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium transition ${
                correct ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : wrong ? "border-red-300 bg-red-50 text-red-700"
                : "border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              <PitchContour tone={t} />
              {TONE_LABEL[t]}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-3 text-sm text-stone-600">
          <span className="text-2xl text-stone-900">{word.char}</span>{" "}
          <span className="font-medium text-teal-700">{word.pinyin}</span> · {word.gloss}
        </div>
      )}
    </div>
  );
}

function PairRoundView({ round, picked, onPick }: { round: PairRound; picked: string | null; onPick: (c: string) => void }) {
  const answered = picked !== null;
  return (
    <div className="mt-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <AudioButton text={round.target.char} className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-3xl text-teal-700 hover:bg-teal-100" />
        <span className="text-xs text-stone-400">Which word did you hear?</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {round.family.options.map((o) => {
          const correct = answered && o.char === round.target.char;
          const wrong = answered && o.char === picked && o.char !== round.target.char;
          return (
            <button
              key={o.char}
              onClick={() => onPick(o.char)}
              disabled={answered}
              className={`rounded-2xl border py-3 transition ${
                correct ? "border-emerald-300 bg-emerald-50"
                : wrong ? "border-red-300 bg-red-50"
                : "border-stone-200 hover:bg-stone-50"
              }`}
            >
              <div className="text-2xl text-stone-900">{o.char}</div>
              {answered && <div className="text-xs font-medium text-teal-700">{o.pinyin}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
