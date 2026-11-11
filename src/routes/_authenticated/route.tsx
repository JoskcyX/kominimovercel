import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { LegalGate } from "@/components/legal/LegalGate";
import { Button } from "@/components/ui/button";
import { ME_KEY, useMe } from "@/hooks/usePlan";
import { getSessionUser, signOutUser, takeSignupConsent } from "@/lib/auth-client";
import { acceptLegal } from "@/lib/me.functions";

export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  // Browser-side check for a good experience (redirect). The SERVER re-verifies the token on every call.
  beforeLoad: async () => {
    const user = await getSessionUser().catch(() => null);
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthedLayout,
});

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center px-4 text-center">{children}</div>;
}

function AuthedLayout() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Session rejected by the server (expired / revoked) → back to sign-in.
  useEffect(() => {
    if (me.error instanceof Error && me.error.message === "UNAUTHENTICATED") {
      signOutUser().then(() => navigate({ to: "/auth", replace: true }));
    }
  }, [me.error, navigate]);

  // Someone who ticked the consent box while signing up in THIS browser is recorded automatically.
  const needsAcceptance = me.data && !me.data.legalOk;
  useEffect(() => {
    if (!needsAcceptance) return;
    if (takeSignupConsent()) {
      acceptLegal()
        .then(() => queryClient.invalidateQueries({ queryKey: ME_KEY }))
        .catch(() => undefined);
    }
  }, [needsAcceptance, queryClient]);

  if (me.isLoading)
    return (
      <Centered>
        <p className="text-muted-foreground">Loading your account…</p>
      </Centered>
    );
  if (me.error) {
    return (
      <Centered>
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-bold">We couldn't load your account</h1>
          <p className="text-sm text-muted-foreground">
            {me.error instanceof Error ? me.error.message : "Please try again."}
          </p>
          <Button onClick={() => me.refetch()} className="chunky rounded-xl font-bold">
            Try again
          </Button>
        </div>
      </Centered>
    );
  }
  if (me.data?.status === "suspended") {
    return (
      <Centered>
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-bold">Account suspended</h1>
          <p className="text-sm text-muted-foreground">
            This account has been suspended. Please contact support if you think this is a mistake.
          </p>
          <Button
            variant="outline"
            onClick={() => signOutUser().then(() => window.location.assign("/contact"))}
            className="rounded-xl border-2 font-bold"
          >
            Contact support
          </Button>
        </div>
      </Centered>
    );
  }
  if (needsAcceptance)
    return <LegalGate onAccepted={() => queryClient.invalidateQueries({ queryKey: ME_KEY })} />;
  return <Outlet />;
}
