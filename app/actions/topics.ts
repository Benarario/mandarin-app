"use server";

import { requireUser } from "@/lib/require-user";
import { getStatusMaps } from "@/lib/graph/mastery";
import { addWordToDeck } from "@/app/actions/mine";
import { TOPICS } from "@/lib/topics";

/** Progress per topic: how many member words the learner has mastered (≥4). */
export async function getTopicProgress(): Promise<Record<string, { mastered: number; total: number }>> {
  const { supabase, user } = await requireUser();
  const { char, word } = await getStatusMaps(supabase, user.id);
  const HAN = /\p{Script=Han}/u;
  const out: Record<string, { mastered: number; total: number }> = {};
  for (const t of TOPICS) {
    let mastered = 0;
    for (const m of t.members) {
      const s = word[m] ?? ([...m].filter((c) => HAN.test(c)).every((c) => (char[c] ?? 0) >= 4) ? 4 : 0);
      if (s >= 4) mastered++;
    }
    out[t.id] = { mastered, total: t.members.length };
  }
  return out;
}

/** Focus a topic: add its (curriculum) words to the deck so sessions include them. */
export async function studyTopic(topicId: string): Promise<{ added: number }> {
  const topic = TOPICS.find((t) => t.id === topicId);
  if (!topic) return { added: 0 };
  let added = 0;
  for (const m of topic.members) {
    const r = await addWordToDeck(m);
    added += r.added;
  }
  return { added };
}
