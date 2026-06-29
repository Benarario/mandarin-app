"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { importText, type TextImportResult } from "@/app/actions/text-import";

export default function TextImportForm() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ chapters: number; lines: number } | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    setText(await file.text());
    setResult(null);
    setError("");
  }

  async function run() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setResult(null);
    setError("");
    setProgress(null);
    try {
      let from: number | null = 0;
      let chapters = 0;
      let lines = 0;
      let total = 0;
      while (from !== null) {
        const r: TextImportResult = await importText(title, text, from);
        total = r.total;
        chapters += r.inserted;
        lines += r.lines;
        setProgress({ done: Math.min(from + 15, total), total });
        from = r.nextFrom;
      }
      setResult({ chapters, lines });
    } catch {
      setError("Import failed — please check the text and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <header className="mb-4">
        <Link href="/import" className="text-xs text-stone-400 hover:text-stone-600">← Import cards</Link>
        <h1 className="text-2xl font-bold text-orange-900">Import a text</h1>
        <p className="mt-1 text-sm text-stone-500">
          Paste or upload a Chinese text you have the right to use (a novel, an article…). It&apos;s
          split into chapters and added to <strong>your</strong> reader, graded to your level, with
          tap-to-define and audio. Per-word pinyin &amp; meaning come from CC-CEDICT.
        </p>
      </header>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. 小王子)"
        className="mb-3 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm text-stone-800 focus:border-orange-400 focus:outline-none"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"第一章\n从前有一座山……"}
        rows={10}
        className="w-full rounded-2xl border border-stone-300 bg-white p-3 font-mono text-sm text-stone-800 focus:border-orange-400 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Choose .txt file…
        </button>
        <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={onFile} className="hidden" />
        <button
          onClick={run}
          disabled={busy || !text.trim()}
          className="ml-auto rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>

      {busy && progress && (
        <p className="mt-4 text-sm text-stone-500">
          Processing chapters {progress.done} / {progress.total}…
        </p>
      )}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Added <span className="font-semibold">{result.chapters}</span> chapter
          {result.chapters === 1 ? "" : "s"} ({result.lines} lines) to your reader.{" "}
          <Link href="/reader" className="font-semibold underline">Open the reader →</Link>
        </div>
      )}
    </main>
  );
}
