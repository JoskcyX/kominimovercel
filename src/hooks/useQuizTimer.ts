import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { questionSecondsLeft, shouldAdvanceQuestion, type QuizClock } from "@/lib/quiz-timer";

export function useQuizTimer(quiz: QuizClock | null | undefined, onChanged: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!quiz || quiz.status !== "live" || !quiz.question_deadline_at) { setRemaining(null); return; }
    let stopped = false;
    let busy = false;
    let nextAttempt = 0;
    const tick = async () => {
      if (stopped) return;
      setRemaining(questionSecondsLeft(quiz, Date.now()));
      if (busy || Date.now() < nextAttempt || !shouldAdvanceQuestion(quiz, Date.now())) return;
      busy = true;
      nextAttempt = Date.now() + 2000;
      try {
        // The database checks the deadline and cursor atomically; no client can advance early or twice.
        const { error } = await supabase.rpc("advance_quiz_timer", { _quiz_id: quiz.id, _expected_index: quiz.skip_signal });
        if (!error && !stopped) onChanged();
      } finally { busy = false; }
    };
    void tick();
    const interval = setInterval(() => void tick(), 200);
    return () => { stopped = true; clearInterval(interval); };
  }, [quiz?.id, quiz?.status, quiz?.paused, quiz?.skip_signal, quiz?.question_deadline_at, quiz?.question_paused_at, onChanged]);
  return remaining;
}