"use client";

import { useRef, useState } from "react";

interface Props {
  text: string;
  voice?: "female" | "male";
  className?: string;
}

/** Plays Mandarin audio for the given text. Degrades quietly if TTS is down. */
export default function AudioButton({ text, voice = "female", className }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function play() {
    setState("loading");
    try {
      const src = `/api/tts?text=${encodeURIComponent(text)}&voice=${voice}`;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = src;
      await audioRef.current.play();
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label="Play audio"
      title={state === "error" ? "Audio unavailable" : "Play audio"}
      className={
        className ??
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700 transition hover:bg-teal-100 active:scale-95"
      }
    >
      {state === "loading" ? "…" : state === "error" ? "🔇" : "🔊"}
    </button>
  );
}
