import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { REFERRAL_SPLIT, formatMoney } from "@/config/plans";
import { getReferralList, getReferralSummary } from "@/lib/me.functions";

type Summary = {
  referral_code: string | null;
  total_referred: number;
  pro_referred: number;
  earnings_pending_cents: number;
  earnings_paid_cents: number;
};

type ReferredRow = {
  display_name: string;
  plan: string;
  joined_at: string;
  earnings_cents: number;
};

export function ReferralDashboard() {
  const summary = useQuery({
    queryKey: ["referral-summary"],
    queryFn: async () => (await getReferralSummary()) as Summary | null,
  });

  const list = useQuery({
    queryKey: ["referral-list"],
    queryFn: async () => (await getReferralList()) as ReferredRow[],
  });

  const code = summary.data?.referral_code ?? null;
  const shareUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/?ref=${encodeURIComponent(code)}`
      : "";

  const pending = summary.data?.earnings_pending_cents ?? 0;
  const paid = summary.data?.earnings_paid_cents ?? 0;

  return (
    <section className="surface-card min-w-0 space-y-5 p-4 sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <Gift className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-bold">Earn with referrals</h2>
          <p className="text-sm text-muted-foreground">
            Share your link — earn {Math.round(REFERRAL_SPLIT * 100)}% of every tutor who upgrades
            to Pro, every month they stay subscribed.
          </p>
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-secondary bg-accent p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Your referral link
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 truncate rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-bold">
            {shareUrl || "Loading…"}
          </code>
          <Button
            variant="secondary"
            className="chunky shrink-0 rounded-xl font-bold"
            disabled={!shareUrl}
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast.success("Referral link copied — share it with other tutors");
            }}
          >
            <Copy className="size-4" /> Copy
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Users className="size-5" />}
          label="Tutors referred"
          value={`${summary.data?.total_referred ?? 0}`}
        />
        <Stat
          icon={<TrendingUp className="size-5" />}
          label="On Pro"
          value={`${summary.data?.pro_referred ?? 0}`}
        />
        <Stat
          icon={<Gift className="size-5" />}
          label="Pending earnings"
          value={formatMoney(pending, "NGN")}
          highlight
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          People you've referred
        </h3>
        {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {list.data?.length === 0 && (
          <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No referrals yet — share your link to start earning.
          </p>
        )}
        <div className="space-y-2">
          {list.data?.map((row) => (
            <div
              key={row.display_name + row.joined_at}
              className="grid min-w-0 gap-2 rounded-xl border-2 border-border bg-card px-3 py-3 sm:flex sm:items-center sm:justify-between sm:px-4"
            >
              <div>
                <p className="break-words font-bold">{row.display_name || "Tutor"}</p>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(row.joined_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm font-bold">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    row.plan === "pro"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {row.plan === "pro" ? "Pro" : "Free"}
                </span>
                {row.earnings_cents > 0 && (
                  <span className="text-primary">{formatMoney(row.earnings_cents, "NGN")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Earnings show as "pending" until a payout is processed. You keep{" "}
        {Math.round(REFERRAL_SPLIT * 100)}% of each referred tutor's Pro subscription for as long as
        they remain subscribed.
      </p>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`mt-1 font-display text-2xl font-bold ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
