import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, Play, Plus, Square, Trash2, UserX, Users, Monitor } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brand } from "@/components/site/Brand";
import { SITE } from "@/config/site";
import {
  addBlankQuestion, deleteQuestion, getQuizAdmin, listParticipants, listQuestionsAdmin, quizAction, removeParticipant,
  renameQuiz, updateQuestion,
} from "@/lib/quizzes.functions";
import { BulkImport } from "@/components/BulkImport";
import { HostControls } from "@/components/HostControls";
import { QuizAnalytics } from "@/components/QuizAnalytics";
import { QuizPresentation } from "@/components/QuizPresentation";
import { useQuizTimer } from "@/hooks/useQuizTimer";

import { formatMs, MEDAL, toOptions, type QuestionType } from "@/lib/quiz";

export const Route = createFileRoute("/_authenticated/quiz/$quizId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: `Quiz control room — ${SITE.name}` },
      { name: "description", content: "Write questions, share the link and run the live session." },
      { property: "og:title", content: `Quiz control room — ${SITE.name}` },
      { property: "og:description", content: "Write questions and run the live session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuizControl,
});

type QuestionRow = {
  id: string;
  order_index: number;
  type: QuestionType;
  prompt: string;
  options: string[];
  correct_answer: string;
  time_limit: number;
};

