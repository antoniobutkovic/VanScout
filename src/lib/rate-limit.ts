type Bucket = { count: number; resetsAt: number };

const buckets = new Map<string, Bucket>();

function clientAddress(request: Request) {
  return request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export function checkRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${clientAddress(request)}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetsAt <= now ? { count: 0, resetsAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 10_000) {
    for (const [candidate, value] of buckets) if (value.resetsAt <= now) buckets.delete(candidate);
  }
  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000)),
  };
}
