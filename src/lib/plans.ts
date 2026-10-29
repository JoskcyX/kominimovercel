export type PlanId = "free" | "pro";

export type PlanTier = {
  id: PlanId;
  name: string;
  tagline: string;
  priceCents: number;
  currency: string;
  billingPeriod: string | null;
  maxQuizzes: number;
  maxQuestionsPerQuiz: number;
  maxCourses: number;
  canExportCsv: boolean;
  canRemoveBranding: boolean;
  canWhiteLabel: boolean;
  canUseAi: boolean;
};

export const FREE_TIER: PlanTier = {
  id: "free",
  name: "Free",
  tagline: "Everything you need to run a class quiz",
  priceCents: 0,
  currency: "NGN",
  billingPeriod: null,
  maxQuizzes: 5,
  maxQuestionsPerQuiz: 50,
  maxCourses: 2,
  canExportCsv: false,
  canRemoveBranding: false,
  canWhiteLabel: false,
  canUseAi: false,
};

export const PRO_TIER: PlanTier = {
  id: "pro",
  name: "Pro",
  tagline: "Scale across departments and earn from referrals",
  priceCents: 250000,
  currency: "NGN",
  billingPeriod: "month",
  maxQuizzes: Number.POSITIVE_INFINITY,
  maxQuestionsPerQuiz: Number.POSITIVE_INFINITY,
  maxCourses: Number.POSITIVE_INFINITY,
  canExportCsv: true,
  canRemoveBranding: true,
  canWhiteLabel: true,
  canUseAi: true,
};

export const PLAN_TIERS: Record<PlanId, PlanTier> = {
  free: FREE_TIER,
  pro: PRO_TIER,
};

/** Referrer earns this fraction of every subscription they bring in. */
export const REFERRAL_SPLIT = 0.2;

export function tierFor(plan: PlanId | null | undefined): PlanTier {
  return plan === "pro" ? PRO_TIER : FREE_TIER;
}

export function isPro(plan: PlanId | null | undefined): boolean {
  return plan === "pro";
}

export function formatMoney(cents: number, currency: string): string {
  if (cents <= 0) return "Free";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(0)}`;
  }
}

export function proPriceLabel(): string {
  return `${formatMoney(PRO_TIER.priceCents, PRO_TIER.currency)}/${PRO_TIER.billingPeriod}`;
}
