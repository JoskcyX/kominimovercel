export const LIVE_RECONNECT_GRACE_MS = 120_000;

export function withinReconnectGrace(interruptedAt: number, now: number) {
  return now - interruptedAt < LIVE_RECONNECT_GRACE_MS;
}

export function isRecentlyPresent(lastSeen: string | null, leftAt: string | null, now = Date.now()) {
  return !!lastSeen && !leftAt && withinReconnectGrace(Date.parse(lastSeen), now);
}