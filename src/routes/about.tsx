
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  Lock,
  MessageCircle,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Users,
  Video,
  Zap,
} from "lucide-react";

import { MarketingLayout, PageHeading } from "@/components/site/MarketingLayout";
import { Button } from "@/components/ui/button";
import { FREE_TIER } from "@/config/plans";
import { SITE } from "@/config/site";

export const Route = createFileRoute("/about")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: `Our Story - ${SITE.name}` },
      {
        name: "description",
        content: `${SITE.name} is making live learning more accessible, engaging and effective. Discover our story, mission and the people building the future of learning.`,
      },
      { property: "og:title", content: `Our Story - ${SITE.name}` },
      {
        property: "og:description",
        content: "Making every classroom more connected, interactive and engaging.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AboutPage,
});

const VALUES = [
  {
    icon: Smartphone,
    title: "Designed for real classrooms",
    body: "We understand that students don't always have laptops or reliable internet. That's why Kominimo works around the devices and connectivity students actually have.",
  },
  {
    icon: Video,
    title: "Learning happens together",
    body: "We believe education should be interactive. Live classes, shared materials, quizzes and real-time participation bring students and tutors closer.",
  },
  {
    icon: BarChart3,
    title: "Better learning insights",
    body: "Attendance records and class analytics help tutors understand participation, identify knowledge gaps and make more informed teaching decisions.",
  },
  {
    icon: Lock,
    title: "Privacy matters",
    body: "Learning data deserves protection. We build with privacy and responsible data handling in mind, giving tutors control over their classrooms.",
  },
  {
    icon: Zap,
    title: "Simple, not complicated",
    body: "Technology should make teaching easier, not introduce another challenge. Create a class, share a link and get started without unnecessary steps.",
  },
  {
    icon: HeartHandshake,
    title: "Education should be accessible",
    body: `We want more tutors to have access to quality teaching tools, regardless of their resources. Essential classroom features are available for free, with Pro options as they grow.`,
  },
];

