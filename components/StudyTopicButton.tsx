"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { studyTopic } from "@/app/actions/topics";

export default function StudyTopicButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [added, setAdded] = useState(0);

  async function go() {
    setState("busy");
    const r = await studyTopic(topicId);
    setAdded(r.added);
    setState("done");
    router.refresh();
  }

  return (
    <button
      onClick={go}
      disabled={state === "busy"}
      className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
    >
      {state === "busy" ? "Adding…" : state === "done" ? (added ? `+${added} added ✓` : "Up to date ✓") : "Study"}
    </button>
  );
}
