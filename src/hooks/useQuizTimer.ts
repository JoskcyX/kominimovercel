import { useEffect, useState } from "react";
import { advanceQuizTimer } from "@/lib/play.functions";
import { questionSecondsLeft, shouldAdvanceQuestion, type QuizClock } from "@/lib/quiz-timer";

/**
 * Counts down the current question using the SERVER's clock (so a phone with the wrong time still
 * agrees with everyone else) and nudges the shared clock forward when the deadline passes.
 */
export function useQuizTimer(quiz: QuizClock | null | undefined, onChanged: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!quiz || quiz.status !== "live" || !quiz.question_deadline_at) {
      setRemaining(null);
      return;
    }
    const offset = quiz.server_now ? Date.parse(quiz.server_now) - Date.now() : 0;
    const now = () => Date.now() + offset;
    let stopped = false;
    let busy = false;
    let nextAttempt = 0;
    const tick = async () => {
      if (stopped) return;
      setRemaining(questionSecondsLeft(quiz, now()));
      if (busy || now() < nextAttempt || !shouldAdvanceQuestion(quiz, now())) return;
      busy = true;
      nextAttempt = now() + 2000;
      try {
        // The database checks the deadline and cursor atomically; no client can advance early or twice.
        const { advanced } = await advanceQuizTimer({
          data: { quizId: quiz.id, expectedIndex: quiz.skip_signal },
        });
        if (advanced && !stopped) onChanged();
      } catch {
        /* try again on the next tick */
      } finally {
        busy = false;
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), 200);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [
    quiz?.id,
    quiz?.status,
    quiz?.paused,
    quiz?.skip_signal,
    quiz?.question_deadline_at,
    quiz?.question_paused_at,
    quiz?.server_now,
    onChanged,
  ]);
  return remaining;
}
