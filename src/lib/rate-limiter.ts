// lib/rate-limiter.ts
// In-memory sliding-window rate limiter (no external dependencies)

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  const keysToDelete: string[] = [];
  store.forEach((entry: RateLimitEntry, key: string) => {
    entry.timestamps = entry.timestamps.filter((t: number) => t > cutoff);
    if (entry.timestamps.length === 0) keysToDelete.push(key);
  });
  keysToDelete.forEach((key: string) => store.delete(key));
}

/**
 * Check if a request should be rate-limited.
 * @param key      - Unique identifier (e.g. IP address)
 * @param maxHits  - Max requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 * @returns { allowed, remaining, retryAfterMs }
 */
export function rateLimit(
  key: string,
  maxHits: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t: number) => t > cutoff);

  if (entry.timestamps.length >= maxHits) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: maxHits - entry.timestamps.length, retryAfterMs: 0 };
}
