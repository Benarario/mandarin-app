"use client";

import { useEffect, useState } from "react";
import { decidePinyin, isHan, type PinyinMode } from "@/lib/pinyin/fading";
import type { AnnToken } from "@/lib/annotate";

interface Props {
  tokens: AnnToken[];
  mastery: Record<string, number>;
  mode: PinyinMode;
  /** If provided, tapping a word calls this (e.g. open a definition popup)
   *  instead of toggling its pinyin. */
  onWordTap?: (word: string) => void;
  /** Optional per-word CSS classes (e.g. mastery-status colour in the reader). */
  colorFor?: (word: string) => string;
  /** Opt in to a "reveal meaning" hint: tapping a word whose pinyin is currently
   *  faded shows a small popover with its pinyin + gloss. Off by default so a
   *  recognition prompt is never auto-spoiled. Ignored when onWordTap is set. */
  glossHint?: boolean;
  className?: string;
}

export default function PinyinText({ tokens, mastery, mode, onWordTap, colorFor, glossHint, className }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [hint, setHint] = useState<number | null>(null); // token index whose gloss popover is open

  function toggleReveal(key: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Dismiss the gloss popover on any tap-away (the opening tap stops propagation).
  useEffect(() => {
    if (hint === null) return;
    const close = () => setHint(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [hint]);

  return (
    <span className={className}>
      {tokens.map((tok, ti) => {
        if (!tok.isWord || !tok.pinyin) {
          return <span key={ti}>{tok.text}</span>;
        }
        const chars = [...tok.text];
        const syllables = tok.pinyin.split(/\s+/);
        const aligned = chars.length === syllables.length;

        // A word is "faded" when at least one of its characters hides its pinyin
        // by default (mastered, or a hide-pinyin mode). The gloss hint only
        // applies to such words, and only when the caller opted in (no sheet).
        const faded = chars.some((ch) => isHan(ch) && !decidePinyin(mode, mastery[ch]).show);
        const hintable = !!glossHint && !onWordTap && !!tok.gloss && faded;

        const handleWord = (e: React.MouseEvent | React.KeyboardEvent) => {
          if (onWordTap) {
            onWordTap(tok.text);
            return;
          }
          if (hintable) {
            e.stopPropagation();
            setHint((h) => (h === ti ? null : ti));
          }
        };

        return (
          <span
            key={ti}
            onClick={handleWord}
            {...(hintable
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  "aria-label": `Reveal meaning of ${tok.text}`,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleWord(e);
                    }
                  },
                }
              : {})}
            className={`${onWordTap || hintable ? "cursor-pointer rounded hover:bg-orange-100" : ""} ${
              hintable ? "relative inline-block" : ""
            } ${colorFor?.(tok.text) ?? ""}`}
          >
            {chars.map((ch, ci) => {
              if (!isHan(ch)) return <span key={ci}>{ch}</span>;
              const syl = aligned ? syllables[ci] : ci === 0 ? tok.pinyin : "";
              const key = `${ti}:${ci}`;
              const decision = decidePinyin(mode, mastery[ch]);
              const show = decision.show || revealed.has(key);
              return (
                <ruby
                  key={ci}
                  onClick={(e) => {
                    if (onWordTap) return; // word handler takes over
                    if (hintable) return; // bubble to the word span (opens the gloss popover)
                    e.stopPropagation();
                    if (!show) toggleReveal(key);
                  }}
                  className={!show && !onWordTap && !hintable ? "cursor-pointer" : ""}
                >
                  {ch}
                  <rt>{show ? syl : ""}</rt>
                </ruby>
              );
            })}

            {/* Pulled-on-demand meaning hint for a faded word. */}
            {hint === ti && (
              <span
                role="tooltip"
                onClick={(e) => e.stopPropagation()}
                className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left leading-tight shadow-lg"
              >
                <span className="block whitespace-nowrap text-sm font-medium text-teal-700">{tok.pinyin}</span>
                {tok.gloss && (
                  <span className="block max-w-[12rem] whitespace-normal text-xs text-stone-600">{tok.gloss}</span>
                )}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
