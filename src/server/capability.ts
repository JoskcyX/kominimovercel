import { AppError } from "./errors";
import { serverEnv } from "./env";

/**
 * Students have no account, so what they hold is a SIGNED CAPABILITY TOKEN: it names one
 * participant/member id and expires. The server verifies the signature before acting for that id.
 *
 * Why not just send the bare id (as the old app did)? Public leaderboards/lobbies list ids, so a
 * bare id was both "public name tag" and "secret key" — any student could answer for another.
 * Now ids are public labels and only the token (never listed anywhere) grants control.
 */
export type CapabilityKind = "participant" | "member";
const enc = new TextEncoder();

const b64u = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64u = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const hmacKey = (secret: string, usage: KeyUsage[]) =>
  crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );

export async function signCapability(
  kind: CapabilityKind,
  id: string,
  ttlSeconds: number,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `v1.${kind}.${id}.${exp}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(serverEnv().SESSION_SECRET, ["sign"]),
    enc.encode(body),
  );
  return `${body}.${b64u(sig)}`;
}

/** Returns the id, or throws. Accepts the previous secret during rotation. */
export async function verifyCapability(kind: CapabilityKind, token: string): Promise<string> {
  const bad = () => new AppError("UNAUTHENTICATED", "Your session has expired. Please rejoin.");
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1" || parts[1] !== kind) throw bad();
  const [, , id, expStr, sig] = parts as [string, string, string, string, string];
  if (!/^[0-9a-f-]{36}$/i.test(id) || Number(expStr) < Math.floor(Date.now() / 1000)) throw bad();
  const body = `v1.${kind}.${id}.${expStr}`;
  const env = serverEnv();
  let sigBytes: Uint8Array;
  try {
    sigBytes = fromB64u(sig);
  } catch {
    throw bad();
  }
  for (const secret of [env.SESSION_SECRET, env.SESSION_SECRET_PREVIOUS]) {
    if (!secret) continue;
    if (
      await crypto.subtle.verify(
        "HMAC",
        await hmacKey(secret, ["verify"]),
        sigBytes as BufferSource,
        enc.encode(body),
      )
    )
      return id;
  }
  throw bad();
}

export const PARTICIPANT_TOKEN_TTL = 60 * 60 * 24; // 24 h — one quiz sitting
export const MEMBER_TOKEN_TTL = 60 * 60 * 24 * 120; // ~4 months — a semester
