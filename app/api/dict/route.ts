import { NextResponse } from "next/server";
import { lookupExact } from "@/lib/dict/lookup";

// Read-only CC-CEDICT lookup → run on the edge (low-latency, near the user).
// Only fetch is used (Supabase via @supabase/ssr); no Node-only APIs.
export const runtime = "edge";

// GET /api/dict?w=词  → verified CC-CEDICT entries for a word.
// The service worker caches these so tap-to-define keeps working offline.
export async function GET(request: Request) {
  const word = new URL(request.url).searchParams.get("w")?.trim();
  if (!word) {
    return NextResponse.json({ error: "missing ?w=" }, { status: 400 });
  }
  try {
    const entries = await lookupExact(word);
    return NextResponse.json(
      { word, entries },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
