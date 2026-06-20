import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { ensureStarterDeck, getSession } from "@/app/actions/study";
import ReviewSession from "@/components/ReviewSession";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  // First visit with an empty deck → seed a frequency-ordered HSK-1 starter set.
  const { seeded } = await ensureStarterDeck();
  const session = await getSession();

  if (session.items.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-orange-900">All done for now 🎉</h1>
        <p className="mt-3 text-stone-600">
          No cards are due. Add more words from the reader, or come back later.
        </p>
        <Link href="/reader" className="mt-6 inline-block rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white">
          Open the reader →
        </Link>
      </main>
    );
  }

  return (
    <ReviewSession
      initialItems={session.items}
      mastery={session.mastery}
      pinyinMode={session.pinyinMode}
      seededCount={seeded}
    />
  );
}
