"use client";

import { useState } from "react";
import { decidePinyin, isHan, type PinyinMode } from "@/lib/pinyin/fading";
import type { AnnToken } from "@/lib/annotate";

interface Props {
  tokens: AnnToken[];
  mastery: Record<string, number>;
  mode: PinyinMode;
  /** If provided, tapping a word calls this (e.g. open a definition popup)
   *  instead of toggling its pinyin. */
  onWordTap?: (word: string) => void;
  className?: string;
}

export default function PinyinText({ tokens, mastery, mode, onWordTap, className }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  function toggleReveal(key: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <span className={className}>
      {tokens.map((tok, ti) => {
        if (!tok.isWord || !tok.pinyin) {
          return <span key={ti}>{tok.text}</span>;
        }
        const chars = [...tok.text];
        const syllables = tok.pinyin.split(/\s+/);
        const aligned = chars.length === syllables.length;

        const handleWord = () => {
          if (onWordTap) onWordTap(tok.text);
        };

        return (
          <span
            key={ti}
            onClick={handleWord}
            className={onWordTap ? "cursor-pointer rounded hover:bg-orange-100" : ""}
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
                    e.stopPropagation();
                    if (!show) toggleReveal(key);
                  }}
                  className={!show && !onWordTap ? "cursor-pointer" : ""}
                >
                  {ch}
                  <rt>{show ? syl : ""}</rt>
                </ruby>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
