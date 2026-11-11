import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { AppError } from "./errors";
import { serverEnv } from "./env";

/**
 * Verifies the short-lived JWT that Neon Auth (Managed Better Auth) issues to a signed-in browser.
 * We pin the algorithm, issuer and audience, and fetch signing keys from Neon's JWKS endpoint
 * (jose caches and rotates them). A token that fails ANY check is treated as not signed in.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let cachedOrigin: string | undefined;

function keys() {
  const base = serverEnv().NEON_AUTH_BASE_URL;
  const origin = new URL(base).origin;
  if (!jwks || cachedOrigin !== origin) {
    jwks = createRemoteJWKSet(new URL(`${origin}/.well-known/jwks.json`), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
    cachedOrigin = origin;
  }
  return { jwks, origin };
}

export type VerifiedUser = { id: string; email: string | null; name: string | null };

export async function verifyAccessToken(
  token: string,
  override?: { jwks?: Parameters<typeof jwtVerify>[1]; origin?: string },
): Promise<VerifiedUser> {
  try {
    const k = override?.jwks ? { jwks: override.jwks, origin: override.origin ?? "" } : keys();
    const { payload }: { payload: JWTPayload } = await jwtVerify(token, k.jwks as never, {
      issuer: k.origin,
      audience: k.origin,
      algorithms: ["EdDSA"],
      clockTolerance: 5,
    });
    const id = typeof payload.sub === "string" ? payload.sub : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("bad subject");
    return {
      id,
      email: typeof payload["email"] === "string" ? (payload["email"] as string) : null,
      name: typeof payload["name"] === "string" ? (payload["name"] as string) : null,
    };
  } catch {
    throw new AppError("UNAUTHENTICATED", "UNAUTHENTICATED");
  }
}

export function bearerFrom(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(h.trim());
  return m?.[1] ?? null;
}
