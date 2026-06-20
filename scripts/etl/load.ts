// Loads the parsed NDJSON into Supabase using the service-role key.
// This is the ONLY step that needs Supabase configured. Run: npm run etl:load
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { PATHS } from "./sources";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\nMissing Supabase credentials. Copy .env.local.example to .env.local and fill in\n" +
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (see SETUP.md).\n",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function readNdjson<T>(file: string): T[] {
  const path = join(PATHS.out, file);
  if (!existsSync(path)) {
    console.error(`Missing ${path}. Run "npm run etl:build" first.`);
    process.exit(1);
  }
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

async function loadTable(table: string, rows: object[], batchSize = 500) {
  // Clear existing rows so re-runs are idempotent (service role bypasses RLS).
  const { error: delErr } = await supabase.from(table).delete().gte("id", 0);
  if (delErr) throw new Error(`clear ${table}: ${delErr.message}`);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`insert ${table} @${i}: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log("Loading dictionary …");
  await loadTable("dictionary", readNdjson("dictionary.ndjson"));

  console.log("Loading sentences …");
  await loadTable("sentences", readNdjson("sentences.ndjson"));

  // Sanity check.
  const { count } = await supabase.from("dictionary").select("*", { count: "exact", head: true });
  console.log(`\n✓ load complete — dictionary now has ${count} rows in Supabase.`);
}

main().catch((e) => {
  console.error("\nload failed:", e.message);
  process.exit(1);
});
