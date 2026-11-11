import { serverEnv } from "./env";

/** Constant-time comparison so response timing can't leak the secret. */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i += 1) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/**
 * Scheduled jobs authenticate with `Authorization: Bearer <CRON_SECRET>` — the format Vercel Cron
 * sends automatically when a CRON_SECRET env var exists. Returns a Response on failure, else null.
 */
export function authenticateCron(request: Request): Response | null {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return new Response("Cron is not configured", { status: 503 });
  const h = request.headers.get("authorization") ?? "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  return safeEqual(given, secret) ? null : new Response("Unauthorized", { status: 401 });
}
