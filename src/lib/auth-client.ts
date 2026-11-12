import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthVanillaAdapter } from "@neondatabase/auth/vanilla/adapters";

/**
 * Browser-side authentication (Neon Auth / Managed Better Auth).
 * Everything the UI needs goes through the small functions below, so the rest of the app never
 * depends on the SDK's shape — swapping providers later means changing only this file.
 */
let client: ReturnType<typeof make> | undefined;

function make() {
  const url = import.meta.env["VITE_NEON_AUTH_URL"] as string | undefined;
  if (!url) throw new Error("VITE_NEON_AUTH_URL is not set. See .env.example.");
  // Forgive a pasted JWKS URL or trailing slash — the Auth URL ends at …/auth.
  const clean = url
    .trim()
    .replace(/\/\.well-known\/jwks\.json\/?$/i, "")
    .replace(/\/+$/, "");
  return createAuthClient(clean, { adapter: BetterAuthVanillaAdapter() });
}
const auth = () => (client ??= make());

export type AuthUser = { id: string; email: string; name: string };
export type AuthResult = { ok: true } | { ok: false; message: string };

const fail = (e: unknown, fallback = "Something went wrong. Please try again."): AuthResult => ({
  ok: false,
  message: (e as { message?: string } | null)?.message || fallback,
});

export async function getSessionUser(): Promise<AuthUser | null> {
  const { data } = await auth().getSession();
  const u = data?.user;
  return u ? { id: u.id, email: u.email, name: u.name ?? "" } : null;
}

/* Short-lived JWT sent to our server functions. Cached until shortly before it expires. */
let tokenCache: { token: string; exp: number } | null = null;

export async function getAccessToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;
  const { data } = await auth().getSession();
  const token = data?.session?.token;
  if (!token || token.split(".").length !== 3) return null; // not a JWT → not signed in
  try {
    const payload = JSON.parse(
      atob((token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/")),
    );
    tokenCache = { token, exp: Number(payload.exp) || now + 300 };
  } catch {
    tokenCache = { token, exp: now + 120 };
  }
  return token;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await auth().signIn.email({ email, password });
    tokenCache = null;
    return error ? fail(error, "Incorrect email or password.") : { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  try {
    const { error } = await auth().signUp.email({ email, password, name });
    tokenCache = null;
    return error ? fail(error, "We couldn't create your account.") : { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signOutUser(): Promise<void> {
  tokenCache = null;
  try {
    await auth().signOut();
  } catch {
    /* already signed out */
  }
}

export async function sendPasswordReset(email: string, redirectTo: string): Promise<AuthResult> {
  try {
    const { error } = await auth().requestPasswordReset({ email, redirectTo });
    return error ? fail(error) : { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<AuthResult> {
  try {
    const { error } = await auth().resetPassword({ token, newPassword });
    return error ? fail(error, "This reset link is invalid or has expired.") : { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resendVerificationEmail(
  email: string,
  callbackURL: string,
): Promise<AuthResult> {
  try {
    const { error } = await auth().sendVerificationEmail({ email, callbackURL });
    return error ? fail(error) : { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Remembers, in this browser only, that the person ticked the consent box while signing up. */
const CONSENT_KEY = "kominimo.signupConsent";
export const rememberSignupConsent = () => {
  try {
    localStorage.setItem(CONSENT_KEY, String(Date.now()));
  } catch {
    /* storage blocked */
  }
};
export const takeSignupConsent = (): boolean => {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    localStorage.removeItem(CONSENT_KEY);
    return Boolean(v) && Date.now() - Number(v) < 1000 * 60 * 60 * 48;
  } catch {
    return false;
  }
};

/**
 * Best-effort removal of the sign-in identity (email + password hash) held by Neon Auth.
 * Returns false if the auth service doesn't allow self-deletion — the caller should then tell the
 * person we'll remove it manually (see docs/SECURITY.md).
 */
export async function deleteAuthIdentity(): Promise<boolean> {
  try {
    const { error } = await auth().deleteUser({});
    return !error;
  } catch {
    return false;
  }
}
