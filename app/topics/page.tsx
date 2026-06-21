import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getTopicProgress } from "@/app/actions/topics";
import { TOPICS } from "@/lib/topics";
import StudyTopicButton from "@/components/StudyTopicButton";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  const progress = await getTopicProgress();

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold text-orange-900">Topics</h1>
      <p className="mt-1 text-sm text-stone-500">
        Choose a subject to focus on. “Study” adds that topic’s words to your deck.
      </p>

      <div className="mt-6 grid gap-3">
        {TOPICS.map((t) => {
          const p = progress[t.id] ?? { mastered: 0, total: t.members.length };
          const pct = p.total ? Math.round((p.mastered / p.total) * 100) : 0;
          return (
            <div key={t.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-stone-800">
                  <span aria-hidden>{t.icon}</span>
                  {t.name}
                </div>
                <StudyTopicButton topicId={t.id} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-medium text-stone-500">
                  {p.mastered}/{p.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/" className="mt-8 inline-block text-sm text-stone-500 underline">
        ← Back home
      </Link>
    </main>
  );
}
