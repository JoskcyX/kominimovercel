/**
 * Referral-link capture. Kept in its own tiny module (no server-function imports) so that every public
 * page can use it without downloading the signed-in app's API code.
 */
const REF_KEY = "edxka_ref_code";

/** Capture a ?ref= code from the URL into localStorage for signup attribution. */
export function captureReferralCode() {
  if (typeof window === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (ref && /^[a-zA-Z0-9-]{3,60}$/.test(ref)) {
    try {
      window.localStorage.setItem(REF_KEY, ref);
    } catch {
      /* storage blocked */
    }
  }
}
export function getStoredRefCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}
export function clearStoredRefCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REF_KEY);
  } catch {
    /* ignore */
  }
}
