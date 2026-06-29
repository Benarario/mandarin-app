import Link from "next/link";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getCounts } from "@/app/actions/study";
import { getHabitStats } from "@/app/actions/habit";
import HabitWidget from "@/components/HabitWidget";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <Header />
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">One quick setup step</p>
          <p className="mt-2">
            Create a free Supabase project and paste your keys into{" "}
            <code>.env.local</code>. Open <strong>SETUP.md</strong> for plain-language,
            click-by-click instructions, then restart the app.
          </p>
        </div>
        <TrustLink />
      </main>
    );
  }

  const user = await getUser();
  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <Header />
        <p className="mt-4 text-stone-600">
          Spaced-repetition flashcards, a tap-to-define reader, and a four-skill progress
          dashboard — with definitions that are always sourced, never invented.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700"
        >
          Get started
        </Link>
        <TrustLink />
      </main>
    );
  }

  const [counts, habit] = await Promise.all([getCounts(), getHabitStats()]);
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Header />
      <section className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Due now" value={counts.due} accent="text-orange-700" />
        <Stat label="New" value={counts.newCards} accent="text-teal-700" />
        <Stat label="In deck" value={counts.total} accent="text-stone-700" />
      </section>

      <HabitWidget stats={habit} />

      <Link
        href="/review"
        className="mt-6 block rounded-2xl bg-orange-600 px-6 py-4 text-center text-lg font-semibold text-white shadow-sm transition hover:bg-orange-700"
      >
        {counts.total === 0 ? "Start with a starter deck →" : "Start today's session →"}
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/reader" className="rounded-2xl border border-stone-200 bg-white p-4 text-center font-medium hover:border-orange-300">
          📖 Read
        </Link>
        <Link href="/topics" className="rounded-2xl border border-stone-200 bg-white p-4 text-center font-medium hover:border-orange-300">
          🗂️ Topics
        </Link>
        <Link href="/tones" className="rounded-2xl border border-stone-200 bg-white p-4 text-center font-medium hover:border-orange-300">
          🎵 Tones
        </Link>
        <Link href="/dashboard" className="rounded-2xl border border-stone-200 bg-white p-4 text-center font-medium hover:border-orange-300">
          📊 Progress
        </Link>
        <Link href="/import" className="col-span-2 rounded-2xl border border-stone-200 bg-white p-4 text-center font-medium hover:border-orange-300">
          ⬆️ Import cards
        </Link>
      </div>
      <TrustLink />
    </main>
  );
}

function Header() {
  return (
    <header>
      <h1 className="text-3xl font-bold text-orange-900">学中文</h1>
      <p className="text-sm font-medium text-stone-500">Your personal Mandarin trainer</p>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-stone-500">{label}</div>
    </div>
  );
}

function TrustLink() {
  return (
    <div className="mt-8 flex justify-between text-sm">
      <Link href="/trust" className="text-teal-700 underline">
        Why you can trust this
      </Link>
      <Link href="/settings" className="text-stone-500 underline">
        Settings
      </Link>
    </div>
  );
}
