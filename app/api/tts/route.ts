import { getTtsProvider, type VoiceGender } from "@/lib/tts";
import { createAdminClient } from "@/lib/supabase/admin";
import { ttsKey, uploadTts } from "@/lib/tts/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tts?text=你好&voice=female  → MP3 audio.
// On-demand fallback for audio not yet in the CDN bucket. The service worker
// caches these, and we also persist a copy to Storage so future taps (any
// device) are served from the CDN and never re-synthesized.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const text = url.searchParams.get("text")?.trim();
  const voice: VoiceGender = url.searchParams.get("voice") === "male" ? "male" : "female";
  if (!text) return new Response("missing ?text=", { status: 400 });
  if (text.length > 400) return new Response("text too long", { status: 400 });

  try {
    const audio = await getTtsProvider().synthesize(text, voice);

    // Best-effort: warm the CDN bucket so this is served from Storage next time.
    const admin = createAdminClient();
    if (admin) {
      uploadTts(admin, ttsKey(text, voice), Buffer.from(audio)).catch(() => {});
    }

    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    // Graceful degradation — the UI treats this as "audio unavailable".
    return new Response("tts unavailable", { status: 503 });
  }
}
