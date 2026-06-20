"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettings } from "@/app/actions/study";
import { createClient } from "@/lib/supabase/client";
import type { UserSettings } from "@/lib/db/types";

const PINYIN_MODES: { value: UserSettings["pinyin_mode"]; label: string }[] = [
  { value: "full", label: "Full — pinyin above every character" },
  { value: "on_tap", label: "On tap — hidden until I tap" },
  { value: "new_only", label: "New only — show for unfamiliar characters" },
  { value: "adaptive", label: "Adaptive — fades as you master each character" },
  { value: "none", label: "None — characters + audio only" },
];

export default function SettingsForm({ settings, email }: { settings: UserSettings; email: string }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  async function save() {
    await updateSettings({
      pinyin_mode: form.pinyin_mode,
      daily_new_cards: form.daily_new_cards,
      desired_retention: form.desired_retention,
      voice_preference: form.voice_preference,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold text-orange-900">Settings</h1>
      <p className="mt-1 text-sm text-stone-500">Signed in as {email}</p>

      <div className="mt-6 space-y-6">
        <Field label="Pinyin display">
          <select
            value={form.pinyin_mode}
            onChange={(e) => setForm({ ...form, pinyin_mode: e.target.value as UserSettings["pinyin_mode"] })}
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          >
            {PINYIN_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`New cards per day: ${form.daily_new_cards}`}>
          <input
            type="range"
            min={5}
            max={40}
            value={form.daily_new_cards}
            onChange={(e) => setForm({ ...form, daily_new_cards: Number(e.target.value) })}
            className="w-full"
          />
        </Field>

        <Field label={`Desired retention: ${(form.desired_retention * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0.8}
            max={0.97}
            step={0.01}
            value={form.desired_retention}
            onChange={(e) => setForm({ ...form, desired_retention: Number(e.target.value) })}
            className="w-full"
          />
          <p className="mt-1 text-xs text-stone-400">
            Higher = more reviews, stronger memory. 90% is the recommended balance.
          </p>
        </Field>

        <Field label="Voice">
          <div className="flex gap-2">
            {(["female", "male"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setForm({ ...form, voice_preference: v })}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm capitalize ${
                  form.voice_preference === v
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-stone-300 text-stone-600"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <button
        onClick={save}
        className="mt-8 w-full rounded-xl bg-orange-600 py-3 font-semibold text-white hover:bg-orange-700"
      >
        {saved ? "Saved ✓" : "Save settings"}
      </button>

      <button
        onClick={signOut}
        className="mt-3 w-full rounded-xl border border-stone-300 py-3 font-medium text-stone-600 hover:bg-stone-50"
      >
        Sign out
      </button>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
