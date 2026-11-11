/**
 * Legal document versions.
 *
 * When you materially change the Terms or Privacy Policy, bump the matching version here (use the
 * date). Every tutor is then asked to accept the new version before they can continue, and the
 * acceptance (who, which version, when) is recorded in the database.
 *
 * The documents themselves live in src/content/legal/.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-11-09",
  privacy: "2026-11-09",
} as const;

export type LegalDoc = keyof typeof LEGAL_VERSIONS;

/** Stored on each student record as proof of what they agreed to when joining. */
export const STUDENT_CONSENT_TAG = `terms:${LEGAL_VERSIONS.terms};privacy:${LEGAL_VERSIONS.privacy}`;

export const LEGAL_EFFECTIVE_DISPLAY = "9 November 2026";
