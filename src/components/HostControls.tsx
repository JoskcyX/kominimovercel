import { useState } from "react";
import { Eye, EyeOff, FastForward, Pause, Play, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { quizAction } from "@/lib/quizzes.functions";

type ControlQuiz = {
  paused: boolean;
  reveal_answers: boolean;
  skip_signal: number;
  extend_signal: number;
  status: "draft" | "lobby" | "live" | "ended";
};

export function HostControls({
  quizId,
  quiz,
  onChanged,
}: {
  quizId: string;
  quiz: ControlQuiz;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const live = quiz.status === "live";

  type Action = "pause" | "resume" | "next" | "extend15" | "extend30" | "reveal_on" | "reveal_off";
  // The host sends an intent; the server decides the new state (no arbitrary column writes from the browser).
  const act = async (action: Action, message: string) => {
    setBusy(true);
    try {
      await quizAction({ data: { quizId, action } });
      toast.success(message);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-border p-4">
      <p className="text-sm font-bold text-muted-foreground">Host controls</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {live ? "Steer the room while the quiz runs." : "Available once the quiz is live."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant={quiz.paused ? "default" : "outline"}
          disabled={busy || !live}
          onClick={() => act(quiz.paused ? "resume" : "pause", quiz.paused ? "Resumed" : "Paused for everyone")}
          className="chunky rounded-xl border-2 font-bold"
        >
          {quiz.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          {quiz.paused ? "Resume" : "Pause"}
        </Button>

        <Button
          variant="outline"
          disabled={busy || !live || quiz.paused}
          onClick={() => act("next", "Next question for everyone")}
          className="chunky rounded-xl border-2 font-bold"
        >
          <FastForward className="size-4" /> Next question
        </Button>

        {[15, 30].map((seconds) => (
          <Button
            key={seconds}
            variant="outline"
            disabled={busy || !live}
            onClick={() =>
              act(seconds === 15 ? "extend15" : "extend30", `Added ${seconds}s to this question`)
            }
            className="chunky rounded-xl border-2 font-bold"
          >
            <PlusCircle className="size-4" /> {seconds}s
          </Button>
        ))}

        <Button
          variant={quiz.reveal_answers ? "default" : "outline"}
          disabled={busy}
          onClick={() =>
            act(
              quiz.reveal_answers ? "reveal_off" : "reveal_on",
              quiz.reveal_answers ? "Answers hidden" : "Answers revealed after each question",
            )
          }
          className="chunky rounded-xl border-2 font-bold"
        >
          {quiz.reveal_answers ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          Reveal answers
        </Button>
      </div>
    </div>
  );
}
