import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase auth session on every request and keeps the auth
 * cookies in sync. Called from the top-level `proxy.ts` (Next.js 16 renamed
 * "middleware" to "proxy"). Adapted from the official @supabase/ssr pattern.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If Supabase isn't configured yet, do nothing (lets the app boot pre-setup).
  if (!hasSupabaseEnv()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // guaranteed by hasSupabaseEnv() above
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user to trigger a token refresh when needed.
  try {
    await supabase.auth.getUser();
  } catch {
    // Unreachable/invalid credentials must not break navigation.
  }

  return response;
}
