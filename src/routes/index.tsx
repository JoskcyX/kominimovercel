import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, CheckCircle2, GraduationCap, Trophy, Users, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
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
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 sm:px-8 sm:pt-14 lg:grid-cols-2 lg:gap-16 lg:pb-28">
          <div className="pop-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground sm:text-sm">
              <span className="size-2 rounded-full bg-primary pulse-dot" /> Live classes for every class size
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Teach live.<br /><span className="text-primary">Reach everyone.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Host live lectures, take real attendance automatically, and run quizzes your students actually enjoy — all in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 rounded-xl px-6 text-base font-bold">
                <Link to="/auth"><Video /> Start a live class</Link>
              </Button>
              <form onSubmit={join} className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter class code" maxLength={10} aria-label="Class or quiz code" className="h-12 flex-1 rounded-xl border-2 font-bold sm:w-44" />
                <Button type="submit" variant="outline" className="h-12 rounded-xl border-2 px-4 font-bold">Join</Button>
              </form>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-destructive"><span className="size-2 rounded-full bg-destructive pulse-dot" /> LIVE</span>
                <span className="truncate text-sm font-bold">BIO 101 · Human Physiology</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><Users className="size-4" /> 1,240</span>
              </div>
              <div className="relative aspect-video bg-gradient-to-br from-secondary/25 via-accent to-primary/20 p-6">
                <p className="text-xs font-bold uppercase text-muted-foreground">Slide 12</p>
                <p className="mt-2 font-display text-2xl font-bold sm:text-3xl">The cardiac cycle</p>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-3/4 rounded-full bg-card" /><div className="h-2 w-1/2 rounded-full bg-card" />
                </div>
                <div className="absolute bottom-4 right-4 grid size-20 place-items-center rounded-2xl bg-secondary shadow-lg sm:size-24">
                  <GraduationCap className="size-9 text-secondary-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border text-center">
                <div className="p-4"><p className="font-display text-xl font-bold text-success">92%</p><p className="text-xs text-muted-foreground">Attendance</p></div>
                <div className="p-4"><p className="font-display text-xl font-bold text-primary">Q3 · 14s</p><p className="text-xs text-muted-foreground">Live quiz</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="quizzes" className="border-t border-border bg-card py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="max-w-xl text-3xl font-bold sm:text-4xl">Everything a live class needs.</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {[
                { icon: Users, title: "Classes of any size", body: "From small tutorials to lecture halls of thousands." },
                { icon: CheckCircle2, title: "Honest attendance", body: "Counts real time present. Download as Excel or CSV." },
                { icon: Trophy, title: "Live quizzes", body: "Timed questions and a leaderboard on the big screen." },
              ].map((f) => (
                <div key={f.title}>
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon className="size-5" /></span>
                  <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
            <Button asChild variant="link" className="mt-8 px-0 font-bold"><Link to="/courses">Or explore self-paced courses <ArrowRight /></Link></Button>
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
