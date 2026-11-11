/**
 * Tiny in-memory TTL cache with in-flight de-duplication. Used for hot, public, read-only polls
 * (e.g. 250 students polling the same quiz): within one server instance they share ONE database
 * query per TTL instead of one each. Per-instance only — never use it for anything user-specific
 * or security-relevant.
 */
type Entry<T> = { at: number; value?: T; inflight?: Promise<T> };
const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit?.value !== undefined && now - hit.at < ttlMs) return hit.value;
  if (hit?.inflight) return hit.inflight;
  const inflight = load()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((e) => {
      store.delete(key);
      throw e;
    });
  store.set(key, {
    at: hit?.at ?? 0,
    ...(hit?.value !== undefined ? { value: hit.value } : {}),
    inflight,
  });
  if (store.size > 2000)
    for (const k of store.keys()) {
      store.delete(k);
      if (store.size < 1500) break;
    }
  return inflight;
}
