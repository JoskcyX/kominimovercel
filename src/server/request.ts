import { getRequest } from "@tanstack/react-start/server";
import { serverEnv } from "./env";

/** Best-effort client IP. Only trusts proxy headers when TRUST_PROXY=true (true on Vercel). */
export function clientIp(request: Request = getRequest()): string {
  if (serverEnv().TRUST_PROXY !== "true") return "unknown";
  const h = request.headers;
  const direct = h.get("x-real-ip") ?? h.get("cf-connecting-ip");
  if (direct) return direct.trim().slice(0, 64);
  const xff = h.get("x-forwarded-for");
  return xff ? (xff.split(",")[0] ?? "unknown").trim().slice(0, 64) : "unknown";
}

/** One-way, salted hash — we rate-limit and audit on this so raw IPs are never stored. */
export async function hashValue(value: string): Promise<string> {
  const data = new TextEncoder().encode(`${serverEnv().SESSION_SECRET}|${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const userAgent = (request: Request = getRequest()) =>
  (request.headers.get("user-agent") ?? "").slice(0, 300);
