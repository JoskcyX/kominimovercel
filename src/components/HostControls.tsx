import { useState } from "react";
import { Eye, EyeOff, FastForward, Pause, Play, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

  const patch = async (
    values: Partial<{
      paused: boolean;
      reveal_answers: boolean;
      skip_signal: number;
      extend_signal: number;
      extend_seconds: number;
    }>,
    message: string,
  ) => {
    setBusy(true);
    const { error } = await supabase.from("quizzes").update(values).eq("id", quizId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(message);
      onChanged();
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
          onClick={() => patch({ paused: !quiz.paused }, quiz.paused ? "Resumed" : "Paused for everyone")}
          className="chunky rounded-xl border-2 font-bold"
        >
          {quiz.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          {quiz.paused ? "Resume" : "Pause"}
        </Button>

        <Button
          variant="outline"
          disabled={busy || !live || quiz.paused}
          onClick={() => patch({ skip_signal: quiz.skip_signal + 1 }, "Skipped to the next question")}
          className="chunky rounded-xl border-2 font-bold"
        >
          <FastForward className="size-4" /> Skip question
        </Button>

        {[15, 30].map((seconds) => (
          <Button
            key={seconds}
            variant="outline"
            disabled={busy || !live}
            onClick={() =>
              patch(
                { extend_seconds: seconds, extend_signal: quiz.extend_signal + 1 },
                `Added ${seconds}s to this question`,
              )
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
            patch(
              { reveal_answers: !quiz.reveal_answers },
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
