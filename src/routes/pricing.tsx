import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock, Sparkles, Users } from "lucide-react";

import { MarketingLayout } from "@/components/site/MarketingLayout";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FREE_FEATURES,
  FREE_TIER,
  PRICING_FAQ,
  PRO_FEATURES,
  PRO_TIER,
  REFERRAL_SPLIT,
  formatMoney,
  limitLabel,
  type Feature,
} from "@/config/plans";
import { SITE } from "@/config/site";

export const Route = createFileRoute("/pricing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      {
        title: `Pricing — free classes up to ${FREE_TIER.maxStudentsPerClass} students | ${SITE.name}`,
      },
      {
        name: "description",
        content: `Host live classes for up to ${FREE_TIER.maxStudentsPerClass} students free, with automatic attendance and analytics included. Upgrade to Pro for bigger classes and referral income.`,
      },
      {
        property: "og:title",
        content: `${SITE.name} pricing — free for classes up to ${FREE_TIER.maxStudentsPerClass} students`,
      },
      {
        property: "og:description",
        content: "Free live classes, attendance and analytics. Pro when you scale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function FeatureList({ features, tone }: { features: Feature[]; tone: "free" | "pro" }) {
  return (
    <ul className="mt-6 flex-1 space-y-3">
      {features.map((f) => (
        <li key={f.text} className="flex items-start gap-3 text-sm">
          <Check
            className={`mt-0.5 size-4 shrink-0 ${tone === "free" ? "text-primary" : "text-secondary-foreground"}`}
          />
          <span>
            <span className="font-bold">{f.text}</span>
            {f.soon && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 align-middle text-[11px] font-bold text-muted-foreground">
                <Clock className="size-3" /> Coming soon
              </span>
            )}
            {f.hint && <span className="mt-0.5 block text-muted-foreground">{f.hint}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const COMPARE: { label: string; free: string; pro: string }[] = [
  {
    label: "Students per class",
    free: `Up to ${FREE_TIER.maxStudentsPerClass}`,
    pro: `Up to ${PRO_TIER.maxStudentsPerClass.toLocaleString("en")}`,
  },
  { label: "Live classes", free: "Unlimited sessions", pro: "Unlimited sessions" },
  { label: "Automatic attendance + Excel/CSV export", free: "Included", pro: "Included" },
  { label: "Quiz & student analytics", free: "Included", pro: "Included" },
  {
    label: "Quizzes",
    free: limitLabel(FREE_TIER.maxQuizzes),
    pro: limitLabel(PRO_TIER.maxQuizzes),
  },
  {
    label: "Questions per quiz",
    free: limitLabel(FREE_TIER.maxQuestionsPerQuiz),
    pro: limitLabel(PRO_TIER.maxQuestionsPerQuiz),
  },
  {
    label: "Published courses",
    free: limitLabel(FREE_TIER.maxCourses),
    pro: limitLabel(PRO_TIER.maxCourses),
  },
  {
    label: "Largest file upload",
    free: `${FREE_TIER.maxUploadMb} MB`,
    pro: `${PRO_TIER.maxUploadMb / 1024} GB`,
  },
  { label: "Referral income", free: "—", pro: `${Math.round(REFERRAL_SPLIT * 100)}% share` },
];

function PricingPage() {
  return (
    <MarketingLayout>
      <div className="confetti-bg">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
          <div className="pop-in text-center">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-secondary bg-accent px-4 py-1 text-sm font-bold text-secondary-foreground">
              <Sparkles className="size-4" /> Free classes of up to {FREE_TIER.maxStudentsPerClass}{" "}
              students
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">
              Teach a full class. For free.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
              Live video, automatic attendance and quiz analytics are free — no card, no trial
              clock. Upgrade to Pro only when you outgrow it, and earn{" "}
              {Math.round(REFERRAL_SPLIT * 100)}% of the fees from every tutor you refer.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild className="chunky h-12 rounded-xl px-6 text-base font-bold">
                <Link to="/auth">Start free</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="chunky h-12 rounded-xl border-2 px-6 text-base font-bold"
              >
                <Link to="/how-it-works">See how it works</Link>
              </Button>
            </div>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <article className="chunky flex flex-col rounded-2xl border-2 bg-card p-5 sm:p-8">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                <h2 className="font-display text-2xl font-bold">{FREE_TIER.name}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{FREE_TIER.tagline}</p>
              <p className="mt-4 font-display text-4xl font-bold">
                {formatMoney(0, FREE_TIER.currency)}
                <span className="text-base font-normal text-muted-foreground"> forever</span>
              </p>
              <FeatureList features={FREE_FEATURES} tone="free" />
              <Button asChild className="chunky mt-6 h-12 rounded-xl font-bold">
                <Link to="/auth">Get started free</Link>
              </Button>
            </article>

            <article className="chunky relative flex flex-col rounded-2xl border-2 border-secondary bg-card p-5 sm:p-8">
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
              <FeatureList features={PRO_FEATURES} tone="pro" />
              <Button
                asChild
                variant="outline"
                className="chunky mt-6 h-12 rounded-xl border-2 font-bold"
              >
                <Link to="/upgrade">Upgrade to Pro</Link>
              </Button>
            </article>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Refer 5 Pro tutors and your own subscription is covered — everything after that is
            income.
          </p>

          <section className="mt-16" aria-labelledby="compare">
            <h2 id="compare" className="text-center font-display text-2xl font-bold sm:text-3xl">
              Compare plans
            </h2>
            <div className="surface-card mt-6 overflow-x-auto p-2 sm:p-4">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="px-3 py-3 font-bold">Feature</th>
                    <th className="px-3 py-3 font-bold">{FREE_TIER.name}</th>
                    <th className="px-3 py-3 font-bold">{PRO_TIER.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.label} className="border-b border-border last:border-0">
                      <td className="px-3 py-3 font-bold">{r.label}</td>
                      <td className="px-3 py-3 text-muted-foreground">{r.free}</td>
                      <td className="px-3 py-3 text-muted-foreground">{r.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-16" aria-labelledby="faq">
            <h2 id="faq" className="text-center font-display text-2xl font-bold sm:text-3xl">
              Questions, answered
            </h2>
            <Accordion
              type="single"
              collapsible
              className="surface-card mx-auto mt-6 max-w-3xl px-4 sm:px-6"
            >
              {PRICING_FAQ.map((f, i) => (
                <AccordionItem key={f.q} value={`q${i}`}>
                  <AccordionTrigger className="text-left font-bold">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Still unsure?{" "}
              <Link
                to="/contact"
                className="font-bold text-primary underline-offset-4 hover:underline"
              >
                Talk to us
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}
