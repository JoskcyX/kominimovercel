import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/site/Brand";
import { ConsentCheckbox } from "@/components/legal/ConsentCheckbox";
import { Button } from "@/components/ui/button";
import { LEGAL_EFFECTIVE_DISPLAY } from "@/config/legal";
import { acceptLegal } from "@/lib/me.functions";
import { signOutUser } from "@/lib/auth-client";

/**
 * Shown to a signed-in tutor who hasn't accepted the CURRENT Terms and Privacy Policy — new
 * accounts verified on another device, and everyone after we publish a new version.
 * Nothing in the tutor area loads until they accept (the server enforces this too).
 */
export function LegalGate({ onAccepted }: { onAccepted: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await acceptLegal();
      onAccepted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center confetti-bg px-4 py-8">
      <div className="pop-in surface-card w-full max-w-lg space-y-5 p-6 sm:p-8">
        <Brand className="text-2xl" />
        <div>
          <h1 className="text-2xl font-bold">Please review our terms</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Our Terms of Use and Privacy Policy (effective {LEGAL_EFFECTIVE_DISPLAY}) need your
            agreement before you continue. Read them any time:
          </p>
          <p className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
            <Link
              to="/terms"
              target="_blank"
              className="text-primary underline-offset-4 hover:underline"
            >
              Terms of Use
            </Link>
            <Link
              to="/privacy"
              target="_blank"
              className="text-primary underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
        <ConsentCheckbox id="gate-consent" checked={agreed} onChange={setAgreed} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={accept}
            disabled={!agreed || busy}
            className="chunky h-12 flex-1 rounded-xl font-bold"
          >
            {busy ? "Saving…" : "Agree and continue"}
          </Button>
          <Button
            variant="outline"
            onClick={() => signOutUser().then(() => window.location.assign("/"))}
            className="h-12 rounded-xl border-2 font-bold"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
