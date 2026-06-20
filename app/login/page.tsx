"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const configured = hasSupabaseEnv();

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-orange-900">Sign in</h1>
        <p className="mt-2 text-sm text-stone-600">
          We&apos;ll email you a magic link — no password to remember. Sign in with the
          same email on any device and your progress follows you.
        </p>
      </div>

      {!configured ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Supabase isn&apos;t configured yet. Follow <strong>SETUP.md</strong> to create a
          free project and add your keys to <code>.env.local</code>, then restart.
        </div>
      ) : status === "sent" ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center text-emerald-900">
          ✓ Check your inbox for the sign-in link.
        </div>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 text-base outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-xl bg-orange-600 px-4 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Email me a magic link"}
          </button>
          {status === "error" && (
            <p className="text-sm text-red-600">{message}</p>
          )}
        </form>
      )}
    </main>
  );
}
