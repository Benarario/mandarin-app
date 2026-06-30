"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBook } from "@/app/actions/text-import";

/** Picker heading for a book/series: shows how many chapters are "comfortable"
 *  (≥80% known) and offers removal for the learner's own imports. */
export default function SeriesHeader({
  series,
  deletable,
  comfortable,
  total,
}: {
  series: string;
  deletable: boolean;
  comfortable?: number;
  total?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    if (!window.confirm(`Remove “${series}” and all its chapters from your reader?`)) return;
    setBusy(true);
    try {
      await deleteBook(series);
      try {
        const all = JSON.parse(localStorage.getItem("reader.progress") || "{}");
        delete all[series];
        localStorage.setItem("reader.progress", JSON.stringify(all));
      } catch {
        /* ignore */
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-stone-700">📚 {series}</h2>
      <div className="flex items-center gap-2">
        {typeof total === "number" && total > 0 && (
          <span className="text-xs text-stone-400">
            {comfortable ?? 0}/{total} comfortable
          </span>
        )}
        {deletable && (
          <button onClick={remove} disabled={busy} className="text-xs text-stone-400 hover:text-red-500 disabled:opacity-50">
            {busy ? "removing…" : "remove"}
          </button>
        )}
      </div>
    </div>
  );
}
