import type { Actor } from "../lib/middleware";

/**
 * Short-lived cache of a signed-in user's profile/plan/roles/legal status.
 *
 * Every authenticated call used to re-load the profile (two queries + a transaction) before doing
 * its real work. Tutor screens poll several endpoints, so that doubled their database load. The JWT
 * is still verified on EVERY request; only the profile lookup is cached, for a few seconds.
 *
 * Staleness is bounded by TTL_MS and is safe because the database re-checks what matters:
 *   • admin SQL functions call app.require_admin() themselves (a stale role can't grant access);
 *   • we drop a user's entry immediately on legal acceptance and on admin status/plan changes.
 * (Other server instances pick up a suspension within TTL_MS.)
 */
const TTL_MS = 15_000;
type Stored = Omit<Actor, "ip" | "ipHash">;
const store = new Map<string, { at: number; value: Stored }>();

export const getCachedActor = (userId: string): Stored | undefined => {
  const hit = store.get(userId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(userId);
    return undefined;
  }
  return hit.value;
};

export const setCachedActor = (userId: string, value: Stored): void => {
  if (store.size > 5_000) store.clear();
  store.set(userId, { at: Date.now(), value });
};

export const forgetActor = (userId: string): void => {
  store.delete(userId);
};
