// Pre-generate review-queue audio into the public Supabase Storage bucket so
// the app serves clips straight from the CDN instead of synthesizing on first
// tap. Uses the same edge-tts voice + the same object key as the app.
// Run: npm run tts:pregen        (TTS_LIMIT=N to change how many concepts)
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

loadEnv({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const BUCKET = "tts";
const VOICE = "female";
const VOICE_NAME = "zh-CN-XiaoxiaoNeural"; // matches lib/tts/edge.ts female voice
const LIMIT = Number(process.env.TTS_LIMIT ?? 400);
const CONCURRENCY = 5;

const key = (text: string) => createHash("sha256").update(`${VOICE}:${text}`, "utf8").digest("hex") + ".mp3";

async function synth(text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE_NAME, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const result = tts.toStream(text);
  const stream = (result as { audioStream?: NodeJS.ReadableStream }).audioStream ?? (result as unknown as NodeJS.ReadableStream);
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: "2MB",
      allowedMimeTypes: ["audio/mpeg"],
    });
    if (error) throw error;
    console.log(`Created public bucket "${BUCKET}".`);
  }
}

async function existingKeys(): Promise<Set<string>> {
  const set = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase.storage.from(BUCKET).list("", { limit: 1000, offset });
    if (!data || data.length === 0) break;
    for (const f of data) set.add(f.name);
    if (data.length < 1000) break;
  }
  return set;
}

async function main() {
  await ensureBucket();

  // Texts the review queue speaks: characters + words, in teaching order, plus
  // the tone example characters. All are sourced refs — no fabricated text.
  const { data: concepts } = await supabase
    .from("concepts")
    .select("ref, type")
    .in("type", ["character", "word"])
    .order("teaching_order", { ascending: true })
    .limit(LIMIT);
  const texts = new Set<string>(["妈", "麻", "马", "骂", "吗"]);
  for (const c of (concepts ?? []) as { ref: string }[]) texts.add(c.ref);

  const have = await existingKeys();
  const todo = [...texts].filter((t) => !have.has(key(t)));
  console.log(`${texts.size} target clips · ${have.size} already in CDN · ${todo.length} to generate`);

  let done = 0,
    failed = 0;
  let i = 0;
  async function worker() {
    while (i < todo.length) {
      const text = todo[i++];
      try {
        const mp3 = await synth(text);
        const { error } = await supabase.storage.from(BUCKET).upload(key(text), mp3, {
          contentType: "audio/mpeg",
          upsert: true,
          cacheControl: "604800",
        });
        if (error) throw error;
        done++;
      } catch (e) {
        failed++;
        console.warn(`  ✗ ${text}: ${(e as Error).message}`);
      }
      if ((done + failed) % 25 === 0) console.log(`  … ${done + failed}/${todo.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. generated ${done}, failed ${failed}, skipped ${texts.size - todo.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
