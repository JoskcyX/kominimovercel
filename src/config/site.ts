/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *  SITE SETTINGS — the one place to change names, contact details and navigation.
 *  Pages, legal documents, emails and metadata all read from here.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */
const env = import.meta.env;

export const SITE = {
  /** Plain-text brand name (used in page titles, legal text, emails). */
  name: "Kominimo",
  /** The styled wordmark shown in headers: [plain part, highlighted part]. */
  wordmark: ["Kọ́mì", "nímọ̀"] as const,
  tagline: "Teach live. Reach everyone.",
  description:
    "Host live classes with automatic attendance, run quizzes your students enjoy, and publish courses - free for classes of up to 250 students.",

  /** Public origin, no trailing slash. Set VITE_SITE_URL in production. */
  url: ((env["VITE_SITE_URL"] as string | undefined) ?? "").replace(/\/+$/, ""),

  /**
   * Who runs the service. These appear in the Privacy Policy and Terms. Set them before launch:
   * VITE_LEGAL_ENTITY (registered name), VITE_LEGAL_ADDRESS, VITE_CONTACT_EMAIL.
   */
  legalEntity: ((env["VITE_LEGAL_ENTITY"] as string | undefined) ?? "").trim(),
  legalAddress: ((env["VITE_LEGAL_ADDRESS"] as string | undefined) ?? "").trim(),
  contactEmail: ((env["VITE_CONTACT_EMAIL"] as string | undefined) ?? "").trim(),
  /** Country whose law governs the Terms. */
  governingLaw: "the Federal Republic of Nigeria",
  governingCourts: "the courts of Lagos State, Nigeria",
} as const;

/** The name to print where the law requires "the company" (falls back to the brand name). */
export const operatorName = () => SITE.legalEntity || SITE.name;

export const NAV_LINKS = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/courses", label: "Courses" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
] as const;

export const FOOTER_LINKS = {
  Product: [
    { to: "/how-it-works", label: "How it works" },
    { to: "/pricing", label: "Pricing" },
    { to: "/courses", label: "Courses" },
  ],
  Company: [
    { to: "/about", label: "About us" },
    { to: "/contact", label: "Contact us" },
  ],
  Legal: [
    { to: "/terms", label: "Terms of Use" },
    { to: "/privacy", label: "Privacy Policy" },
  ],
} as const;
