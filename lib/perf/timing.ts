import "server-only";

// Lightweight server-side timing for hot paths (Supabase queries, jieba/annotate).
// Pure measurement: when logging is off it's a transparent pass-through, so it
// never changes behavior. On in dev; in production enable with PERF_LOG=1.
const ENABLED = process.env.PERF_LOG === "1" || process.env.NODE_ENV !== "production";

/** Time an async step, logging "[perf] <label> <ms>". Returns the result as-is. */
export async function timed<T>(label: string, fn: () => Promise<T> | PromiseLike<T>): Promise<T> {
  if (!ENABLED) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    console.log(`[perf] ${label} ${(performance.now() - start).toFixed(1)}ms`);
  }
}

/** Time a synchronous step (e.g. a batch of jieba segmentations). */
export function timedSync<T>(label: string, fn: () => T): T {
  if (!ENABLED) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
    console.log(`[perf] ${label} ${(performance.now() - start).toFixed(1)}ms`);
  }
}