function AboutPage() {
  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-32 -top-32 size-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 size-96 rounded-full bg-accent blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
              <Sparkles className="size-4" />
              Our story, our mission
            </div>

            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Making learning more{" "}
              <span className="text-primary">connected, engaging</span> and
              accessible.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              We believe great learning shouldn't be limited by location,
              unreliable connections or the resources available to a classroom.
              Kominimo is changing how tutors teach and how students participate.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild className="chunky h-12 rounded-xl px-6 font-bold">
                <Link to="/auth">
                  Get started
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="chunky h-12 rounded-xl border-2 px-6 font-bold"
              >
                <Link to="/contact">Talk to us</Link>
              </Button>
            </div>
          </div>

          {/* BRAND STATEMENT */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="surface-card relative overflow-hidden rounded-3xl border p-7 sm:p-12">
              <div className="absolute -right-10 -top-10 size-48 rounded-full bg-primary/5 blur-2xl" />

              <div className="relative grid gap-8 md:grid-cols-2 md:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    The Kominimo idea
                  </span>
                  <h2 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
                    A classroom shouldn't end at the classroom door.
                  </h2>
                </div>

                <div>
                  <p className="leading-relaxed text-muted-foreground">
                    Whether a student is in a lecture hall, at home or joining
                    from another part of the country, learning should remain
                    interactive and meaningful.
                  </p>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    That's the thinking behind Kominimo: bringing tutors,
                    students and the entire learning experience into one
                    connected space.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OUR STORY */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Why we started
            </span>

            <h2 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
              We saw an opportunity to make education work better.
            </h2>

            <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
              <p>
                Education is changing, but the tools available to many tutors
                and students haven't always kept up. Large classes, limited
                internet access, disconnected learning tools and difficulty
                tracking student participation can make effective teaching
                unnecessarily difficult.
              </p>

              <p>
                We started building {SITE.name} around a simple observation:
                taking a physical classroom online should not mean losing the
                interaction, structure and connection that make learning
                valuable.
              </p>

              <p>
                Rather than creating another video conferencing tool, we set
                out to build a learning environment where teaching, student
                participation, attendance and classroom engagement work
                together.
              </p>

              <p>
                Today, {SITE.name} is actively being used, and we continue to
                improve it through real classroom experiences and feedback
                from tutors and students.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="surface-card overflow-hidden rounded-3xl p-3">
              <div className="relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl bg-primary/10 p-7 sm:p-10">
                <div className="absolute -right-16 -top-16 size-64 rounded-full border-[35px] border-primary/10" />
                <div className="absolute -bottom-20 -left-16 size-64 rounded-full border-[35px] border-primary/10" />

                <div className="relative">
                  <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    <BookOpen className="size-7" />
                  </div>
                  <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    Our belief
                  </p>
                  <h3 className="mt-3 max-w-sm font-display text-3xl font-bold leading-tight sm:text-4xl">
                    Every student deserves a better learning experience.
                  </h3>
                </div>

                <div className="relative flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full bg-background">
                    <Users className="size-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">
                    One connected learning community.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MISSION AND VISION */}
      <section className="bg-muted/40 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 sm:px-8 md:grid-cols-2">
          <article className="surface-card rounded-3xl p-8 sm:p-10">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Target className="size-6" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold">
              Our mission
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              To make quality teaching and meaningful student participation
              more accessible by giving educators simple, powerful tools to
              create interactive and effective learning experiences.
            </p>
          </article>

          <article className="surface-card rounded-3xl p-8 sm:p-10">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Lightbulb className="size-6" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold">
              Our vision
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              A future where geography, connectivity and limited resources
              never have to stand between a student and a great learning
              experience.
            </p>
          </article>
        </div>
      </section>

      {/* VALUES */}
      <section
        className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24"
        aria-labelledby="values"
      >
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            What guides us
          </span>
          <h2
            id="values"
            className="mt-3 font-display text-3xl font-bold sm:text-4xl"
          >
            The principles behind everything we build.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Our decisions start with the people using our platform. These
            principles guide how we design, develop and improve Kominimo.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="surface-card rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* MEET THE FOUNDER */}
      <section className="bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mb-10 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              The person behind the idea
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Meet the founder
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Every meaningful idea starts with someone who believes things
              can be done better.
            </p>
          </div>

          <div className="surface-card mx-auto max-w-5xl overflow-hidden rounded-3xl border">
            <div className="grid md:grid-cols-[0.85fr_1.15fr]">
              {/* FOUNDER VISUAL */}

              <div className="relative min-h-[300px] overflow-hidden bg-primary/10 md:min-h-[440px]">
                <div className="absolute -left-20 -top-20 size-64 rounded-full border-[35px] border-primary/10" />
                <div className="absolute -bottom-20 -right-20 size-64 rounded-full border-[35px] border-primary/10" />
              </div>

              {/* FOUNDER BIO */}
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                  <Sparkles className="size-3.5" />
                  Founder & Product Engineer
                </div>

                <h3 className="mt-5 font-display text-3xl font-bold sm:text-4xl">
                  Olupeka Joshua
                </h3>

                <p className="mt-2 font-medium text-primary">
                  Founder & Product Engineer, {SITE.name}
                </p>

                <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  <p>
                    Joshua is a technology enthusiast and the founder of
                    {` ${SITE.name}`}. He is currently studying Computer
                    Science and Education at the University of Ilorin, Nigeria.
                  </p>

                  <p>
                    His interest lies at the intersection of technology,
                    education and problem-solving. He believes technology
                    should do more than digitise existing processes; it should
                    create better ways of doing things.
                  </p>

                  <p>
                    That belief inspired him to build Kominimo: a platform
                    focused on helping tutors deliver interactive live
                    classes and helping students become more involved in
                    their learning.
                  </p>

                  <p>
                    He is passionate about building practical technology
                    solutions that address real challenges, particularly
                    within the African education ecosystem.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild className="rounded-xl font-semibold">
                    <a
                      href="https://linkedin.com/in/pekajosh"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Connect on LinkedIn
                      <ArrowUpRight className="ml-2 size-4" />
                    </a>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    className="rounded-xl font-semibold"
                  >
                    <Link to="/contact">
                      Get in touch
                      <MessageCircle className="ml-2 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm italic leading-relaxed text-muted-foreground">
            "We're not just building another classroom tool. We're working
            towards a future where every learner has a better opportunity to
            participate, understand and succeed."
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-7 py-14 text-center text-primary-foreground sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full border-[45px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-40 -left-20 size-80 rounded-full border-[45px] border-white/10" />

          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/15">
              <GraduationCap className="size-7" />
            </div>

            <h2 className="mt-6 font-display text-3xl font-bold sm:text-4xl">
              Better classrooms start with better connections.
            </h2>

            <p className="mt-4 leading-relaxed text-primary-foreground/80">
              Join tutors and students making learning more interactive.
              Create your classroom and experience a better way to teach and
              learn.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                className="chunky h-12 rounded-xl bg-background px-6 font-bold text-foreground hover:bg-background/90"
              >
                <Link to="/auth">
                  Start teaching for free
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="chunky h-12 rounded-xl border-white/40 bg-transparent px-6 font-bold text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/contact">Contact our team</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
