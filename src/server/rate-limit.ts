import { AppError } from "./errors";
import type { Tx } from "./db";
import { sql } from "./db";

/**
 * Fixed-window rate limit shared by every server instance (stored in Postgres).
 * Call it inside the request's transaction so it costs no extra connection.
 */
export async function rateLimit(
  tx: Tx,
  bucket: string,
  windowSeconds: number,
  max: number,
  message?: string,
): Promise<void> {
  const ok = await tx.scalar<boolean>(
    sql`SELECT app.rate_limit(${bucket}, ${windowSeconds}, ${max})`,
  );
  if (!ok)
    throw new AppError(
      "RATE_LIMITED",
      message ?? "Too many attempts. Please wait a moment and try again.",
    );
}

/** Named policies, so limits are tuned in one place. (Schools share one IP — keep joins generous.) */
export const LIMITS = {
  join: { windowSeconds: 600, max: 600 },
  submit: { windowSeconds: 60, max: 240 },
  contact: { windowSeconds: 3600, max: 5 },
  authedWrite: { windowSeconds: 60, max: 240 },
  upload: { windowSeconds: 3600, max: 60 },
  liveToken: { windowSeconds: 60, max: 30 },
} as const;
