import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Play, Plus, Square, Trash2, UserX, Users } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { BulkImport } from "@/components/BulkImport";
import { HostControls } from "@/components/HostControls";
import { QuizAnalytics } from "@/components/QuizAnalytics";

import { formatMs, MEDAL, toOptions, type QuestionType } from "@/lib/quiz";

export const Route = createFileRoute("/_authenticated/quiz/$quizId")({
  head: () => ({
    meta: [
      { title: "Quiz control room — EDxKa" },
      { name: "description", content: "Write questions, share the link and run the live session." },
      { property: "og:title", content: "Quiz control room — EDxKa" },
      { property: "og:description", content: "Write questions and run the live session." },
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

  const quiz = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, join_code, status, paused, reveal_answers, skip_signal, extend_signal")
        .eq("id", quizId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const questions = useQuery({
    queryKey: ["questions", quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, order_index, type, prompt, options, correct_answer, time_limit")
        .eq("quiz_id", quizId)
        .order("order_index");
      if (error) throw error;
      return data.map((row) => ({ ...row, options: toOptions(row.options) })) as QuestionRow[];
    },
  });

  const participants = useQuery({
    queryKey: ["participants", quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, phone, score, total_time_ms, finished_at")
        .eq("quiz_id", quizId)
        .order("score", { ascending: false })
        .order("total_time_ms", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`tutor-${quizId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `quiz_id=eq.${quizId}` },
        () => queryClient.invalidateQueries({ queryKey: ["participants", quizId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, queryClient]);

  const setStatus = useMutation({
    mutationFn: async (status: "draft" | "lobby" | "live" | "ended") => {
      const { error } = await supabase
        .from("quizzes")
        .update(
          status === "live"
            ? { status, started_at: new Date().toISOString() }
            : { status },
        )
        .eq("id", quizId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quiz", quizId] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const addQuestion = useMutation({
    mutationFn: async () => {
      const next = (questions.data?.length ?? 0) + 1;
      const { error } = await supabase.from("questions").insert({
        quiz_id: quizId,
        order_index: next,
        type: "multiple_choice",
        prompt: "",
        options: ["", "", "", ""],
        correct_answer: "",
        time_limit: 20,
      });
      if (error) throw error;
    },
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
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>
        <span className="font-display text-xl font-bold">
          ED<span className="text-primary">xKa</span>
        </span>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 pb-24">
        <section className="surface-card p-6">
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={status === "lobby"}
                  onClick={() => setStatus.mutate("lobby")}
                  className="chunky rounded-xl font-bold"
                >
                  <Users className="size-4" /> Open lobby
                </Button>
                <Button
                  disabled={status === "live" || (questions.data?.length ?? 0) === 0}
                  onClick={() => setStatus.mutate("live")}
                  className="chunky rounded-xl font-bold"
                >
                  <Play className="size-4" /> Start quiz
                </Button>
                <Button
                  variant="outline"
                  disabled={status === "ended"}
                  onClick={() => setStatus.mutate("ended")}
                  className="chunky rounded-xl border-2 font-bold"
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

          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              Questions{" "}
              <span className="text-muted-foreground">({questions.data?.length ?? 0})</span>
            </h2>
            <Button onClick={() => addQuestion.mutate()} className="chunky rounded-xl font-bold">
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
                className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-muted font-display font-bold">
                    {MEDAL[index] ?? index + 1}
                  </span>
                  <div>
                    <p className="font-bold">{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-sm font-bold">
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
                      const { error } = await supabase
                        .from("participants")
                        .delete()
                        .eq("id", person.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success(`${person.name} removed`);
                        queryClient.invalidateQueries({ queryKey: ["participants", quizId] });
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
          const { error } = await supabase
            .from("quizzes")
            .update({ title: value.trim() || "Untitled quiz" })
            .eq("id", quizId);
          if (error) toast.error(error.message);
          else queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
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
    const { error } = await supabase
      .from("questions")
      .update({
        type: draft.type,
        prompt: draft.prompt.trim(),
        options: draft.type === "multiple_choice" ? draft.options : [],
        correct_answer: draft.correct_answer.trim(),
        time_limit: Math.min(300, Math.max(5, draft.time_limit)),
      })
      .eq("id", question.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Question ${index + 1} saved`);
      refresh();
    }
  };

  const remove = async () => {
    const { error } = await supabase.from("questions").delete().eq("id", question.id);
    if (error) toast.error(error.message);
    else refresh();
  };

  return (
    <div className="surface-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
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
          <SelectTrigger className="h-10 w-48 rounded-xl border-2 font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="multiple_choice">Multiple choice</SelectItem>
            <SelectItem value="true_false">True / False</SelectItem>
            <SelectItem value="short_answer">Short answer</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
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

      <Button onClick={save} disabled={saving} className="chunky rounded-xl font-bold">
        {saving ? "Saving…" : "Save question"}
      </Button>
    </div>
  );
}
