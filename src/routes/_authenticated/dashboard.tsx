import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, GraduationCap, LogOut, Plus, Radio, Settings, ShieldCheck, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Brand } from "@/components/site/Brand";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Input } from "@/components/ui/input";
import { StudentProgress } from "@/components/StudentProgress";
import { FREE_TIER, limitLabel, tierFor } from "@/config/plans";
import { SITE } from "@/config/site";
import { useMe } from "@/hooks/usePlan";
import { signOutUser } from "@/lib/auth-client";
import { createClass, listClasses } from "@/lib/classes.functions";
import { createQuiz, deleteQuiz, listQuizzes } from "@/lib/quizzes.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: `Tutor dashboard — ${SITE.name}` },
      { name: "description", content: "Create classes, run live sessions and build quizzes." },
      { property: "og:title", content: `Tutor dashboard — ${SITE.name}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const STATUS_LABEL: Record<string, string> = { draft: "Draft", lobby: "Lobby open", live: "Live now", ended: "Finished" };
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMe();
  const tier = tierFor(me.data?.plan);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOutUser();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-4 sm:px-6 sm:py-6">
        <Brand className="min-w-0 text-xl sm:text-2xl" />
        <div className="flex items-center gap-2">
          {me.data?.isAdmin && (
            <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
              <Link to="/admin" aria-label="Admin"><ShieldCheck className="size-4" /><span className="hidden sm:inline">Admin</span></Link>
            </Button>
          )}
          <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
            <Link to="/my-courses" aria-label="My courses"><BookOpen className="size-4" /><span className="hidden sm:inline">My courses</span></Link>
          </Button>
          <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
            <Link to="/account" aria-label="Account"><Settings className="size-4" /><span className="hidden sm:inline">Account</span></Link>
          </Button>
          <Button variant="outline" onClick={signOut} aria-label="Sign out" className="chunky rounded-full border-2 font-bold">
            <LogOut className="size-4" /><span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 border-border bg-card px-4 py-2 text-sm">
          <span className="font-bold">{tier.name} plan</span>
          <span className="text-muted-foreground">
            Classes of up to {limitLabel(tier.maxStudentsPerClass)} students · attendance &amp; analytics included
          </span>
          {tier.id === "free" && (
            <Link to="/upgrade" className="ml-auto font-bold text-primary underline-offset-4 hover:underline">
              Need bigger classes? ({FREE_TIER.maxStudentsPerClass}+) See Pro
            </Link>
          )}
        </p>

        <ClassesSection />
        <QuizzesSection />

        <div className="mt-12">
          <StudentProgress />
        </div>
      </main>
    </div>
  );
}

function ClassesSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => listClasses() });
  const create = useMutation({
    mutationFn: (name: string) => createClass({ data: { title: name } }),
    onSuccess: (d) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      navigate({ to: "/manage-class/$classId", params: { classId: d.id } });
    },
    onError: (e) => toast.error(errMsg(e, "Could not create class")),
  });

  return (
    <section aria-labelledby="classes-h">
      <h1 id="classes-h" className="text-3xl font-bold sm:text-4xl">Your classes</h1>
      <p className="mt-2 text-muted-foreground">Students request to join with a link; you approve them, go live, share materials and push quizzes.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            toast.error("Give your class a name");
            return;
          }
          create.mutate(title.trim());
        }}
        className="mt-4 flex flex-col gap-3 surface-card p-4 sm:flex-row"
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. CHM 101 — Group A" maxLength={120} className="h-12 rounded-xl border-2" aria-label="Class name" />
        <Button type="submit" disabled={create.isPending} className="chunky h-12 rounded-xl px-6 font-bold">
          <Plus className="size-4" /> New class
        </Button>
      </form>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {classes.isLoading && <p className="text-muted-foreground">Loading your classes…</p>}
        {classes.data?.length === 0 && (
          <div className="surface-card p-10 text-center sm:col-span-2">
            <GraduationCap className="mx-auto size-10 text-primary" />
            <p className="mt-3 text-lg font-bold">No classes yet</p>
            <p className="text-sm text-muted-foreground">Create your first class above, then share its link with your students.</p>
          </div>
        )}
        {classes.data?.map((c) => (
          <Link key={c.id} to="/manage-class/$classId" params={{ classId: c.id }} className="surface-card min-w-0 break-words p-4 transition-transform hover:-translate-y-0.5 sm:p-5">
            <p className="text-xl font-bold">{c.title}</p>
            {c.subject && <p className="text-sm text-muted-foreground">{c.subject}</p>}
            <p className="text-sm text-muted-foreground">Code <span className="font-bold tracking-widest text-foreground">{c.join_code}</span></p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function QuizzesSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const quizzes = useQuery({ queryKey: ["quizzes"], queryFn: () => listQuizzes() });

  const create = useMutation({
    mutationFn: (name: string) => createQuiz({ data: { title: name } }),
    onSuccess: (data) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      navigate({ to: "/quiz/$quizId", params: { quizId: data.id } });
    },
    onError: (error) => toast.error(errMsg(error, "Could not create quiz")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteQuiz({ data: { quizId: id } }),
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("Quiz deleted");
    },
    onError: (e) => toast.error(errMsg(e, "Could not delete quiz")),
  });

  return (
    <section className="mt-14" aria-labelledby="quizzes-h">
      <ConfirmAction
        open={!!deleting}
        onOpenChange={(value) => { if (!value) setDeleting(null); }}
        title="Delete quiz?"
        description={`“${deleting?.title ?? ""}” and its questions and results will be permanently deleted.`}
        pending={remove.isPending}
        onConfirm={() => { if (deleting) remove.mutate(deleting.id); }}
      />
      <h2 id="quizzes-h" className="text-3xl font-bold">Your quizzes</h2>
      <p className="mt-1 text-muted-foreground">Create a quiz, add your questions, then run it live or push it to a class.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const name = title.trim();
          if (!name) {
            toast.error("Give your quiz a title");
            return;
          }
          create.mutate(name);
        }}
        className="mt-4 flex flex-col gap-3 surface-card p-4 sm:flex-row"
      >
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. SS2 Chemistry — Periodic Table" maxLength={120} className="h-12 rounded-xl border-2" aria-label="Quiz title" />
        <Button type="submit" disabled={create.isPending} className="chunky h-12 rounded-xl px-6 font-bold">
          <Plus className="size-4" /> New quiz
        </Button>
      </form>

      <div className="mt-6 grid gap-4">
        {quizzes.isLoading && <p className="text-muted-foreground">Loading your quizzes…</p>}
        {quizzes.data?.length === 0 && (
          <div className="surface-card p-10 text-center">
            <Trophy className="mx-auto size-10 text-primary" />
            <p className="mt-3 text-lg font-bold">No quizzes yet</p>
            <p className="text-sm text-muted-foreground">Your first one is one title away.</p>
          </div>
        )}
        {quizzes.data?.map((quiz) => (
          <Link
            key={quiz.id}
            to="/quiz/$quizId"
            params={{ quizId: quiz.id }}
            className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 transition-transform hover:-translate-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:p-5"
          >
            <div className="row-span-2 min-w-0 sm:row-span-1">
              <p className="break-words text-lg font-bold sm:text-xl">{quiz.title}</p>
              <p className="text-sm text-muted-foreground">Code <span className="font-bold tracking-widest text-foreground">{quiz.join_code}</span></p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-bold ${
                quiz.status === "live"
                  ? "border-primary bg-primary text-primary-foreground"
                  : quiz.status === "lobby"
                    ? "border-secondary bg-secondary text-secondary-foreground"
                    : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {quiz.status === "live" && <Radio className="size-4" />}
              {STATUS_LABEL[quiz.status] ?? quiz.status}
            </span>
            <Button
              type="button"
              aria-label="Delete quiz"
              className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeleting(quiz);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </Link>
        ))}
      </div>
    </section>
  );
}
