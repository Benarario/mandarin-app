import Link from "next/link";

export const metadata = { title: "Why you can trust this · Mandarin" };

const SOURCES = [
  {
    name: "CC-CEDICT",
    role: "Every definition and pinyin reading",
    license: "CC BY-SA 4.0",
    url: "https://www.mdbg.net/chinese/dictionary?page=cc-cedict",
  },
  {
    name: "Unihan (Unicode)",
    role: "Radicals, stroke counts and the 214 components",
    license: "Unicode License",
    url: "https://www.unicode.org/charts/unihan.html",
  },
  {
    name: "cjk-decomp",
    role: "Character decomposition (好 = 女 + 子)",
    license: "Apache-2.0",
    url: "https://github.com/amake/cjk-decomp",
  },
  {
    name: "complete-hsk-vocabulary",
    role: "HSK 3.0 / 2.0 level tags and word-frequency ordering",
    license: "see repository",
    url: "https://github.com/drkameleon/complete-hsk-vocabulary",
  },
  {
    name: "Tatoeba",
    role: "Verified example sentences",
    license: "CC BY 2.0 FR",
    url: "https://tatoeba.org/",
  },
];

export default function TrustPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold text-orange-900">Why you can trust this</h1>
      <p className="mt-3 text-stone-700">
        A wrong fact you memorise through spaced repetition is expensive to unlearn. So this
        app never invents Chinese-language facts. Definitions, pinyin and tones come{" "}
        <strong>only</strong> from published, citable datasets — not from a language model&apos;s
        guess.
      </p>

      <ul className="mt-6 space-y-3">
        {SOURCES.map((s) => (
          <li key={s.name} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline">
                {s.name}
              </a>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                {s.license}
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-600">{s.role}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">The verification gate</p>
        <p className="mt-1">
          A card can only enter study once its Chinese validates against CC-CEDICT. If a word
          isn&apos;t in the dictionary, it&apos;s marked unverified and never taught as fact.
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        <p className="font-semibold">Never taught out of order</p>
        <p className="mt-1">
          Everything is arranged as a prerequisite graph — sounds, then character components, then
          characters, then words. You are <strong>never shown, quizzed, or asked about anything
          before you&apos;ve learned what it&apos;s built from</strong>. Each character only appears
          after its components are mastered, and each word only after its characters.
        </p>
      </div>

      <p className="mt-6 text-xs text-stone-400">
        Scheduling uses the FSRS-6 algorithm via the MIT-licensed <code>ts-fsrs</code> library,
        which tracks the same engine Anki uses. Anki itself was studied only as a behavioural
        reference; none of its (copyleft) code ships here.
      </p>

      <Link href="/" className="mt-8 inline-block text-sm text-stone-500 underline">
        ← Back home
      </Link>
    </main>
  );
}
