import { getTtsProvider, type VoiceGender } from "@/lib/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tts?text=你好&voice=female  → MP3 audio.
// The service worker caches these (cache-first) so repeated audio works offline.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const text = url.searchParams.get("text")?.trim();
  const voice = (url.searchParams.get("voice") as VoiceGender) || "female";
  if (!text) return new Response("missing ?text=", { status: 400 });
  if (text.length > 400) return new Response("text too long", { status: 400 });

  try {
    const audio = await getTtsProvider().synthesize(text, voice === "male" ? "male" : "female");
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
