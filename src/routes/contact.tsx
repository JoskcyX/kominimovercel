import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MarketingLayout, PageHeading } from "@/components/site/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SITE } from "@/config/site";
import { submitContact } from "@/lib/me.functions";
import { contactInput } from "@/lib/validation";

export const Route = createFileRoute("/contact")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: `Contact us — ${SITE.name}` },
      {
        name: "description",
        content: `Questions, feedback or a privacy request? Get in touch with the ${SITE.name} team.`,
      },
      { property: "og:title", content: `Contact ${SITE.name}` },
    ],
  }),
  component: ContactPage,
});

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "support", label: "Help using the app" },
  { value: "sales", label: "Pro plan or schools" },
  { value: "privacy", label: "Privacy or my data" },
  { value: "abuse", label: "Report a problem or abuse" },
  { value: "press", label: "Press" },
] as const;

function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: "general" as (typeof TOPICS)[number]["value"],
    message: "",
    website: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactInput.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    try {
      await submitContact({ data: parsed.data });
      setDone(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "We couldn't send your message. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarketingLayout>
      <PageHeading
        eyebrow="Contact us"
        title="We'd love to hear from you"
        intro="Tell us what you need and we'll reply by email."
      />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 pb-24 sm:px-8 lg:grid-cols-[1fr_20rem]">
        {done ? (
          <div className="surface-card pop-in p-8 text-center lg:col-span-2">
            <CheckCircle2 className="mx-auto size-12 text-primary" />
            <h2 className="mt-4 text-2xl font-bold">Message sent</h2>
            <p className="mt-2 text-muted-foreground">
              Thanks — we'll reply to {form.email} as soon as we can.
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="surface-card space-y-4 p-5 sm:p-8" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Your name</Label>
                  <Input
                    id="c-name"
                    value={form.name}
                    maxLength={120}
                    autoComplete="name"
                    onChange={(e) => set("name", e.target.value)}
                    className="h-11 rounded-xl border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-email">Email</Label>
                  <Input
                    id="c-email"
                    type="email"
                    value={form.email}
                    maxLength={254}
                    autoComplete="email"
                    onChange={(e) => set("email", e.target.value)}
                    className="h-11 rounded-xl border-2"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-topic">What's this about?</Label>
                <select
                  id="c-topic"
                  value={form.topic}
                  onChange={(e) => set("topic", e.target.value as typeof form.topic)}
                  className="h-11 w-full rounded-xl border-2 border-input bg-background px-3 text-sm"
                >
                  {TOPICS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-message">Message</Label>
                <Textarea
                  id="c-message"
                  value={form.message}
                  maxLength={5000}
                  rows={7}
                  onChange={(e) => set("message", e.target.value)}
                  className="rounded-xl border-2"
                />
                <p className="text-xs text-muted-foreground">{form.message.length}/5000</p>
              </div>
              {/* Honeypot: invisible to people, tempting to bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="c-website">Leave this empty</label>
                <input
                  id="c-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="chunky h-12 w-full rounded-xl text-base font-bold"
              >
                {busy ? "Sending…" : "Send message"}
              </Button>
              <p className="text-xs text-muted-foreground">
                We use your details only to reply. See our{" "}
                <a
                  href="/privacy"
                  className="font-bold text-primary underline-offset-4 hover:underline"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>

            <aside className="space-y-4">
              {SITE.contactEmail && (
                <div className="surface-card p-5">
                  <Mail className="size-5 text-primary" />
                  <p className="mt-2 font-bold">Email</p>
                  <a
                    href={`mailto:${SITE.contactEmail}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {SITE.contactEmail}
                  </a>
                </div>
              )}
              <div className="surface-card p-5">
                <ShieldCheck className="size-5 text-primary" />
                <p className="mt-2 font-bold">Privacy requests</p>
                <p className="text-sm text-muted-foreground">
                  Choose “Privacy or my data” to ask about, correct or delete your information.
                  Students: your tutor controls your class records, so ask them first.
                </p>
              </div>
              {SITE.legalAddress && (
                <div className="surface-card p-5 text-sm">
                  <p className="font-bold">Address</p>
                  <p className="text-muted-foreground">{SITE.legalAddress}</p>
                </div>
              )}
            </aside>
          </>
        )}
      </div>
    </MarketingLayout>
  );
}
