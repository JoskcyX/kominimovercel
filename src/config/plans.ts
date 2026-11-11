/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *  PLANS & PRICING — edit the numbers and wording here. The pricing page, the upgrade page and
 *  the server-side limit checks all read from this file.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */
export type PlanId = "free" | "pro";

export type PlanTier = {
  id: PlanId;
  name: string;
  tagline: string;
  priceCents: number;
  currency: string;
  billingPeriod: string | null;
  /** Approved students allowed in ONE class. */
  maxStudentsPerClass: number;
  maxQuizzes: number;
  maxQuestionsPerQuiz: number;
  maxCourses: number;
  /** Largest single upload, in megabytes. */
  maxUploadMb: number;
  canRemoveBranding: boolean;
  canWhiteLabel: boolean;
  canUseAi: boolean;
};

export const FREE_TIER: PlanTier = {
  id: "free",
  name: "Free",
  tagline: "Everything you need to teach a full class — no card, no time limit",
  priceCents: 0,
  currency: "NGN",
  billingPeriod: null,
  maxStudentsPerClass: 250,
  maxQuizzes: 5,
  maxQuestionsPerQuiz: 50,
  maxCourses: 2,
  maxUploadMb: 200,
  canRemoveBranding: false,
  canWhiteLabel: false,
  canUseAi: false,
};

export const PRO_TIER: PlanTier = {
  id: "pro",
  name: "Pro",
  tagline: "For departments and big lecture halls — and earn from referrals",
  priceCents: 250000,
  currency: "NGN",
  billingPeriod: "month",
  maxStudentsPerClass: 1000,
  maxQuizzes: Number.POSITIVE_INFINITY,
  maxQuestionsPerQuiz: Number.POSITIVE_INFINITY,
  maxCourses: Number.POSITIVE_INFINITY,
  maxUploadMb: 1024,
  canRemoveBranding: true,
  canWhiteLabel: true,
  canUseAi: true,
};

export const PLAN_TIERS: Record<PlanId, PlanTier> = { free: FREE_TIER, pro: PRO_TIER };

/** Referrer earns this fraction of every subscription they bring in. */
export const REFERRAL_SPLIT = 0.2;

export const tierFor = (plan: PlanId | null | undefined): PlanTier =>
  plan === "pro" ? PRO_TIER : FREE_TIER;
export const isPro = (plan: PlanId | null | undefined): boolean => plan === "pro";
export const isUnlimited = (n: number) => !Number.isFinite(n);
export const limitLabel = (n: number) => (isUnlimited(n) ? "Unlimited" : n.toLocaleString("en"));

export function formatMoney(cents: number, currency: string): string {
  if (cents <= 0) return "Free";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(0)}`;
  }
}

export const proPriceLabel = () =>
  `${formatMoney(PRO_TIER.priceCents, PRO_TIER.currency)}/${PRO_TIER.billingPeriod}`;

/* ── Pricing-page copy ───────────────────────────────────────────────────────────────────
 * Only list what the platform really does. `soon: true` shows a "Coming soon" tag.            */
export type Feature = { text: string; hint?: string; soon?: boolean };

export const FREE_FEATURES: Feature[] = [
  {
    text: `Live video classes for up to ${FREE_TIER.maxStudentsPerClass} students`,
    hint: "Per class. Run as many sessions as you like.",
  },
  {
    text: "Automatic attendance — free",
    hint: "Counts real time present, not just who clicked join. Download as Excel or CSV.",
  },
  {
    text: "Quiz & student analytics — free",
    hint: "Hardest questions, accuracy, speed, and progress across every quiz.",
  },
  {
    text: "Live quizzes with a real-time leaderboard",
    hint: "Timed questions, host controls, pop quizzes pushed mid-class.",
  },
  {
    text: "Paste your whole question list",
    hint: "Numbered questions with an “Answer:” line import in one go.",
  },
  { text: "Share slides, PDFs and videos", hint: "Present pages live so everyone follows along." },
  {
    text: "Class rep & expected-students list",
    hint: "Let a trusted student admit and manage the class.",
  },
  {
    text: "No student accounts needed",
    hint: "Students join with a link, a name and a phone or matric number.",
  },
  { text: `Up to ${FREE_TIER.maxQuizzes} quizzes and ${FREE_TIER.maxCourses} published courses` },
];

export const PRO_FEATURES: Feature[] = [
  { text: "Everything in Free", hint: "Nothing is taken away when you upgrade." },
  {
    text: `Bigger classes — up to ${PRO_TIER.maxStudentsPerClass.toLocaleString("en")} students each`,
  },
  { text: "Unlimited quizzes, questions and published courses" },
  { text: `Larger uploads — files up to ${PRO_TIER.maxUploadMb / 1024} GB` },
  {
    text: "20% referral income",
    hint: "Earn a share of the subscription fees from every tutor you refer.",
  },
  { text: "Remove Kominimo branding", soon: true },
  { text: "White-label with your own logo & colours", soon: true },
  { text: "AI question generator", soon: true },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "Is the Free plan really free?",
    a: `Yes. There's no trial and no card. You can host live classes of up to ${FREE_TIER.maxStudentsPerClass} students, take automatic attendance and see quiz analytics for as long as you like.`,
  },
  {
    q: "What counts toward the 250-student limit?",
    a: "Approved students in a single class. Students waiting for approval don't count, and the limit applies per class — a second class has its own 250 places.",
  },
  {
    q: "Do my students need to pay or sign up?",
    a: "Never. Students join with the class link and their name plus a phone or matric number. Only tutors have accounts.",
  },
  {
    q: "What happens if I go over a limit?",
    a: "Nothing you've already built is deleted. You just can't add more until you remove some or upgrade.",
  },
  {
    q: "When can I pay for Pro?",
    a: "Card checkout is being connected. Until then, get in touch and we'll set you up — and anything marked “Coming soon” is on the way.",
  },
];
