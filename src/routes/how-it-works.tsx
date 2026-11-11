import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  Link2,
  Radio,
  Trophy,
  UserCheck,
  Video,
} from "lucide-react";

import { MarketingLayout, PageHeading } from "@/components/site/MarketingLayout";
import { Button } from "@/components/ui/button";
import { FREE_TIER } from "@/config/plans";
import { SITE } from "@/config/site";

export const Route = createFileRoute("/how-it-works")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: `How it works — ${SITE.name}` },
      {
        name: "description",
        content:
          "From creating a class to downloading attendance: the simple workflow for tutors and students.",
      },
      { property: "og:title", content: `How ${SITE.name} works` },
    ],
  }),
  component: HowItWorks,
});

type Step = { icon: typeof Video; title: string; body: string };

const TUTOR_STEPS: Step[] = [
  {
    icon: UserCheck,
    title: "Create your free account",
    body: "Sign up with your email and accept the Terms. You'll land on a dashboard with your classes first and your quizzes below.",
  },
  {
    icon: Link2,
    title: "Create a class and share its link",
    body: `Name your class, then share the code or link. Choose how students get in: you approve each one, only those on your expected list, or everyone automatically — up to ${FREE_TIER.maxStudentsPerClass} students free.`,
  },
  {
    icon: FileText,
    title: "Add materials (optional)",
    body: "Upload slides, PDFs or videos, or add links and notes. Present a PDF live and students follow page by page.",
  },
  {
    icon: Video,
    title: "Go live",
    body: "Start the live class. Approved students join from their phones with one tap. Name a class rep to help admit latecomers.",
  },
  {
    icon: Trophy,
    title: "Check understanding with a quiz",
    body: "Push a pop quiz mid-class or publish an anytime quiz. Watch answers arrive, pause or extend the clock, and show the leaderboard.",
  },
  {
    icon: ClipboardCheck,
    title: "Download attendance and analytics",
    body: "End the class and every session is saved. See who passed your attendance threshold, which questions were hardest, and export to Excel or CSV.",
  },
];

const STUDENT_STEPS: Step[] = [
  {
    icon: Link2,
    title: "Open your tutor's link",
    body: "Tap the link or enter the class code on the home page. No app to install and no account to create.",
  },
  {
    icon: UserCheck,
    title: "Enter your details and agree",
    body: "Give your name and your phone or matric number, and accept the Terms and Privacy Policy. That's all we ask for.",
  },
  {
    icon: Radio,
    title: "Wait for approval",
    body: "Your tutor (or class rep) lets you in. You'll see your status update on screen automatically.",
  },
  {
    icon: Video,
    title: "Join the live class",
    body: "When the class goes live, tap Join. Stay in the room — your time present counts toward attendance.",
  },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.title} className="surface-card flex gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary font-display text-xl font-bold text-primary-foreground">
            {i + 1}
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <s.icon className="size-5 text-primary" /> {s.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function HowItWorks() {
  return (
    <MarketingLayout>
      <PageHeading
        eyebrow="How it works"
        title="From first class to final attendance sheet"
        intro="One simple workflow for tutors, and an even simpler one for students."
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-2">
        <section aria-labelledby="tutors">
          <h2 id="tutors" className="mb-5 font-display text-2xl font-bold">
            For tutors
          </h2>
          <StepList steps={TUTOR_STEPS} />
        </section>
        <section aria-labelledby="students">
          <h2 id="students" className="mb-5 font-display text-2xl font-bold">
            For students
          </h2>
          <StepList steps={STUDENT_STEPS} />
          <div className="surface-card mt-6 border-primary/30 bg-accent/50 p-5 text-sm">
            <p className="font-bold">Live quizzes</p>
            <p className="mt-1 text-muted-foreground">
              When a quiz starts, enter the quiz code, give your name and number, and answer against
              the clock. Faster correct answers rank higher on the leaderboard.
            </p>
          </div>
        </section>
      </div>
      <section className="mx-auto max-w-3xl px-5 pb-24 text-center sm:px-8">
        <Button asChild className="chunky h-12 rounded-xl px-7 text-base font-bold">
          <Link to="/auth">
            Create your first class <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          Free for classes up to {FREE_TIER.maxStudentsPerClass} students.
        </p>
      </section>
    </MarketingLayout>
  );
}
