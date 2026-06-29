"use client";

import { useRef, useState } from "react";

interface Props {
  text: string;
  voice?: "female" | "male";
  className?: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Pre-generated CDN URL for this clip (hash must match lib/tts/storage.ttsKey). */
async function cdnUrl(text: string, voice: string): Promise<string | null> {
  if (!SUPABASE_URL || !globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(`${voice}:${text}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${SUPABASE_URL}/storage/v1/object/public/tts/${hex}.mp3`;
}

/** Load a src into the audio element, rejecting on a load/play error. */
function loadAndPlay(audio: HTMLAudioElement, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = () => { audio.removeEventListener("error", onError); reject(new Error("load")); };
    audio.addEventListener("error", onError, { once: true });
    audio.src = src;
    audio.play().then(
      () => { audio.removeEventListener("error", onError); resolve(); },
      (e) => { audio.removeEventListener("error", onError); reject(e); },
    );
  });
}

/**
 * Plays Mandarin audio. Tries the pre-generated CDN clip first (served from
 * Supabase Storage, no synthesis), then falls back to on-demand /api/tts.
 * Degrades quietly if both fail.
 */
export default function AudioButton({ text, voice = "female", className }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function play() {
    setState("loading");
    const audio = (audioRef.current ??= new Audio());
    try {
      const cdn = await cdnUrl(text, voice);
      if (cdn) {
        try {
          await loadAndPlay(audio, cdn);
          setState("idle");
          return;
        } catch {
          /* not pre-generated yet — fall back to synthesis */
        }
      }
      await loadAndPlay(audio, `/api/tts?text=${encodeURIComponent(text)}&voice=${voice}`);
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
