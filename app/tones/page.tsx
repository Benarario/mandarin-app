import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getTonePairExamples } from "@/app/actions/drills";
import PitchContour from "@/components/PitchContour";
import AudioButton from "@/components/AudioButton";

export const dynamic = "force-dynamic";

const TONE_NAME = ["", "1st (high)", "2nd (rising)", "3rd (dipping)", "4th (falling)", "neutral"];

export default async function TonesPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  const examples = await getTonePairExamples();
  const pairs: [number, number][] = [];
  for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) pairs.push([a, b]);

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold text-orange-900">Tone pairs</h1>
      <p className="mt-1 text-sm text-stone-500">
        Mandarin tones are learned best in two-syllable pairs. Tap 🔊 to hear a real word.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {pairs.map(([a, b]) => {
          const ex = examples[`${a}_${b}`];
          const sandhi = a === 3 && b === 3; // 3+3 → 2+3
          const firstTone = sandhi ? 2 : a;
          return (
            <div key={`${a}_${b}`} className="rounded-2xl border border-stone-200 bg-white p-3">
              <div className="flex items-center gap-1">
                <PitchContour tone={firstTone} />
                <span className="text-stone-300">·</span>
                <PitchContour tone={b} />
              </div>
              <div className="mt-1 text-xs font-medium text-stone-500">
                Tone {a} + Tone {b}
              </div>
              {ex ? (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl text-stone-900">{ex.word}</span>
                    <AudioButton text={ex.word} />
                  </div>
                  <div className="text-sm text-teal-700">{ex.pinyin}</div>
                  <div className="truncate text-xs text-stone-500">{ex.english}</div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-stone-400">—</p>
              )}
              {sandhi && (
                <p className="mt-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                  Sandhi: 3+3 → 2+3
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Link href="/" className="mt-8 inline-block text-sm text-stone-500 underline">
        ← Back home
      </Link>
    </main>
  );
}