function QuizControl() {
  const { quizId } = Route.useParams();
  const queryClient = useQueryClient();
  const [presenting, setPresenting] = useState(false);

  const quiz = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => getQuizAdmin({ data: { quizId } }),
    refetchInterval: 1500,
  });

  const refreshQuiz = useCallback(() => { void queryClient.invalidateQueries({ queryKey: ["quiz", quizId] }); }, [queryClient, quizId]);
  const remaining = useQuizTimer(quiz.data, refreshQuiz);

  const questions = useQuery({
    queryKey: ["questions", quizId],
    queryFn: async (): Promise<QuestionRow[]> => (await listQuestionsAdmin({ data: { quizId } })).map((row) => ({ ...row, options: toOptions(row.options) })),
  });

  const participants = useQuery({
    queryKey: ["participants", quizId],
    queryFn: () => listParticipants({ data: { quizId } }),
    refetchInterval: 2500, // polling replaces the old realtime subscription
  });

  const setStatus = useMutation({
    mutationFn: async (status: "draft" | "lobby" | "live" | "ended") => {
      const action = status === "live" ? "start" : status === "ended" ? "end" : status === "lobby" ? "lobby" : null;
      if (action) await quizAction({ data: { quizId, action } });
    },
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      if (status === "lobby" || status === "live") setPresenting(true);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const addQuestion = useMutation({
    mutationFn: () => addBlankQuestion({ data: { quizId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["questions", quizId] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add question"),
  });

  const shareUrl =
    typeof window !== "undefined" && quiz.data
      ? `${window.location.origin}/join/${quiz.data.join_code}`
      : "";

  const status = quiz.data?.status ?? "draft";

  return (
    <div className="min-h-screen confetti-bg">
      {quiz.data && <QuizPresentation
        open={presenting} onOpenChange={setPresenting} quiz={quiz.data}
        questions={questions.data ?? []} players={participants.data ?? []}
        remaining={remaining} busy={setStatus.isPending} onStart={() => setStatus.mutate("live")}
        onEnd={() => setStatus.mutate("ended")}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["quiz", quizId] })}
      />}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-6">
        <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>
        <Brand className="text-xl" />
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-24 sm:space-y-8 sm:px-6">
        <section className="surface-card p-4 sm:p-6">
          <TitleEditor quizId={quizId} title={quiz.data?.title ?? ""} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border-2 border-dashed border-secondary p-4">
              <p className="text-sm font-bold text-muted-foreground">Student link</p>
              <p className="mt-1 font-display text-3xl font-bold tracking-[0.2em] text-primary">
                {quiz.data?.join_code ?? "······"}
              </p>
              <div className="mt-3 flex gap-2">
                <Input readOnly value={shareUrl} className="h-10 rounded-xl border-2 text-xs" />
                <Button
                  variant="secondary"
                  className="chunky h-10 rounded-xl font-bold"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied — share it with your students");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            <div className="rounded-xl border-2 border-border p-4">
              <p className="text-sm font-bold text-muted-foreground">Session control</p>
              <p className="mt-1 text-lg font-bold capitalize">{status.replace("_", " ")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button variant="outline" onClick={() => setPresenting(true)} className="chunky min-w-0 rounded-xl border-2 font-bold">
                  <Monitor className="size-4" /> Live display
                </Button>
                <Button
                  variant="secondary"
                  disabled={status === "lobby"}
                  onClick={() => setStatus.mutate("lobby")}
                  className="chunky min-w-0 rounded-xl font-bold"
                >
                  <Users className="size-4" /> Open lobby
                </Button>
                <Button
                  disabled={status === "live" || (questions.data?.length ?? 0) === 0}
                  onClick={() => setStatus.mutate("live")}
                  className="chunky min-w-0 rounded-xl font-bold"
                >
                  <Play className="size-4" /> Start quiz
                </Button>
                <Button
                  variant="outline"
                  disabled={status === "ended"}
                  onClick={() => setStatus.mutate("ended")}
                  className="chunky min-w-0 rounded-xl border-2 font-bold"
                >
                  <Square className="size-4" /> End
                </Button>
              </div>
            </div>
          </div>
          {quiz.data && (
            <div className="mt-4">
              <HostControls
                quizId={quizId}
                quiz={{
                  paused: quiz.data.paused,
                  reveal_answers: quiz.data.reveal_answers,
                  skip_signal: quiz.data.skip_signal,
                  extend_signal: quiz.data.extend_signal,
                  status: quiz.data.status,
                }}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ["quiz", quizId] })}
              />
            </div>
          )}
        </section>

        <BulkImport quizId={quizId} startIndex={questions.data?.length ?? 0} />

        <section>

          <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold">
              Questions{" "}
              <span className="text-muted-foreground">({questions.data?.length ?? 0})</span>
            </h2>
            <Button onClick={() => addQuestion.mutate()} className="chunky min-w-0 rounded-xl font-bold">
              <Plus className="size-4" /> Add question
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            {questions.data?.map((question, index) => (
              <QuestionCard key={question.id} question={question} index={index} quizId={quizId} />
            ))}
            {questions.data?.length === 0 && (
              <div className="surface-card p-8 text-center text-muted-foreground">
                No questions yet — add as many as you need.
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Leaderboard</h2>
          <p className="text-sm text-muted-foreground">
            Ranked by correct answers, then fastest total time.
          </p>
          <div className="mt-4 space-y-2">
            {participants.data?.length === 0 && (
              <div className="surface-card p-8 text-center text-muted-foreground">
                Nobody has joined yet.
              </div>
            )}
            {participants.data?.map((person, index) => (
              <div
                key={person.id}
                className="surface-card grid min-w-0 gap-3 px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-display font-bold">
                    {MEDAL[index] ?? index + 1}
                  </span>
                  <div>
                    <p className="break-words font-bold">{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.phone}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
                  <span className="text-primary">{person.score} correct</span>
                  <span className="text-muted-foreground">{formatMs(person.total_time_ms)}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      person.finished_at
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {person.finished_at ? "Done" : "Playing"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${person.name}`}
                    onClick={async () => {
                      try {
                        await removeParticipant({ data: { id: person.id } });
                        toast.success(`${person.name} removed`);
                        queryClient.invalidateQueries({ queryKey: ["participants", quizId] });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not remove");
                      }
                    }}
                  >
                    <UserX className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <QuizAnalytics quizId={quizId} title={quiz.data?.title ?? "quiz"} participants={participants.data ?? []} />
      </main>
    </div>
  );
}

function TitleEditor({ quizId, title }: { quizId: string; title: string }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(title);

  useEffect(() => setValue(title), [title]);

  return (
    <div className="space-y-2">
      <Label htmlFor="quiz-title">Quiz title</Label>
      <Input
        id="quiz-title"
        value={value}
        maxLength={120}
        onChange={(event) => setValue(event.target.value)}
        onBlur={async () => {
          if (value.trim() === title) return;
          try {
            await renameQuiz({ data: { quizId, title: value.trim() } });
            queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not rename");
          }
        }}
        className="h-12 rounded-xl border-2 text-xl font-bold"
      />
    </div>
  );
}

function QuestionCard({
  question,
  index,
  quizId,
}: {
  question: QuestionRow;
  index: number;
  quizId: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(question);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(question), [question]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["questions", quizId] });

  const save = async () => {
    if (!draft.prompt.trim()) {
      toast.error("Add the question text first");
      return;
    }
    if (!draft.correct_answer.trim()) {
      toast.error("Set the correct answer");
      return;
    }
    setSaving(true);
    try {
      await updateQuestion({
        data: {
          id: question.id,
          type: draft.type,
          prompt: draft.prompt.trim(),
          options: draft.type === "multiple_choice" ? draft.options : [],
          correct_answer: draft.correct_answer.trim(),
          time_limit: Math.min(300, Math.max(5, Math.round(draft.time_limit) || 20)),
        },
      });
      toast.success(`Question ${index + 1} saved`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deleteQuestion({ data: { id: question.id } });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  };

  return (
    <div className="surface-card min-w-0 space-y-4 p-4 sm:p-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:flex">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display font-bold text-primary-foreground">
          {index + 1}
        </span>
        <Select
          value={draft.type}
          onValueChange={(value) =>
            setDraft({
              ...draft,
              type: value as QuestionType,
              correct_answer: "",
              options: value === "multiple_choice" ? ["", "", "", ""] : [],
            })
          }
        >
          <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-2 font-bold sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="multiple_choice">Multiple choice</SelectItem>
            <SelectItem value="true_false">True / False</SelectItem>
            <SelectItem value="short_answer">Short answer</SelectItem>
          </SelectContent>
        </Select>
        <div className="col-span-2 flex items-center justify-end gap-2 sm:ml-auto">
          <Label htmlFor={`t-${question.id}`} className="text-xs text-muted-foreground">
            Seconds
          </Label>
          <Input
            id={`t-${question.id}`}
            type="number"
            min={5}
            max={300}
            value={draft.time_limit}
            onChange={(event) => setDraft({ ...draft, time_limit: Number(event.target.value) })}
            className="h-10 w-20 rounded-xl border-2 text-center font-bold"
          />
          <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete question">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <Textarea
        value={draft.prompt}
        onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
        placeholder="Type the question…"
        className="min-h-20 rounded-xl border-2 text-base"
      />

      {draft.type === "multiple_choice" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((slot) => {
            const value = draft.options[slot] ?? "";
            const isCorrect = value.length > 0 && value === draft.correct_answer;
            return (
              <div key={slot} className="flex items-center gap-2">
                <Input
                  value={value}
                  onChange={(event) => {
                    const options = [0, 1, 2, 3].map((i) =>
                      i === slot ? event.target.value : (draft.options[i] ?? ""),
                    );
                    setDraft({ ...draft, options });
                  }}
                  placeholder={`Option ${slot + 1}`}
                  className="h-10 rounded-xl border-2"
                />
                <Button
                  type="button"
                  variant={isCorrect ? "default" : "outline"}
                  className="chunky h-10 shrink-0 rounded-xl border-2 px-3 text-xs font-bold"
                  onClick={() => setDraft({ ...draft, correct_answer: value })}
                >
                  {isCorrect ? "Correct" : "Mark"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {draft.type === "true_false" && (
        <div className="flex gap-2">
          {["True", "False"].map((value) => (
            <Button
              key={value}
              type="button"
              variant={draft.correct_answer === value ? "default" : "outline"}
              onClick={() => setDraft({ ...draft, correct_answer: value })}
              className="chunky h-11 flex-1 rounded-xl border-2 font-bold"
            >
              {value}
            </Button>
          ))}
        </div>
      )}

      {draft.type === "short_answer" && (
        <div className="space-y-2">
          <Label htmlFor={`a-${question.id}`}>Accepted answer (case-insensitive)</Label>
          <Input
            id={`a-${question.id}`}
            value={draft.correct_answer}
            onChange={(event) => setDraft({ ...draft, correct_answer: event.target.value })}
            placeholder="e.g. Photosynthesis"
            className="h-10 rounded-xl border-2"
          />
        </div>
      )}

      <Button onClick={save} disabled={saving} className="chunky min-w-0 rounded-xl font-bold">
        {saving ? "Saving…" : "Save question"}
      </Button>
    </div>
  );
}
