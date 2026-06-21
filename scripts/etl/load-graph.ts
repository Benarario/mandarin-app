// Loads the concept-graph datasets into Supabase (service role).
// Run AFTER applying supabase/migrations/0002_concept_graph.sql.
// Run: npm run etl:graph:load
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { PATHS } from "./sources";

loadEnv({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env (see SETUP.md).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

function readNdjson<T>(file: string): T[] {
  const path = join(PATHS.out, file);
  if (!existsSync(path)) {
    console.error(`Missing ${path}. Run "npm run etl:graph:build" and ":compile" first.`);
    process.exit(1);
  }
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
}

async function loadTable(table: string, rows: object[], pk: string, batch = 500) {
  // Clear then insert (service role bypasses RLS) for idempotency.
  const { error: delErr } = await supabase.from(table).delete().not(pk, "is", null);
  if (delErr) throw new Error(`clear ${table}: ${delErr.message}`);
  for (let i = 0; i < rows.length; i += batch) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + batch));
    if (error) throw new Error(`insert ${table} @${i}: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + batch, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log("Loading components …");
  await loadTable("components", readNdjson("components.ndjson"), "char");

  console.log("Loading characters …");
  await loadTable("characters", readNdjson("characters.ndjson"), "char");

  console.log("Loading words …");
  await loadTable("words", readNdjson("words.ndjson"), "simplified");

  console.log("Loading concepts …");
  type RawConcept = { id: string; type: string; tier: number; ref: string; label: string; gloss: string | null; prereq_ids: string[]; order: number };
  const concepts = readNdjson<RawConcept>("concepts.ndjson").map((c) => ({
    id: c.id,
    type: c.type,
    tier: c.tier,
    ref: c.ref,
    label: c.label,
    gloss: c.gloss,
    prereq_ids: c.prereq_ids,
    teaching_order: c.order,
  }));
  await loadTable("concepts", concepts, "id");

  console.log("\n✓ concept-graph load complete");
}

main().catch((e) => {
  console.error("\nload failed:", e.message);
  process.exit(1);
});
