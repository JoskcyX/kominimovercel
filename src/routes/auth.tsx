import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsentCheckbox } from "@/components/legal/ConsentCheckbox";
import { Brand } from "@/components/site/Brand";
import {
  getSessionUser,
  rememberSignupConsent,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth-client";
import { SITE } from "@/config/site";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: `Tutor sign in — ${SITE.name}` },
      {
        name: "description",
        content: "Sign in or create a tutor account to build quizzes and run live sessions.",
      },
      { property: "og:title", content: `Tutor sign in — ${SITE.name}` },
      { property: "og:description", content: "Create quizzes and run live sessions with your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be under 72 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    getSessionUser()
      .then((user) => {
        if (user) navigate({ to: "/dashboard", replace: true });
      })
      .catch(() => undefined);
  }, [navigate]);

  const friendlyError = (error: unknown) => {
    const details = typeof error === "object" && error !== null ? error as { message?: unknown; code?: unknown; status?: unknown } : undefined;
    const rawMessage = typeof details?.message === "string" ? details.message.trim() : typeof error === "string" ? error.trim() : "";
    const code = typeof details?.code === "string" ? details.code : "";
    const message = !rawMessage || /^(\{\s*\}|\[object Object\])$/.test(rawMessage)
      ? "We couldn't complete your request. Please try again."
      : rawMessage;
    if (details?.status === 500 || code === "unexpected_failure" || /database error|saving new user/i.test(message)) {
      return "Account creation is temporarily unavailable. Please try again shortly; no confirmation email was sent.";
    }
    if (/rate limit|too many/i.test(message) || /over_.*rate_limit/.test(code)) {
      return "Too many requests right now. Please wait before trying again.";
    }
    if (/pwned|compromised/i.test(message)) {
      return "That password has appeared in a known data breach. Please choose a different one.";
    }
    if (/failed to fetch|network|load failed/i.test(message)) {
      return "We couldn't connect. Check your internet connection and try again.";
    }
    return message;
  };

  const resend = async () => {
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return;
    setBusy(true);
    const result = await resendVerificationEmail(parsedEmail.data, `${window.location.origin}/auth`);
    setBusy(false);
    if (result.ok) toast.success("Confirmation email sent again.");
    else toast.error(friendlyError(result.message));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      toast.error(parsedEmail.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }

    if (mode === "forgot") {
      setBusy(true);
      const result = await sendPasswordReset(parsedEmail.data, `${window.location.origin}/reset-password`);
      setBusy(false);
      // Same screen whether or not the account exists, so this can't be used to discover accounts.
      if (!result.ok && !/not found|no user/i.test(result.message)) toast.error(friendlyError(result.message));
      else setSent("reset");
      return;
    }

    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      toast.error(parsedPassword.error.issues[0]?.message ?? "Check your password");
      return;
    }
    if (mode === "signup" && !agreed) {
      toast.error("Please accept the Terms of Use and Privacy Policy to create your account.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await signUpWithEmail(parsedEmail.data, parsedPassword.data, displayName.trim() || parsedEmail.data.split("@")[0]!);
        if (!result.ok) throw result;
        rememberSignupConsent();
        const user = await getSessionUser();
        if (!user) {
          setSent("confirm");
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const result = await signInWithEmail(parsedEmail.data, password);
        if (!result.ok) throw result;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg px-4 py-6 sm:px-6 sm:py-12">
        <div className="pop-in w-full max-w-md surface-card p-5 sm:p-8 text-center">
          <MailCheck className="mx-auto size-12 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sent === "confirm"
              ? `We sent a confirmation link to ${email}. Click it to activate your tutor account, then sign in.`
              : `If an account exists for ${email}, you'll receive a password reset link. Use it as soon as it arrives.`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing yet? Check spam or promotions — delivery can take a minute.
          </p>
          <div className="mt-6 space-y-2">
            {sent === "confirm" && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={resend}
                className="h-11 w-full rounded-xl font-bold"
              >
                Resend confirmation email
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                setSent(null);
                setMode("signin");
                setPassword("");
              }}
              className="chunky h-11 w-full rounded-xl font-bold"
            >
              Back to sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center confetti-bg px-4 py-6 sm:px-6 sm:py-12">
      <div className="pop-in w-full max-w-md surface-card p-5 sm:p-8">
        <Brand className="text-2xl" />
        <h1 className="mt-4 text-3xl font-bold">
          {mode === "signin"
            ? "Welcome back, tutor"
            : mode === "signup"
              ? "Create your tutor account"
              : "Reset your password"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to build quizzes and run live sessions."
            : mode === "signup"
              ? "Your quizzes, questions and leaderboards live in your account."
              : "Enter your account email and we'll send you a secure reset link."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Mrs. Adeyemi"
                maxLength={60}
                className="h-11 rounded-xl border-2"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@school.com"
              className="h-11 rounded-xl border-2"
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-11 rounded-xl border-2"
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">
                  At least 8 characters with a letter and a number. Breached passwords are blocked.
                </p>
              )}
            </div>
          )}
          {mode === "signup" && <ConsentCheckbox id="signup-consent" checked={agreed} onChange={setAgreed} />}
          <Button type="submit" disabled={busy || (mode === "signup" && !agreed)} className="chunky h-12 w-full rounded-xl text-base font-bold">
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </Button>
        </form>

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="mt-4 w-full text-sm font-bold text-muted-foreground underline-offset-4 hover:underline"
          >
            Forgot your password?
          </button>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-3 w-full text-sm font-bold text-primary underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "New here? Create a tutor account" : "Back to sign in"}
        </button>
      </div>
    </div>
  );
}
