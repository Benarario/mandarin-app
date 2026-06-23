"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { importCsv, type ImportResult } from "@/app/actions/import";

const SAMPLE = `你好,nǐ hǎo,hello
谢谢,xièxie,thanks
苹果,píngguǒ,apple`;

export default function ImportForm() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setResult(null);
    setError("");
  }

  async function run() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      setResult(await importCsv(text));
    } catch {
      setError("Import failed — please check the file and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <header className="mb-4">
        <Link href="/settings" className="text-xs text-stone-400 hover:text-stone-600">← Settings</Link>
        <h1 className="text-2xl font-bold text-orange-900">Import cards</h1>
        <p className="mt-1 text-sm text-stone-500">
          Paste rows or upload a CSV/TSV (e.g. from Anki). One word per line; the first Chinese
          column is used. Pinyin &amp; meanings are taken from CC-CEDICT — anything not found there
          is held back (quarantined) rather than guessed.
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`hanzi,pinyin,meaning\n${SAMPLE}`}
        rows={8}
        className="w-full rounded-2xl border border-stone-300 bg-white p-3 font-mono text-sm text-stone-800 focus:border-orange-400 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Choose file…
        </button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={onFile} className="hidden" />
        <button
          onClick={() => setText(SAMPLE)}
          className="text-xs text-stone-400 underline hover:text-stone-600"
        >
          load sample
        </button>
        <button
          onClick={run}
          disabled={busy || !text.trim()}
          className="ml-auto rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat n={result.imported} label="added" color="text-emerald-700" />
            <Stat n={result.quarantined} label="quarantined" color="text-amber-600" />
            <Stat n={result.skipped} label="already had" color="text-stone-500" />
          </div>

          {result.imported > 0 && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              Added {result.imported} verified card{result.imported === 1 ? "" : "s"} to your deck, with
              pinyin &amp; meaning from CC-CEDICT.{" "}
              <Link href="/review/imported" className="font-semibold underline">Review them →</Link>
            </p>
          )}

          {result.quarantined > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <p>
                <span className="font-semibold">{result.quarantined}</span> item
                {result.quarantined === 1 ? " was" : "s were"} held back because they aren&apos;t in
                CC-CEDICT, so we won&apos;t teach an unverified reading. They&apos;re saved but
                suspended.
              </p>
              {result.quarantinedSamples.length > 0 && (
                <p className="mt-1 text-base text-amber-900">{result.quarantinedSamples.join("　")}</p>
              )}
            </div>
          )}

          {result.imported === 0 && result.quarantined === 0 && (
            <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
              Nothing new to add{result.skipped > 0 ? " — those words are already in your deck." : "."}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className={`text-2xl font-bold ${color}`}>{n}</div>
      <div className="mt-0.5 text-xs font-medium text-stone-500">{label}</div>
    </div>
  );
}
