import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, HeartHandshake, Lock, Smartphone, Video, Zap } from "lucide-react";

import { MarketingLayout, PageHeading } from "@/components/site/MarketingLayout";
import { Button } from "@/components/ui/button";
import { FREE_TIER } from "@/config/plans";
import { SITE } from "@/config/site";

export const Route = createFileRoute("/about")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: `About us - ${SITE.name}` },
      {
        name: "description",
        content: `${SITE.name} helps tutors teach live, take attendance automatically and keep students engaged - wherever they are.`,
      },
      { property: "og:title", content: `About ${SITE.name}` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AboutPage,
});

const VALUES = [
  {
    icon: Smartphone,
    title: "Built for real classrooms",
    body: "Students on phones, patchy data, a hall of hundreds. Joining takes a link, a name and a phone or matric number — no app, no account.",
  },
  {
    icon: Video,
    title: "Live first",
    body: "Teaching happens together. Video, shared slides, pop quizzes and a live leaderboard keep a big room feeling like a small one.",
  },
  {
    icon: BarChart3,
    title: "Evidence, not guesswork",
    body: "Attendance counts real time present, and analytics show which questions tripped students up — so you know where to spend the next ten minutes.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Student details stay with the tutor who runs the class. Data is isolated per tutor, files are private, and nothing is sold or used for ads.",
  },
  {
    icon: Zap,
    title: "Fast to start",
    body: "Create a class, share the link, go live. Most tutors are teaching in a few minutes.",
  },
  {
    icon: HeartHandshake,
    title: "Fair to tutors",
    body: `Teaching a class of ${FREE_TIER.maxStudentsPerClass} shouldn't need a budget. The essentials are free; Pro is there when you grow — and you can earn by referring colleagues.`,
  },
];

function AboutPage() {
  return (
    <MarketingLayout>
      <PageHeading
        eyebrow="About us"
        title="Students learn from their lecturers - wherever they are."
        intro={`${SITE.name} gives tutors one calm place to teach live, know who showed up, and keep the whole room engaged.`}
      />

      <section className="mx-auto max-w-3xl space-y-4 px-5 pb-12 text-lg leading-relaxed text-foreground/90 sm:px-8">
        <p>
          Most teaching tools were built for small groups on fast connections. Real lectures are
          bigger, noisier and more varied than that. {SITE.name} is designed around how classes
          actually run: large rooms, students joining from their phones, and tutors who need to take
          attendance and check understanding without losing the flow of the lesson.
        </p>
        <p>
          We measure ourselves by one thing: how many students attend a class and stay long enough
          to meet the tutor's attendance threshold. Everything we build - the one-link join, the
          live room, the quizzes, the analytics - serves that.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8" aria-labelledby="values">
        <h2 id="values" className="text-center font-display text-3xl font-bold">
          What we stand for
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="surface-card p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 text-center sm:px-8">
        <div className="surface-card p-8">
          <h2 className="font-display text-2xl font-bold">Ready to teach your next class?</h2>
          <p className="mt-2 text-muted-foreground">
            Create a free tutor account - no card needed.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild className="chunky h-12 rounded-xl px-6 font-bold">
              <Link to="/auth">Start free</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="chunky h-12 rounded-xl border-2 px-6 font-bold"
            >
              <Link to="/contact">Contact us</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
