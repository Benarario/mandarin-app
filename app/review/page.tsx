import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getConceptSession } from "@/app/actions/session";
import ConceptReview from "@/components/ConceptReview";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  // Cold-starts a fresh account (phonology first) and tops up new concepts,
  // all gated so nothing untaught is ever shown.
  const session = await getConceptSession();

  if (session.items.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-orange-900">All done for now 🎉</h1>
        <p className="mt-3 text-stone-600">
          No cards are due. Come back later, or read something in the reader.
        </p>
        <Link href="/reader" className="mt-6 inline-block rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white">
          Open the reader →
        </Link>
      </main>
    );
  }

  return (
    <ConceptReview
      initialItems={session.items}
      mastery={session.mastery}
      pinyinMode={session.pinyinMode}
      seeded={session.seeded}
    />
  );
}
