import { serverEnv } from "./env";
import { AppError } from "./errors";

/**
 * Thin wrapper around the Daily.co REST API (live video). Server-only.
 *
 * A class starting means hundreds of students ask for a room token at once. Daily rate-limits its
 * REST API, so we (1) cap how many requests are in flight per server instance, (2) retry 429/5xx
 * with jittered backoff honouring Retry-After, and (3) reuse a student's token if they reconnect.
 */
let inFlight = 0;
const waiting: (() => void)[] = [];
const MAX_IN_FLIGHT = 8;
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((r) => waiting.push(r));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function daily(path: string, init: RequestInit = {}) {
  const key = serverEnv().DAILY_API_KEY;
  if (!key) throw new AppError("UNAVAILABLE", "Live video isn't connected yet.");
  return slot(async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://api.daily.co/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      if (res.status === 404) return null;
      if (res.ok) return res.json();
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < 4) {
        const wait = Number(res.headers.get("retry-after")) * 1000 || 400 * 2 ** attempt;
        await sleep(Math.min(wait, 5000) * (0.75 + Math.random() * 0.5));
        continue;
      }
      console.error("[daily]", res.status, path);
      throw new AppError("UNAVAILABLE", "The video service is busy. Please try again in a moment.");
    }
  });
}

const tokenCache = new Map<string, { at: number; token: string }>();
const TOKEN_REUSE_MS = 10 * 60_000;

export async function meetingToken(
  room: string,
  userName: string,
  owner: boolean,
  userId: string,
  rep = false,
): Promise<string> {
  const cacheKey = `${room}|${userId}|${owner}|${rep}`;
  const hit = tokenCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TOKEN_REUSE_MS) return hit.token;
  const t = await daily("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: room,
        user_name: userName.slice(0, 60),
        user_id: userId,
        is_owner: owner,
        start_video_off: !owner,
        start_audio_off: !owner,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6,
        // A class rep can mute/remove participants but cannot end the class like the tutor can.
        ...(rep ? { permissions: { canAdmin: ["participants"] } } : {}),
      },
    }),
  });
  if (tokenCache.size > 5000) tokenCache.clear();
  tokenCache.set(cacheKey, { at: Date.now(), token: t.token as string });
  return t.token as string;
}

export async function createRoom() {
  return daily("/rooms", {
    method: "POST",
    body: JSON.stringify({
      privacy: "private",
      properties: {
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6,
        enable_chat: true,
        enable_screenshare: true,
        enable_prejoin_ui: true,
      },
    }),
  });
}
