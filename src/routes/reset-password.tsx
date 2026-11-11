import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/site/Brand";
import { SITE } from "@/config/site";
import { completePasswordReset } from "@/lib/auth-client";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title: `Set a new password — ${SITE.name}` },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Choose a new password for your tutor account using your secure reset link.",
      },
      { property: "og:title", content: `Set a new password — ${SITE.name}` },
      { property: "og:description", content: "Choose a new password for your tutor account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be under 72 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    // The emailed link carries ?token=… (or ?error=… when it is invalid/expired).
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t && !params.get("error") ? t : null);
    setValid(Boolean(t && !params.get("error")));
    setReady(true);
    // Don't leave the one-time token sitting in the address bar / history.
    if (t) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your password");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    const result = await completePasswordReset(token ?? "", parsed.data);
    setBusy(false);
    if (!result.ok) {
      toast.error(/pwned|compromised/i.test(result.message) ? "That password has appeared in a known data breach. Please choose a different one." : result.message);
      return;
    }
    toast.success("Password updated — please sign in with your new password.");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center confetti-bg px-4 py-6 sm:px-6 sm:py-12">
      <div className="pop-in w-full max-w-md surface-card p-5 sm:p-8">
        <Brand className="text-2xl" />
        <h1 className="mt-4 text-3xl font-bold">Set a new password</h1>

        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !valid ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Button
              onClick={() => navigate({ to: "/auth", replace: true })}
              className="chunky mt-6 h-11 w-full rounded-xl font-bold"
            >
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a strong password. At least 8 characters with a letter and a number; breached
              passwords are blocked.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl border-2"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="chunky h-12 w-full rounded-xl text-base font-bold"
              >
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
