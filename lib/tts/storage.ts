import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceGender } from "./types";

// Pre-generated TTS audio lives in a public Supabase Storage bucket and is
// served straight from the CDN, so the app rarely synthesizes on demand.
export const TTS_BUCKET = "tts";

/**
 * Deterministic object key for a (text, voice) pair. MUST match the hash the
 * browser computes in AudioButton: sha256("<voice>:<text>") + ".mp3".
 */
export function ttsKey(text: string, voice: VoiceGender): string {
  return createHash("sha256").update(`${voice}:${text}`, "utf8").digest("hex") + ".mp3";
}

/** Public CDN URL for a stored audio key. */
export function ttsPublicUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${TTS_BUCKET}/${key}`;
}

/** Create the public audio bucket if it doesn't exist (idempotent). */
export async function ensureTtsBucket(admin: SupabaseClient): Promise<void> {
  const { data } = await admin.storage.getBucket(TTS_BUCKET);
  if (data) return;
  await admin.storage.createBucket(TTS_BUCKET, {
    public: true,
    fileSizeLimit: "2MB",
    allowedMimeTypes: ["audio/mpeg"],
  });
}

/** Upload (upsert) one MP3 by key. */
export async function uploadTts(admin: SupabaseClient, key: string, mp3: Buffer): Promise<void> {
  await admin.storage.from(TTS_BUCKET).upload(key, mp3, {
    contentType: "audio/mpeg",
    upsert: true,
    cacheControl: "604800",
  });
}
