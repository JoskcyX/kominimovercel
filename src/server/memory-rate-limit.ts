import { AppError } from "./errors";

/**
 * In-memory fixed-window limiter for the hottest student endpoints (answers, heartbeats).
 *
 * Those requests already carry an unforgeable signed token, so abuse is bounded per student and a
 * per-instance counter is enough — without the database write + round trip that the shared limiter
 * (src/server/rate-limit.ts) costs. Use the Postgres limiter for anything anonymous or expensive
 * (joins, contact form, uploads, video tokens), where limits must hold across all instances.
 */
const windows = new Map<string, { resetAt: number; hits: number }>();

export function memoryRateLimit(key: string, windowSeconds: number, max: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now >= w.resetAt) {
    windows.set(key, { resetAt: now + windowSeconds * 1000, hits: 1 });
    if (windows.size > 20_000) {
      for (const [k, v] of windows) if (now >= v.resetAt) windows.delete(k);
      if (windows.size > 20_000) windows.clear(); // pathological flood: fail open rather than grow without bound
    }
    return true;
  }
  w.hits += 1;
  return w.hits <= max;
}

export function assertMemoryRate(
  key: string,
  windowSeconds: number,
  max: number,
  message?: string,
): void {
  if (!memoryRateLimit(key, windowSeconds, max)) {
    throw new AppError(
      "RATE_LIMITED",
      message ?? "Too many requests. Please slow down for a moment.",
    );
  }
}
