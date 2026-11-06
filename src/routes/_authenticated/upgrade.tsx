import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PRO_TIER, REFERRAL_SPLIT, formatMoney, isPro } from "@/lib/plans";
import { usePlan } from "@/hooks/usePlan";

export const Route = createFileRoute("/_authenticated/upgrade")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Upgrade to Pro — Kominimo" },
      {
        name: "description",
        content:
          "Upgrade to Kominimo Pro for unlimited quizzes, CSV analytics and a 20% referral income stream.",
      },
      { property: "og:title", content: "Upgrade to Pro — Kominimo" },
      { property: "og:description", content: "Explore Kominimo Pro for tutors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UpgradePage,
});

function UpgradePage() {
  const plan = usePlan();
  const me = plan.data;

  const referralSummary = useQuery({
    queryKey: ["referral-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_referral_summary");
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : null) as
        | {
            referral_code: string | null;
            total_referred: number;
            pro_referred: number;
            earnings_pending_cents: number;
            earnings_paid_cents: number;
          }
        | null;
    },
    enabled: isPro(me?.plan),
  });

  const shareUrl =
    typeof window !== "undefined" && referralSummary.data?.referral_code
      ? `${window.location.origin}/?ref=${encodeURIComponent(referralSummary.data.referral_code)}`
      : "";

  if (plan.isLoading) {
    return (
      <div className="min-h-screen confetti-bg p-10 text-muted-foreground">Loading…</div>
    );
  }

  if (isPro(me?.plan)) {
    return (
      <div className="min-h-screen confetti-bg">
        <header className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-4 sm:px-6 sm:py-6">
          <Link to="/dashboard" className="font-display text-xl font-bold sm:text-2xl">
            Kọ́mì<span className="text-primary">nímọ̀</span>
          </Link>
          <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </header>

        <main className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
          <div className="surface-card p-5 sm:p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <Sparkles className="size-7" />
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold">You're on Pro 🎉</h1>
            <p className="mt-2 text-muted-foreground">
              Unlimited quizzes, CSV exports and white-label are unlocked.
            </p>
          </div>

          {shareUrl && (
            <div className="surface-card mt-6 p-6">
              <h2 className="font-display text-xl font-bold">Your referral income</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You earn {Math.round(REFERRAL_SPLIT * 100)}% of every tutor who upgrades with your
                link — {formatMoney(referralSummary.data?.earnings_pending_cents ?? 0, "NGN")} pending
                so far.
              </p>
              <div className="mt-4 flex flex-col gap-2 rounded-xl border-2 border-dashed border-secondary bg-accent p-4 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate text-sm font-bold">{shareUrl}</code>
                <Button
                  variant="secondary"
                  className="chunky shrink-0 rounded-xl font-bold"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Referral link copied");
                  }}
                >
                  Copy link
                </Button>
              </div>
              <Button asChild className="chunky mt-4 rounded-xl font-bold">
                <Link to="/dashboard">See full referral dashboard</Link>
              </Button>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-4 sm:px-6 sm:py-6">
        <Link to="/dashboard" className="font-display text-xl font-bold sm:text-2xl">
          Kọ́mì<span className="text-primary">nímọ̀</span>
        </Link>
        <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
          <Link to="/dashboard">Back</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <div className="surface-card overflow-hidden p-0">
          <div className="bg-secondary p-5 sm:p-8 text-secondary-foreground">
            <h1 className="font-display text-3xl font-bold">Upgrade to Pro</h1>
            <p className="mt-1 opacity-90">
              Unlimited quizzes, CSV analytics, white-label — and a referral income stream.
            </p>
          </div>

          <div className="grid gap-6 p-4 sm:p-8 sm:grid-cols-2">
            <div>
              <p className="break-words font-display text-3xl font-bold sm:text-4xl">
                {formatMoney(PRO_TIER.priceCents, PRO_TIER.currency)}
                <span className="text-base font-normal text-muted-foreground">
                  /{PRO_TIER.billingPeriod}
                </span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "Unlimited quizzes & questions",
                  "Unlimited published courses",
                  "CSV export of all analytics",
                  "Remove Kominimo branding",
                  "White-label your panel",
                  "AI question generator",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-secondary-foreground" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border-2 border-secondary bg-accent p-5">
              <p className="font-bold">Refer & earn</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Refer tutors with your link and earn {Math.round(REFERRAL_SPLIT * 100)}% of their
                subscription — every month. Refer 5 Pro tutors and your own Pro is covered.
              </p>
              <Button
                className="chunky mt-4 w-full rounded-xl font-bold"
                onClick={() =>
                  toast.info(
                    "Card checkout isn't connected yet — payments need to be enabled on this project.",
                  )
                }
              >
                <CreditCard className="size-4" /> Pay {formatMoney(PRO_TIER.priceCents, PRO_TIER.currency)}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                You won't be charged until live payments are connected.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
