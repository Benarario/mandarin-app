import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getImportedSession } from "@/app/actions/import";
import ReviewSession from "@/components/ReviewSession";

export const dynamic = "force-dynamic";

export default async function ImportedReviewPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  const { items, mastery, pinyinMode } = await getImportedSession();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-orange-900">No custom cards due 🎉</h1>
        <p className="mt-3 text-stone-600">
          Cards you import or mine from the reader show up here. None are due right now.
        </p>
        <Link href="/import" className="mt-6 inline-block rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white">
          Import cards →
        </Link>
      </main>
    );
  }

  return <ReviewSession initialItems={items} mastery={mastery} pinyinMode={pinyinMode} seededCount={0} />;
}
