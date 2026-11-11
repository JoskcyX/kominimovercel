import { createMiddleware } from "@tanstack/react-start";
import { getAccessToken } from "@/lib/auth-client";

/**
 * Server-function middleware.
 *
 *   anonymous  – public endpoints (students, contact form). Adds the caller's hashed IP.
 *   authed     – requires a valid Neon Auth token. Loads the user's profile.
 *   tutor      – authed + account not suspended + current Terms/Privacy accepted. Use for every
 *                feature that creates or reads a tutor's data.
 *   admin      – authed + the `admin` role (for the future admin dashboard).
 *
 * Server-only modules are imported inside the callbacks so they never reach the browser bundle.
 */
export type Actor = {
  userId: string;
  email: string | null;
  displayName: string;
  plan: "free" | "pro";
  status: "active" | "suspended";
  roles: string[];
  referralCode: string | null;
  legalOk: boolean;
  ip: string;
  ipHash: string;
};

export const anonymous = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { clientIp, hashValue } = await import("@/server/request");
  const ip = clientIp();
  return next({ context: { ip, ipHash: await hashValue(ip) } });
});

/** Runs in the browser: attach the signed-in user's token to the request. */
const attachToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = await getAccessToken();
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

export const authed = createMiddleware({ type: "function" })
  .middleware([attachToken])
  .server(async ({ next }) => {
    const [
      { getRequest },
      { bearerFrom, verifyAccessToken },
      { withDb, sql },
      { LEGAL_VERSIONS },
      { clientIp, hashValue },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/server/auth"),
      import("@/server/db"),
      import("@/config/legal"),
      import("@/server/request"),
    ]);
    const request = getRequest();
    const token = bearerFrom(request);
    if (!token) {
      const { AppError } = await import("@/server/errors");
      throw new AppError("UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    const user = await verifyAccessToken(token);
    const actor = await withDb({ userId: user.id }, async (tx) => {
      const p = await tx.one(sql`SELECT * FROM app.touch_profile(${user.email}, ${user.name})`);
      const legalOk = await tx.scalar<boolean>(
        sql`SELECT app.legal_current(${LEGAL_VERSIONS.terms}, ${LEGAL_VERSIONS.privacy})`,
      );
      return { p: p!, legalOk: Boolean(legalOk) };
    });
    const ip = clientIp(request);
    const value: Actor = {
      userId: user.id,
      email: actor.p["email"] ?? user.email,
      displayName: actor.p["display_name"] ?? "",
      plan: actor.p["plan"] === "pro" ? "pro" : "free",
      status: actor.p["status"] === "suspended" ? "suspended" : "active",
      roles: (actor.p["roles"] as string[]) ?? [],
      referralCode: actor.p["referral_code"] ?? null,
      legalOk: actor.legalOk,
      ip,
      ipHash: await hashValue(ip),
    };
    return next({ context: { actor: value } });
  });

export const tutor = createMiddleware({ type: "function" })
  .middleware([authed])
  .server(async ({ next, context }) => {
    const { AppError } = await import("@/server/errors");
    if (context.actor.status === "suspended")
      throw new AppError("SUSPENDED", "This account has been suspended. Please contact support.");
    if (!context.actor.legalOk) throw new AppError("LEGAL_REQUIRED", "LEGAL_REQUIRED");
    return next();
  });

export const admin = createMiddleware({ type: "function" })
  .middleware([authed])
  .server(async ({ next, context }) => {
    const { AppError } = await import("@/server/errors");
    if (context.actor.status !== "active" || !context.actor.roles.includes("admin")) {
      throw new AppError("FORBIDDEN", "You don't have permission to do that.");
    }
    return next();
  });

/**
 * For pages anyone can view but that show more to a signed-in person (e.g. a course you're enrolled
 * in). A missing or invalid token simply means "visitor" — it never errors.
 */
const maybeAttachToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  let token: string | null = null;
  try {
    token = await getAccessToken();
  } catch {
    /* not signed in */
  }
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

export const optionalAuthed = createMiddleware({ type: "function" })
  .middleware([maybeAttachToken])
  .server(async ({ next }) => {
    const [{ getRequest }, { bearerFrom, verifyAccessToken }, { clientIp, hashValue }] =
      await Promise.all([
        import("@tanstack/react-start/server"),
        import("@/server/auth"),
        import("@/server/request"),
      ]);
    const request = getRequest();
    let viewerId: string | null = null;
    const token = bearerFrom(request);
    if (token) {
      try {
        viewerId = (await verifyAccessToken(token)).id;
      } catch {
        viewerId = null;
      }
    }
    const ip = clientIp(request);
    return next({ context: { viewerId, ip, ipHash: await hashValue(ip) } });
  });
