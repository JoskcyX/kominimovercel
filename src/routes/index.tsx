import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CirclePlay,
  Clock3,
  FileText,
  GraduationCap,
  Medal,
  MousePointer2,
  Play,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Video,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EDxKa — Live Quizzes and Courses for Modern Learning" },
      {
        name: "description",
        content:
          "Create live quizzes, publish video or written courses, and give students one engaging place to learn with EDxKa.",
      },
      { property: "og:title", content: "EDxKa — Live Quizzes and Courses for Modern Learning" },
      {
        property: "og:description",
        content:
          "Create live quizzes, publish video or written courses, and give students one engaging place to learn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return;
    // Class and quiz codes share the same alphabet — check classes first,
    // then send whatever is left to the quiz join flow (it shows "not found").
    const { data } = await supabase.rpc("get_class_by_code", { _code: clean });
    if (data && data.length > 0) {
      navigate({ to: "/class/$code", params: { code: clean } });
    } else {
      navigate({ to: "/join/$code", params: { code: clean } });
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <header className="relative z-30 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="font-display text-3xl font-bold" aria-label="EDxKa home">
          ED<span className="text-primary">xKa</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-bold md:flex" aria-label="Main navigation">
          <a href="#quizzes" className="transition-colors hover:text-primary">Live quizzes</a>
          <Link to="/courses" className="transition-colors hover:text-primary">Courses</Link>
          <Link to="/pricing" className="transition-colors hover:text-primary">Pricing</Link>
        </nav>
        <Button asChild variant="outline" className="chunky h-11 rounded-full border-2 px-5 font-bold">
          <Link to="/auth">Tutor sign in</Link>
        </Button>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:pb-24">
          <div className="float-dot left-[4%] top-[12%] size-5 bg-secondary/45" />
          <div className="float-dot right-[7%] top-[8%] size-8 bg-primary/20 [animation-delay:-2s]" />
          <div className="float-dot bottom-[14%] left-[46%] size-4 bg-warning/50 [animation-delay:-4s]" />

          <div className="relative z-10 pop-in">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-secondary bg-accent px-4 py-2 text-sm font-extrabold text-accent-foreground">
              <Sparkles className="size-4" /> Quizzes and courses, all in one place
            </span>
            <h1 className="mt-6 max-w-2xl text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl">
              Learn live. <span className="text-primary">Grow anytime.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Race through tutor-led quizzes with your class, or build lasting skills through video and written courses at your own pace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="chunky h-13 rounded-xl px-7 text-base font-extrabold">
                <Link to="/auth">Create and teach <ArrowRight /></Link>
              </Button>
              <Button asChild variant="outline" className="h-13 rounded-xl border-2 px-7 text-base font-extrabold">
                <Link to="/courses">Explore courses <BookOpen /></Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:translate-y-5">
            <div className="learning-stage relative aspect-[1.05] overflow-hidden rounded-3xl border-2 border-border p-5 sm:p-8">
              <div className="absolute left-7 top-7 rounded-2xl bg-card p-3 shadow-lg float-object">
                <BookOpen className="size-8 text-primary" />
              </div>
              <div className="absolute right-8 top-12 rounded-full bg-secondary p-4 shadow-lg float-object [animation-delay:-1.6s]">
                <GraduationCap className="size-8 text-secondary-foreground" />
              </div>
              <div className="absolute bottom-10 left-10 rounded-full bg-warning p-4 shadow-lg float-object [animation-delay:-3.1s]">
                <Medal className="size-7 text-foreground" />
              </div>
              <div className="absolute bottom-8 right-9 rounded-2xl bg-card p-3 shadow-lg float-object [animation-delay:-2.4s]">
                <FileText className="size-7 text-secondary" />
              </div>

              <div className="absolute inset-x-[15%] top-[20%] rounded-2xl border-2 border-border bg-card p-5 shadow-xl sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-extrabold"><span className="size-2.5 rounded-full bg-success pulse-dot" /> Live quiz</span>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">Question 8/10</span>
                </div>
                <p className="mt-5 font-display text-lg font-bold sm:text-xl">Which organ pumps blood around the body?</p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-sm font-bold">
                  <span className="rounded-lg border-2 border-primary bg-primary/10 p-3">Heart</span>
                  <span className="rounded-lg border-2 border-border bg-muted p-3">Lungs</span>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full w-3/4 rounded-full bg-secondary" /></div>
                  <span className="font-display text-lg font-bold text-primary">14s</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border-2 border-border bg-card px-5 py-3 shadow-xl">
              <Trophy className="size-5 text-primary" />
              <span className="whitespace-nowrap text-sm font-extrabold">Fast answers. Instant results.</span>
            </div>
          </div>
        </section>

        <section id="quizzes" className="border-y-2 border-border bg-card py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
            <div className="relative order-2 lg:order-1">
              <div className="grid grid-cols-[.88fr_1.12fr] items-end gap-4">
                <div className="surface-card translate-y-7 p-5">
                  <Users className="size-8 text-secondary" />
                  <p className="mt-8 text-sm font-bold text-muted-foreground">Students join with one link</p>
                  <p className="mt-1 font-display text-4xl font-bold">Ready!</p>
                </div>
                <div className="rounded-2xl border-2 border-primary bg-primary p-6 text-primary-foreground shadow-xl">
                  <div className="flex items-center justify-between"><Trophy className="size-8" /><span className="text-sm font-bold">Leaderboard</span></div>
                  <ol className="mt-7 space-y-3 text-sm font-extrabold">
                    {["1. Amara", "2. Tobi", "3. Zainab"].map((name, index) => <li key={name} className="flex justify-between rounded-lg bg-card/15 px-3 py-2"><span>{name}</span><span>{980 - index * 45}</span></li>)}
                  </ol>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-sm font-extrabold uppercase text-secondary">For live classes</span>
              <h2 className="mt-3 max-w-xl text-4xl font-bold sm:text-5xl">Turn every lesson into a shared challenge.</h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">Tutors paste in a full question set, share one link, and control the session. Students answer together while EDxKa handles timing, marking, and rankings.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[{ icon: MousePointer2, label: "Paste questions" }, { icon: Play, label: "Start together" }, { icon: Trophy, label: "Rank instantly" }].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 border-t-2 border-border pt-4 font-bold"><item.icon className="size-5 text-primary" />{item.label}</div>
                ))}
              </div>
              <form onSubmit={join} className="mt-9 flex max-w-xl flex-col gap-3 rounded-2xl border-2 border-border bg-background p-3 sm:flex-row">
                <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ENTER CLASS OR QUIZ CODE" maxLength={10} aria-label="Class or quiz code" className="h-12 flex-1 rounded-lg border-0 bg-card text-center text-base font-extrabold sm:text-left" />
                <Button type="submit" className="chunky h-12 rounded-lg px-6 font-extrabold">Join <Zap /></Button>
              </form>
              <p className="mt-2 text-sm text-muted-foreground">Paste the code from your tutor's class or quiz link.</p>
            </div>
          </div>
        </section>

        <section id="courses" className="relative py-20 sm:py-28">
          <div className="float-dot right-[8%] top-[12%] size-7 bg-secondary/30 [animation-delay:-3s]" />
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
              <div>
                <span className="text-sm font-extrabold uppercase text-primary">Learn at your pace</span>
                <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Courses built for real progress.</h2>
                <p className="mt-5 text-lg leading-8 text-muted-foreground">Choose video or written lessons, free or paid, from tutors who know what students need.</p>
                <Button asChild variant="outline" className="mt-7 h-12 rounded-xl border-2 px-6 font-extrabold"><Link to="/courses">Browse all courses <ArrowRight /></Link></Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Video, title: "Video lessons", body: "Watch clear lessons whenever it suits you.", tone: "bg-primary/10 text-primary" },
                  { icon: FileText, title: "Written guides", body: "Read focused material and revisit key ideas.", tone: "bg-accent text-accent-foreground" },
                  { icon: CheckCircle2, title: "Your own pace", body: "Move through every lesson on your schedule.", tone: "bg-warning/25 text-foreground" },
                ].map((item, index) => (
                  <article key={item.title} className={`course-tile rounded-2xl border-2 border-border bg-card p-5 shadow-sm ${index === 1 ? "sm:-translate-y-8" : ""}`}>
                    <span className={`grid size-12 place-items-center rounded-xl ${item.tone}`}><item.icon className="size-6" /></span>
                    <h3 className="mt-7 text-xl font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                    <div className="mt-6 flex items-center gap-2 text-xs font-extrabold uppercase text-primary"><CirclePlay className="size-4" /> Start learning</div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-background sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16 lg:py-16">
            <div className="absolute -right-8 -top-12 size-44 rounded-full border-[24px] border-secondary/30" />
            <div className="absolute bottom-5 right-[32%] size-5 rounded-full bg-primary" />
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase text-secondary"><GraduationCap className="size-5" /> Built for tutors</span>
              <h2 className="mt-4 text-4xl font-bold sm:text-5xl">Your knowledge deserves a bigger classroom.</h2>
              <p className="mt-5 max-w-xl text-lg text-background/70">Create quizzes, publish courses, grow your audience, and give students a better way to learn.</p>
            </div>
            <Button asChild className="chunky relative mt-8 h-14 rounded-xl px-8 text-base font-extrabold lg:mt-0"><Link to="/auth">Sign up as a tutor <ArrowRight /></Link></Button>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-border px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-xl font-bold text-foreground">ED<span className="text-primary">xKa</span></span>
          <p>Live learning and self-paced courses, together.</p>
          <div className="flex gap-5 font-bold"><Link to="/courses">Courses</Link><Link to="/pricing">Pricing</Link><Link to="/auth">Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
