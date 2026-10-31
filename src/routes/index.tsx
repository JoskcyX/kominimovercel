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
      { title: "Kominimo — Live Quizzes and Courses for Modern Learning" },
      {
        name: "description",
        content:
          "Create live quizzes, publish video or written courses, and give students one engaging place to learn with Kominimo.",
      },
      { property: "og:title", content: "Kominimo — Live Quizzes and Courses for Modern Learning" },
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
      <header className="relative z-30 mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-8">
        <Link to="/" className="font-display text-2xl font-bold sm:text-3xl" aria-label="Kominimo home">
          Kọ́mì<span className="text-primary">nímọ̀</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-bold md:flex" aria-label="Main navigation">
          <a href="#quizzes" className="transition-colors hover:text-primary">Live quizzes</a>
          <Link to="/courses" className="transition-colors hover:text-primary">Courses</Link>
          <Link to="/pricing" className="transition-colors hover:text-primary">Pricing</Link>
        </nav>
        <Button asChild variant="outline" className="chunky h-10 shrink-0 rounded-full border-2 px-4 text-sm font-bold sm:h-11 sm:px-5 sm:text-base">
          <Link to="/auth">Tutor sign in</Link>
        </Button>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-6 sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:pt-8 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:pb-24">
          <div className="float-dot left-[4%] top-[12%] size-5 bg-secondary/45" />
          <div className="float-dot right-[7%] top-[8%] size-8 bg-primary/20 [animation-delay:-2s]" />
          <div className="float-dot bottom-[14%] left-[46%] size-4 bg-warning/50 [animation-delay:-4s]" />

          <div className="relative z-10 pop-in">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-secondary bg-accent px-3 py-1.5 text-xs font-extrabold text-accent-foreground sm:px-4 sm:py-2 sm:text-sm">
              <span className="size-2.5 rounded-full bg-destructive pulse-dot" /> Live lecture halls for every class size
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl">
              Teach thousands. <span className="text-primary">Live.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:mt-6 sm:text-xl sm:leading-8">
              Run live classes for 50 or 5,000 students, track real attendance automatically, and launch quizzes right inside the lecture.
            </p>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-extrabold uppercase text-primary">For lecturers</p>
                <Button asChild className="chunky mt-3 h-12 w-full rounded-xl text-base font-extrabold">
                  <Link to="/auth"><Video /> Start a live class</Link>
                </Button>
              </div>
              <form onSubmit={join} className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-extrabold uppercase text-secondary">For students</p>
                <div className="mt-3 flex gap-2">
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CLASS CODE" maxLength={10} aria-label="Class or quiz code" className="h-12 flex-1 rounded-xl border-2 text-center font-extrabold" />
                  <Button type="submit" variant="secondary" className="h-12 rounded-xl px-4 font-extrabold" aria-label="Join"><ArrowRight /></Button>
                </div>
              </form>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:translate-y-5">
            <div className="overflow-hidden rounded-3xl border-2 border-border bg-foreground shadow-2xl">
              <div className="flex items-center justify-between gap-2 px-4 py-3 text-background">
                <span className="inline-flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-xs font-extrabold text-destructive-foreground"><span className="size-2 rounded-full bg-destructive-foreground pulse-dot" /> LIVE</span>
                <span className="truncate text-xs font-bold text-background/80 sm:text-sm">BIO 101 · Human Physiology</span>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold"><Users className="size-4" /> 1,240</span>
              </div>
              <div className="relative aspect-video bg-gradient-to-br from-secondary/80 to-primary/70">
                <div className="absolute inset-4 rounded-2xl bg-card/95 p-4 sm:inset-6 sm:p-6">
                  <p className="text-xs font-extrabold uppercase text-muted-foreground">Slide 12</p>
                  <p className="mt-2 font-display text-lg font-bold sm:text-2xl">The cardiac cycle</p>
                  <div className="mt-3 space-y-2">
                    <div className="h-2 w-4/5 rounded-full bg-muted" /><div className="h-2 w-3/5 rounded-full bg-muted" /><div className="h-2 w-2/3 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 grid size-20 place-items-center rounded-xl border-2 border-card bg-secondary shadow-lg sm:size-28">
                  <GraduationCap className="size-8 text-secondary-foreground sm:size-10" />
                  <span className="absolute bottom-1 left-1 rounded bg-foreground/70 px-1.5 text-[10px] font-bold text-background">Dr. Adeyemi</span>
                </div>
              </div>
              <div className="flex gap-2 overflow-hidden px-4 py-3">
                {["AO", "TB", "ZK", "CN", "FI", "+1.2k"].map((n) => (
                  <span key={n} className="grid size-9 shrink-0 place-items-center rounded-full bg-background/15 text-xs font-extrabold text-background">{n}</span>
                ))}
              </div>
            </div>
            <div className="absolute -left-3 top-24 hidden rounded-2xl border-2 border-border bg-card p-3 shadow-xl float-object sm:block">
              <p className="text-xs font-bold text-muted-foreground">Attendance</p>
              <p className="font-display text-xl font-bold text-success">92% present</p>
            </div>
            <div className="absolute -right-3 -bottom-6 rounded-2xl border-2 border-border bg-card p-3 shadow-xl float-object [animation-delay:-2s]">
              <p className="inline-flex items-center gap-1 text-xs font-extrabold text-primary"><Trophy className="size-4" /> Live quiz</p>
              <p className="text-sm font-bold">Q3 · 14s left</p>
            </div>
          </div>
        </section>

        <section id="quizzes" className="border-y-2 border-border bg-card py-16 sm:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
            <div className="relative order-2 lg:order-1">
              <div className="grid grid-cols-[.88fr_1.12fr] items-end gap-3 sm:gap-4">
                <div className="surface-card translate-y-5 p-4 sm:translate-y-7 sm:p-5">
                  <Users className="size-8 text-secondary" />
                  <p className="mt-8 text-sm font-bold text-muted-foreground">Students join with one link</p>
                  <p className="mt-1 font-display text-2xl font-bold sm:text-4xl">Ready!</p>
                </div>
                <div className="rounded-2xl border-2 border-primary bg-primary p-4 text-primary-foreground sm:p-6 shadow-xl">
                  <div className="flex items-center justify-between"><Trophy className="size-8" /><span className="text-sm font-bold">Leaderboard</span></div>
                  <ol className="mt-7 space-y-3 text-sm font-extrabold">
                    {["1. Amara", "2. Tobi", "3. Zainab"].map((name, index) => <li key={name} className="flex justify-between rounded-lg bg-card/15 px-3 py-2"><span>{name}</span><span>{980 - index * 45}</span></li>)}
                  </ol>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-sm font-extrabold uppercase text-secondary">For live classes</span>
              <h2 className="mt-3 max-w-xl text-3xl font-bold sm:text-5xl">Turn every lesson into a shared challenge.</h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">Tutors paste in a full question set, share one link, and control the session. Students answer together while Kominimo handles timing, marking, and rankings.</p>
              <div className="mt-6 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-4">
                {[{ icon: MousePointer2, label: "Paste questions" }, { icon: Play, label: "Start together" }, { icon: Trophy, label: "Rank instantly" }].map((item) => (
                  <div key={item.label} className="flex flex-col items-start gap-2 border-t-2 border-border pt-3 text-sm font-bold sm:flex-row sm:items-center sm:gap-3 sm:pt-4 sm:text-base"><item.icon className="size-5 text-primary" />{item.label}</div>
                ))}
              </div>
              <form onSubmit={join} className="mt-9 flex max-w-xl flex-col gap-3 rounded-2xl border-2 border-border bg-background p-3 sm:flex-row">
                <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ENTER CLASS OR QUIZ CODE" maxLength={10} aria-label="Class or quiz code" className="h-12 flex-1 rounded-lg border-0 bg-card text-center text-base font-extrabold sm:text-left" />
                <Button type="submit" className="chunky h-12 w-full rounded-lg px-6 font-extrabold sm:w-auto">Join <Zap /></Button>
              </form>
              <p className="mt-2 text-sm text-muted-foreground">Paste the code from your tutor's class or quiz link.</p>
            </div>
          </div>
        </section>

        <section id="courses" className="relative py-16 sm:py-28">
          <div className="float-dot right-[8%] top-[12%] size-7 bg-secondary/30 [animation-delay:-3s]" />
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
              <div>
                <span className="text-sm font-extrabold uppercase text-primary">Learn at your pace</span>
                <h2 className="mt-3 text-3xl font-bold sm:text-5xl">Courses built for real progress.</h2>
                <p className="mt-5 text-lg leading-8 text-muted-foreground">Choose video or written lessons, free or paid, from tutors who know what students need.</p>
                <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-xl border-2 px-6 sm:w-auto font-extrabold"><Link to="/courses">Browse all courses <ArrowRight /></Link></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                {[
                  { icon: Video, title: "Video lessons", body: "Watch clear lessons whenever it suits you.", tone: "bg-primary/10 text-primary" },
                  { icon: FileText, title: "Written guides", body: "Read focused material and revisit key ideas.", tone: "bg-accent text-accent-foreground" },
                  { icon: CheckCircle2, title: "Your own pace", body: "Move through every lesson on your schedule.", tone: "bg-warning/25 text-foreground" },
                ].map((item, index) => (
                  <article key={item.title} className={`course-tile rounded-2xl border-2 border-border bg-card p-4 shadow-sm sm:p-5 ${index === 1 ? "sm:-translate-y-8" : ""}`}>
                    <span className={`grid size-12 place-items-center rounded-xl ${item.tone}`}><item.icon className="size-6" /></span>
                    <h3 className="mt-4 text-lg font-bold sm:mt-7 sm:text-xl">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs font-extrabold uppercase sm:mt-6 text-primary"><CirclePlay className="size-4" /> Start learning</div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-8 sm:pb-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-foreground px-5 py-10 text-background sm:py-14 sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16 lg:py-16">
            <div className="absolute -right-8 -top-12 size-44 rounded-full border-[24px] border-secondary/30" />
            <div className="absolute bottom-5 right-[32%] size-5 rounded-full bg-primary" />
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase text-secondary"><GraduationCap className="size-5" /> Built for tutors</span>
              <h2 className="mt-4 text-3xl font-bold sm:text-5xl">Your knowledge deserves a bigger classroom.</h2>
              <p className="mt-4 max-w-xl text-base text-background/70 sm:mt-5 sm:text-lg">Create quizzes, publish courses, grow your audience, and give students a better way to learn.</p>
            </div>
            <Button asChild className="chunky relative mt-8 h-13 w-full rounded-xl px-8 sm:h-14 sm:w-auto text-base font-extrabold lg:mt-0"><Link to="/auth">Sign up as a tutor <ArrowRight /></Link></Button>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-border px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-xl font-bold text-foreground">Kọ́mì<span className="text-primary">nímọ̀</span></span>
          <p>Live learning and self-paced courses, together.</p>
          <div className="flex flex-wrap gap-5 font-bold"><Link to="/courses">Courses</Link><Link to="/pricing">Pricing</Link><Link to="/auth">Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
