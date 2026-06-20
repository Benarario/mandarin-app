// Shared check usable on both server and client (plain module, no server-only).
// Treats blank OR placeholder ("REPLACE_ME…") values as "not configured", so a
// freshly-copied .env.local shows the setup screen instead of crashing.
export function hasSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("REPLACE_ME") &&
      !key.includes("REPLACE_ME") &&
      /^https?:\/\//.test(url),
  );
}
