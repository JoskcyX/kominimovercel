import { serverEnv } from "./env";
import { AppError } from "./errors";

/** Thin wrapper around the Daily.co REST API (live video). Server-only. */
export async function daily(path: string, init: RequestInit = {}) {
  const key = serverEnv().DAILY_API_KEY;
  if (!key) throw new AppError("UNAVAILABLE", "Live video isn't connected yet.");
  const res = await fetch(`https://api.daily.co/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error("[daily]", res.status, path);
    throw new AppError("UNAVAILABLE", "The video service had a problem. Please try again.");
  }
  return res.json();
}

export async function meetingToken(
  room: string,
  userName: string,
  owner: boolean,
  userId: string,
  rep = false,
): Promise<string> {
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
