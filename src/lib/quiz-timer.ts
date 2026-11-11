export type QuizClock = { id: string; status: string; paused: boolean; skip_signal: number; question_deadline_at: string | null; question_paused_at: string | null; /** Server clock when this state was read — corrects for a wrong device clock. */ server_now?: string };

export function questionSecondsLeft(quiz: QuizClock, now: number) {
  if (!quiz.question_deadline_at) return null;
  const clock = quiz.paused && quiz.question_paused_at ? Date.parse(quiz.question_paused_at) : now;
  return Math.max(0, Math.ceil((Date.parse(quiz.question_deadline_at) - clock) / 1000));
}

export function shouldAdvanceQuestion(quiz: QuizClock, now: number) {
  return quiz.status === "live" && !quiz.paused && questionSecondsLeft(quiz, now) === 0;
}