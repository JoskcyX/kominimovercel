import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Circle, Copy, Maximize2, Play, Square, Triangle, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HostControls } from "@/components/HostControls";
import { supabase } from "@/integrations/supabase/client";
import { formatMs, type PlayableQuestion } from "@/lib/quiz";
import { getPresentationProgress } from "@/lib/quiz-presentation";

type PresentationQuiz = {
  id: string; title: string; join_code: string; status: "draft" | "lobby" | "live" | "ended";
  paused: boolean; reveal_answers: boolean; skip_signal: number; extend_signal: number;
};
type PresentationPlayer = { id: string; name: string; score: number; total_time_ms: number; finished_at: string | null };
type PresentationQuestion = PlayableQuestion & { correct_answer: string };
const symbols = [Triangle, Square, Circle, Trophy];
const tiles = ["bg-primary text-primary-foreground", "bg-secondary text-secondary-foreground", "bg-warning text-foreground", "bg-accent text-accent-foreground"];

export function QuizPresentation({ open, onOpenChange, quiz, questions, players, busy, onStart, onEnd, onChanged }: {
  open: boolean; onOpenChange: (open: boolean) => void; quiz: PresentationQuiz;
  questions: PresentationQuestion[]; players: PresentationPlayer[]; busy: boolean;
  onStart: () => void; onEnd: () => void; onChanged: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const answers = useQuery({
    queryKey: ["presentation-answers", quiz.id],
    enabled: open && (quiz.status === "live" || quiz.status === "ended"),
    refetchInterval: open && quiz.status === "live" ? 1500 : false,
    queryFn: async () => {
      const ids = questions.map((question) => question.id);
      if (!ids.length) return [];
      // Read only IDs; never load student responses or contact details onto the projection.
      const rows: { question_id: string; participant_id: string }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("answers").select("question_id, participant_id").in("question_id", ids).order("id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return rows;
    },
  });
  useEffect(() => {
    if (!open && document.fullscreenElement === stage.current) void document.exitFullscreen();
  }, [open]);
  const progress = getPresentationProgress(questions.map((question) => question.id), answers.data ?? [], players.map((player) => player.id), quiz.skip_signal);
  const current = questions[progress.index];
  const ended = quiz.status === "ended";
  const lobby = quiz.status === "lobby" || quiz.status === "draft";
  const leaders = [...players].sort((a, b) => b.score - a.score || a.total_time_ms - b.total_time_ms);
  const options = current?.type === "true_false" ? ["True", "False"] : current?.options.filter((option) => option.trim()) ?? [];
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${quiz.join_code}`);
      setCopied(true);
    } catch { toast.error("Could not copy the student link"); }
  };
  const close = async (value: boolean) => {
    if (!value && document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    onOpenChange(value);
  };
  return (
    <Dialog open={open} onOpenChange={(value) => void close(value)}>
      <DialogContent ref={stage} aria-describedby={undefined} className="inset-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 bg-background p-0 sm:rounded-none">
        <DialogTitle className="sr-only">{quiz.title} — live quiz display</DialogTitle>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-border px-5 py-4 pr-12 sm:px-8 sm:pr-14">
          <span className="font-display text-2xl font-bold">Kọ́mì<span className="text-primary">nímọ̀</span></span>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="flex items-center gap-2"><Users className="size-4" /> {players.length}</span>
            <Button variant="outline" size="icon" title="Enter full screen" aria-label="Enter full screen" onClick={async () => {
              try { await stage.current?.requestFullscreen(); } catch { toast.info("Full screen isn't available in this browser; the expanded display is still open."); }
            }}><Maximize2 className="size-4" /></Button>
          </div>
        </header>
        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="flex min-w-0 flex-col px-5 py-6 sm:px-10 sm:py-10">
            {lobby ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="mb-4 flex items-center gap-2 font-bold text-secondary"><span className="pulse-dot size-3 rounded-full bg-secondary" /> Lobby open</span>
                <h1 className="max-w-3xl break-words text-3xl font-bold sm:text-5xl">{quiz.title}</h1>
                <p className="mt-8 max-w-full break-all text-lg font-bold text-muted-foreground">{typeof window === "undefined" ? "" : window.location.host}/join/{quiz.join_code}</p>
                <p className="mt-2 font-display text-5xl font-bold text-primary sm:text-7xl">{quiz.join_code}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button variant="outline" onClick={copyLink}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy student link"}</Button>
                  <Button size="lg" disabled={busy || !questions.length} onClick={onStart}><Play className="size-5" /> Start quiz</Button>
                </div>
                <div className="mt-10 flex max-w-3xl flex-wrap justify-center gap-2" aria-live="polite">
                  {players.slice(0, 60).map((player) => <span key={player.id} className="pop-in max-w-full break-words rounded-lg border-2 border-border bg-card px-4 py-2 font-bold">{player.name}</span>)}
                  {!players.length && <p className="text-muted-foreground">Waiting for players…</p>}
                  {players.length > 60 && <span className="self-center font-bold text-muted-foreground">+{players.length - 60} more</span>}
                </div>
              </div>
            ) : ended ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Trophy className="mb-6 size-16 text-primary" />
                <p className="font-bold text-secondary">Final standings</p>
                <h1 className="mt-3 break-words text-4xl font-bold sm:text-6xl">{leaders[0]?.name ?? "Quiz complete"}</h1>
                {leaders[0] && <p className="mt-4 text-xl font-bold">{leaders[0].score} correct · {formatMs(leaders[0].total_time_ms)}</p>}
                <p className="mt-8 break-words text-muted-foreground">{quiz.title}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                  <span className="text-secondary">Question {progress.index + 1} / {questions.length}</span>
                  <span>{quiz.paused ? "Paused" : `${progress.answered} / ${progress.total} answered`}</span>
                </div>
                <div className="my-8 flex flex-1 flex-col justify-center">
                  <h1 key={current?.id} className="pop-in break-words text-center text-3xl font-bold leading-tight sm:text-5xl">{current?.prompt ?? "Loading question…"}</h1>
                  {current?.type === "short_answer" ? <p className="mt-8 text-center text-xl font-bold text-muted-foreground">Short answer</p> : (
                    <div className="mt-10 grid gap-3 sm:grid-cols-2">
                      {options.map((option, index) => {
                        const Symbol = symbols[index % symbols.length] ?? Circle;
                        return <div key={`${current?.id}-${index}`} className={`flex min-h-24 items-center gap-4 rounded-lg p-5 ${tiles[index % tiles.length]}`}><Symbol className="size-8 shrink-0" /><span className="min-w-0 break-words text-xl font-bold sm:text-2xl">{option}</span></div>;
                      })}
                    </div>
                  )}
                </div>
                {answers.isError && <p role="alert" className="mb-3 text-destructive">Question progress could not update. Reconnecting…</p>}
              </>
            )}
          </main>
          <aside className="min-w-0 border-t-2 border-border bg-muted px-5 py-6 lg:border-l-2 lg:border-t-0">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-bold"><Trophy className="size-5 text-primary" /> {lobby ? "Players" : ended ? "Leaderboard" : "Live leaderboard"}</h2>
            <ol className="space-y-3" aria-live="polite">
              {leaders.slice(0, 8).map((player, index) => <li key={player.id} className="pop-in flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full font-display text-lg font-bold ${index === 0 && !lobby ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="break-words font-bold">{player.name}</p>{!lobby && <p className="text-xs text-muted-foreground">{formatMs(player.total_time_ms)}</p>}</div>
                {!lobby && <span className="font-display text-xl font-bold text-primary">{player.score}</span>}
              </li>)}
            </ol>
            {!players.length && <p className="text-muted-foreground">No players yet</p>}
            {players.length > 8 && <p className="mt-4 text-sm text-muted-foreground">{players.length} players in total</p>}
          </aside>
        </div>
        {!lobby && <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t-2 border-border bg-background px-5 py-4">
          {!ended && <div className="min-w-0 flex-1"><HostControls quizId={quiz.id} quiz={quiz} onChanged={onChanged} /></div>}
          {quiz.status !== "ended" && <Button variant="outline" disabled={busy} onClick={onEnd}><Square className="size-4" /> End quiz</Button>}
        </footer>}
      </DialogContent>
    </Dialog>
  );
}