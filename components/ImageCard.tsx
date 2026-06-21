"use client";

import { visualFor } from "@/lib/visuals/emoji";

/** A dual-coded picture for a concrete character/word. Renders nothing for
 *  abstract/function words (no emoji), which are taught in context instead. */
export default function ImageCard({ text, size = "text-6xl" }: { text: string; size?: string }) {
  const emoji = visualFor(text);
  if (!emoji) return null;
  return (
    <div className={`${size} leading-none`} role="img" aria-label={`picture for ${text}`}>
      {emoji}
    </div>
  );
}
