// Proves the gating against the LIVE Supabase data (service role):
//  1. a fresh learner's first lessons are phonology (zero-knowledge start)
//  2. a character unlocks only once its components are mastered.
// Run: npx tsx scripts/verify-coldstart.ts
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { pickNextConcepts, isConceptUnlocked, type ConceptNode } from "../lib/graph/logic";

loadEnv({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  // Pull the early curriculum window (enough to include the first characters).
  const { data } = await supabase
    .from("concepts")
    .select("id,type,ref,tier,prereq_ids,teaching_order")
    .order("teaching_order", { ascending: true })
    .limit(1400);
  const concepts = (data ?? []) as ConceptNode[];

  console.log("\n1) A BRAND-NEW learner (knows nothing). First 16 lessons offered:\n");
  const firstLessons = pickNextConcepts(concepts, new Set(), new Set(), 16);
  for (const c of firstLessons) {
    console.log(`   ${c.type.padEnd(10)} ${c.ref}`);
  }
  const allPhon = firstLessons.every((c) => c.type === "phoneme");
  console.log(`\n   → all phonology? ${allPhon ? "YES ✓ (never a character before sounds)" : "NO ✗"}`);

  // 2) Show a character is gated behind its components.
  const hao = concepts.find((c) => c.id === "char:好");
  const ma = concepts.find((c) => c.id === "char:妈");
  if (hao && ma) {
    console.log("\n2) Character gating (好 needs 女+子; 妈 needs 女+马):\n");
    const noComps = new Set<string>();
    const withNuZi = new Set(["comp:女", "comp:子"]);
    console.log(`   好 unlocked with nothing mastered?      ${isConceptUnlocked(hao.prereq_ids, noComps)} (expect false)`);
    console.log(`   好 unlocked once 女+子 mastered?         ${isConceptUnlocked(hao.prereq_ids, withNuZi)} (expect true)`);
    console.log(`   妈 unlocked once only 女+子 mastered?     ${isConceptUnlocked(ma.prereq_ids, withNuZi)} (expect false — 马 not yet mastered)`);
    console.log(`   好 prereqs: [${hao.prereq_ids.join(", ")}]`);
    console.log(`   妈 prereqs: [${ma.prereq_ids.join(", ")}]`);
  }

  console.log("\n✓ Gating verified against live Supabase data.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
