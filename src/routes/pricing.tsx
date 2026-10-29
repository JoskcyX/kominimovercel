import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FREE_TIER, PRO_TIER, formatMoney } from "@/lib/plans";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — EDxKa" },
      {
        name: "description",
        content:
          "Run quizzes free or upgrade to Pro for unlimited quizzes, CSV analytics and a referral income stream.",
      },
      { property: "og:title", content: "Pricing — EDxKa" },
      {
        property: "og:description",
        content: "Free and Pro plans for EDxKa tutors, plus a 20% referral program.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const FREE_FEATURES = [
  "Up to 5 quizzes",
  "Up to 50 questions per quiz",
  "Live lobby & real-time leaderboard",
  "Bulk paste questions",
  "Host controls (pause, skip, extend)",
  "2 published courses",
];

const PRO_FEATURES = [
  "Unlimited quizzes & questions",
  "Unlimited published courses",
  "CSV export of analytics",
  "Remove EDxKa branding",
  "White-label (your own logo & accent)",
  "AI question generator",
  "20% referral income — earn from every tutor you bring on board",
];

function PricingPage() {
  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-2xl font-bold">
          ED<span className="text-primary">xKa</span>
        </Link>
        <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-secondary bg-accent px-4 py-1 text-sm font-bold text-secondary-foreground">
            <Sparkles className="size-4" /> Refer tutors, earn 20%
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">
            Simple pricing, real income
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            Start free. Upgrade to Pro when you scale — and earn a 20% cut of every tutor you refer,
            every month they stay.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="chunky flex flex-col rounded-2xl border-2 bg-card p-8">
            <h2 className="font-display text-2xl font-bold">{FREE_TIER.name}</h2>
            <p className="text-sm text-muted-foreground">{FREE_TIER.tagline}</p>
            <p className="mt-4 font-display text-4xl font-bold">{formatMoney(0, FREE_TIER.currency)}</p>
            <ul className="mt-6 flex-1 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="chunky mt-6 rounded-xl font-bold">
              <Link to="/auth">Get started</Link>
            </Button>
          </article>

          <article className="chunky relative flex flex-col rounded-2xl border-2 border-secondary bg-card p-8">
            <span className="absolute -top-3 left-6 rounded-full border-2 border-secondary bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
              Earn while you teach
            </span>
            <h2 className="font-display text-2xl font-bold">{PRO_TIER.name}</h2>
            <p className="text-sm text-muted-foreground">{PRO_TIER.tagline}</p>
            <p className="mt-4 font-display text-4xl font-bold">
              {formatMoney(PRO_TIER.priceCents, PRO_TIER.currency)}
              <span className="text-base font-normal text-muted-foreground">
                /{PRO_TIER.billingPeriod}
              </span>
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-secondary-foreground" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild className="chunky mt-6 rounded-xl font-bold">
              <Link to="/auth">Upgrade to Pro</Link>
            </Button>
          </article>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Pro is a flat {formatMoney(PRO_TIER.priceCents, PRO_TIER.currency)}/{PRO_TIER.billingPeriod}.
          Refer 5 tutors and your subscription is covered — everything after is profit.
        </p>
      </main>
    </div>
  );
}
