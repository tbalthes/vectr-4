// Lightweight in-memory rate limiter for dev/testing. Replace with Redis or persistent store in prod.
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

export function rateLimit(key: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key) || { tokens: limit, lastRefill: now };
  const elapsed = now - bucket.lastRefill;
  if (elapsed > windowMs) {
    bucket.tokens = limit;
    bucket.lastRefill = now;
  }
  if (bucket.tokens <= 0) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
