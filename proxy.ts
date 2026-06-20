import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed "middleware" to "proxy" (nodejs runtime).
// This keeps the Supabase auth session fresh on navigation.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except static assets, the service worker, and icons.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};
