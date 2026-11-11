import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PartyPopper, Timer, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsentCheckbox } from "@/components/legal/ConsentCheckbox";
import { SITE } from "@/config/site";
import {
  finishParticipant, getAnswerKey, getBoard, getPlayQuestions, getQuestionProgress, getQuizByCode, joinQuiz,
  participantAlive, submitAnswer, type QuizPublic,
} from "@/lib/play.functions";
import { useQuizTimer } from "@/hooks/useQuizTimer";
import { formatMs, MEDAL, toOptions, type BoardRow, type PlayableQuestion } from "@/lib/quiz";

export const Route = createFileRoute("/join/$code")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title: `Join the live quiz — ${SITE.name}` },
      { name: "description", content: "Enter your name, wait in the lobby and play the live quiz." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `Join the live quiz — ${SITE.name}` },
      { property: "og:description", content: "Enter your name and play the live quiz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

type Quiz = QuizPublic;

type Session = { participantId: string; token: string };

const joinSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Phone can only contain numbers"),
});

function JoinPage() {
  const { code } = Route.useParams();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [joining, setJoining] = useState(false);
  const [kicked, setKicked] = useState(false);

  const storageKey = `quizpop:${code}`;

  const loadQuiz = useCallback(async () => {
    try {
      setQuiz(await getQuizByCode({ data: { code: code.toUpperCase() } }));
    } catch {
      /* keep the last known state through a blip */
    }
    setLoading(false);
  }, [code]);

  useQuizTimer(quiz, loadQuiz);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Session | null;
      if (saved?.participantId && saved.token) setSession(saved);
      else localStorage.removeItem(storageKey); // old-format entry from before signed sessions
    } catch {
      localStorage.removeItem(storageKey);
    }
    loadQuiz();
  }, [loadQuiz, storageKey]);

  // Live updates: poll the shared quiz state (the server shares one query between all students).
  useEffect(() => {
    if (!quiz?.id) return;
    const poll = setInterval(loadQuiz, 1500);
    return () => clearInterval(poll);
  }, [quiz?.id, loadQuiz]);

  // The tutor can remove a student mid-session.
  useEffect(() => {
    if (!session) return;
    const check = async () => {
      try {
        const { alive } = await participantAlive({ data: { token: session.token } });
        if (!alive) {
          localStorage.removeItem(storageKey);
          setKicked(true);
        }
      } catch (e) {
        // Expired token (24 h) → just ask them to enter their details again.
        if (e instanceof Error && /expired/i.test(e.message)) {
          localStorage.removeItem(storageKey);
          setSession(null);
        }
      }
    };
    void check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [session, storageKey]);

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quiz) return;
    const parsed = joinSchema.safeParse({ name, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    if (!agreed) {
      toast.error("Please accept the Terms of Use and Privacy Policy to continue.");
      return;
    }
    setJoining(true);
    try {
      const result = await joinQuiz({ data: { quizId: quiz.id, name: parsed.data.name, phone: parsed.data.phone, consent: true } });
      const next = { participantId: result.participantId, token: result.token };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSession(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join — the lobby may not be open yet.");
    } finally {
      setJoining(false);
    }
  };

  if (kicked) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg px-4 sm:px-6">
        <div className="surface-card max-w-md p-5 sm:p-8 text-center">
          <h1 className="text-2xl font-bold">You've been removed</h1>
          <p className="mt-2 text-muted-foreground">
            Your tutor removed you from this session. Ask them for a new link if this was a mistake.
          </p>
          <Button asChild className="chunky mt-5 rounded-xl font-bold">
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg px-4 sm:px-6">
        <div className="surface-card max-w-md p-5 sm:p-8 text-center">
          <h1 className="text-2xl font-bold">Quiz not found</h1>
          <p className="mt-2 text-muted-foreground">
            Double-check the code <span className="font-bold">{code}</span> with your tutor.
          </p>
          <Button asChild className="chunky mt-5 rounded-xl font-bold">
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg px-4 py-6 sm:px-6 sm:py-12">
        <div className="pop-in w-full max-w-md surface-card p-5 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">You're invited</p>
          <h1 className="mt-2 text-3xl font-bold">{quiz.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your details to take your seat in the lobby.
          </p>
          <form onSubmit={join} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                placeholder="Chidi Okafor"
                className="h-12 rounded-xl border-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={phone}
                maxLength={20}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="080 1234 5678"
                className="h-12 rounded-xl border-2"
              />
            </div>
            <ConsentCheckbox id="quiz-consent" checked={agreed} onChange={setAgreed} audience="student" />
            <Button
              type="submit"
              disabled={joining || !agreed || quiz.status === "draft" || quiz.status === "ended"}
              className="chunky h-auto min-h-12 w-full whitespace-normal rounded-xl py-3 text-base font-bold"
            >
              {quiz.status === "draft"
                ? "Waiting for tutor to open the lobby"
                : quiz.status === "ended"
                  ? "This quiz has ended"
                  : joining
                    ? "Joining…"
                    : "Enter the lobby"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (quiz.status === "lobby" || quiz.status === "draft") {
    return <Lobby quiz={quiz} />;
  }

  return <Play quiz={quiz} session={session} />;
}

function Lobby({ quiz }: { quiz: Quiz }) {
  const [board, setBoard] = useState<BoardRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try { setBoard(await getBoard({ data: { quizId: quiz.id } })); } catch { /* retry on next tick */ }
    };
    void load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [quiz.id]);

  return (
    <div className="grid min-h-screen place-items-center confetti-bg px-4 py-6 sm:px-6 sm:py-12">
      <div className="pop-in w-full max-w-xl surface-card p-5 sm:p-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1 text-sm font-bold text-secondary-foreground">
          <Users className="size-4" /> {board.length} in the lobby
        </span>
        <h1 className="mt-4 text-3xl font-bold">{quiz.title}</h1>
        <p className="mt-2 text-muted-foreground">
          Hang tight — the quiz starts the moment your tutor hits start.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-3 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${dot * 0.15}s` }}
            />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {board.map((person) => (
            <span
              key={person.id}
              className="max-w-full break-words rounded-full border-2 border-border bg-card px-3 py-1 text-sm font-bold"
            >
              {person.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Play({ quiz, session }: { quiz: Quiz; session: Session }) {
  const { token, participantId } = session;
  const [questions, setQuestions] = useState<PlayableQuestion[] | null>(null);
  const [index, setIndex] = useState(quiz.skip_signal);
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [answerKey, setAnswerKey] = useState<string | null>(null);
  const [waiting, setWaiting] = useState({ answered: 0, total: 0 });
  const [done, setDone] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const deadline = useRef<number>(Date.now());
  const pausedAt = useRef<number | null>(null);
  const lastSkip = useRef<number>(quiz.skip_signal);
  const lastExtend = useRef<number>(quiz.extend_signal);
  const locked = useRef(false);
  // Device clocks can be wrong; every deadline is compared against the SERVER's clock.
  const srvOffset = useRef(0);
  srvOffset.current = quiz.server_now ? Date.parse(quiz.server_now) - Date.now() : srvOffset.current;
  const srvNow = () => Date.now() + srvOffset.current;

  useEffect(() => {
    let live = true;
    const load = () =>
      getPlayQuestions({ data: { quizId: quiz.id } })
        .then((rows) => live && setQuestions(rows.map((row) => ({ ...row, options: toOptions(row.options) })) as PlayableQuestion[]))
        .catch(() => live && setTimeout(load, 2000));
    void load();
    return () => { live = false; };
  }, [quiz.id]);

  const current = questions?.[index];

  const goNext = useCallback(async () => {
    const isLast = quiz.skip_signal >= (questions?.length ?? 0);
    if (isLast) {
      await finishParticipant({ data: { token } }).catch(() => undefined);
      setDone(true);
      return;
    }
    setIndex(quiz.skip_signal);
    setAnswer("");
    setSubmitted(false);
    setWasCorrect(null);
    setAnswerKey(null);
    setWaiting({ answered: 0, total: 0 });
    startedAt.current = srvNow();
  }, [quiz.skip_signal, token, questions?.length]);

  const submit = useCallback(
    async (response: string) => {
      if (!current || locked.current || submitted || quiz.paused) return;
      locked.current = true;
      // Timing is measured by the server from the shared question clock — we send only the answer.
      try {
        const { correct } = await submitAnswer({ data: { token, questionId: current.id, response } });
        setSubmitted(true);
        setWasCorrect(correct);
        if (quiz.reveal_answers) {
          const { answer: key } = await getAnswerKey({ data: { token, questionId: current.id } }).catch(() => ({ answer: null }));
          if (typeof key === "string") setAnswerKey(key);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        // The question just closed or the quiz paused — the next poll will move us on; don't strand the student.
        if (/paused|isn't open/i.test(message)) toast.info(message);
        else setSubmitted(true);
      } finally {
        locked.current = false;
      }
    },
    [current, token, submitted, quiz.reveal_answers, quiz.paused],
  );

  // New question: reset the clock and start ticking.
  useEffect(() => {
    if (!current || done) return;
    locked.current = false;
    setSubmitted(false);
    setWasCorrect(null);
    setAnswerKey(null);
    setWaiting({ answered: 0, total: 0 });
    startedAt.current = srvNow();
    deadline.current = quiz.question_deadline_at ? Date.parse(quiz.question_deadline_at) : srvNow() + current.time_limit * 1000;
    pausedAt.current = null;
    setRemaining(Math.max(0, Math.ceil((deadline.current - srvNow()) / 1000)));
    const timer = setInterval(() => {
      if (pausedAt.current !== null) return;
      setRemaining(Math.max(0, Math.ceil((deadline.current - srvNow()) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, [current?.id, done, current]);

  // Host pressed pause / resume: freeze and thaw the clock for everyone.
  useEffect(() => {
    if (quiz.paused) {
      if (pausedAt.current === null) pausedAt.current = srvNow();
      return;
    }
    if (pausedAt.current !== null) {
      const frozen = srvNow() - pausedAt.current;
      if (!quiz.question_deadline_at) deadline.current += frozen;
      startedAt.current += frozen;
      pausedAt.current = null;
    }
  }, [quiz.paused]);

  // Host added extra seconds to the current question.
  useEffect(() => {
    if (quiz.extend_signal === lastExtend.current) return;
    lastExtend.current = quiz.extend_signal;
    if (quiz.extend_seconds > 0) {
      if (!quiz.question_deadline_at) deadline.current += quiz.extend_seconds * 1000;
      setRemaining(Math.max(0, Math.ceil((deadline.current - srvNow()) / 1000)));
      toast.info(`Your tutor added ${quiz.extend_seconds} seconds`);
    }
  }, [quiz.extend_signal, quiz.extend_seconds]);

  useEffect(() => {
    if (!quiz.question_deadline_at) return;
    deadline.current = Date.parse(quiz.question_deadline_at);
    const clock = quiz.paused && quiz.question_paused_at ? Date.parse(quiz.question_paused_at) : srvNow();
    setRemaining(Math.max(0, Math.ceil((deadline.current - clock) / 1000)));
  }, [quiz.question_deadline_at, quiz.question_paused_at, quiz.paused, current?.id]);

  // The tutor's question signal is the shared cursor, including for late arrivals.
  useEffect(() => {
    if (quiz.skip_signal === lastSkip.current || done || !current) return;
    lastSkip.current = quiz.skip_signal;
    void (async () => { if (!submitted) await submit(""); await goNext(); })();
  }, [quiz.skip_signal, done, current, submitted, submit, goNext]);

  // Time is up: lock the answer while the shared database cursor advances everyone.
  useEffect(() => {
    if (!current || done || remaining > 0 || quiz.paused || srvNow() < deadline.current) return;
    let cancelled = false;
    (async () => {
      if (!submitted) await submit("");
      if (!cancelled && index + 1 >= (questions?.length ?? 0)) {
        await finishParticipant({ data: { token } }).catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remaining, current?.id, done, submitted, submit, goNext, current, quiz.paused]);

  // Show answer progress while waiting for the tutor's next question.
  useEffect(() => {
    if (!current || done || !submitted || quiz.paused) return;
    let stop = false;
    const check = async () => {
      try {
        const row = await getQuestionProgress({ data: { quizId: quiz.id, questionId: current.id } });
        if (!stop) setWaiting(row);
      } catch { /* retry on next tick */ }
    };
    void check();
    const poll = setInterval(check, 1500);
    return () => {
      stop = true;
      clearInterval(poll);
    };
  }, [submitted, current?.id, done, goNext, quiz.id, current, quiz.paused]);




  if (done || quiz.status === "ended") return <Results quiz={quiz} participantId={participantId} />;

  if (!questions) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg px-4 sm:px-6">
        <div className="surface-card max-w-md p-5 sm:p-8 text-center">
          <h1 className="text-2xl font-bold">No questions yet</h1>
          <p className="mt-2 text-muted-foreground">Your tutor hasn't added any questions.</p>
        </div>
      </div>
    );
  }

  const progress = ((index + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen confetti-bg px-4 py-5 sm:px-6 sm:py-10">
      <div className="pop-in mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
              quiz.paused
                ? "bg-muted text-muted-foreground"
                : remaining <= 5
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-secondary text-secondary-foreground"
            }`}
          >
            <Timer className="size-4" /> {quiz.paused ? "Paused" : `${remaining}s`}
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full border-2 border-border bg-card">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        {quiz.paused && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-border bg-card p-4 text-center font-bold">
            Your tutor paused the quiz — hang tight.
          </div>
        )}

        <div className="mt-6 surface-card p-5 sm:p-8">
          <h1 className="text-2xl font-bold leading-snug">{current.prompt}</h1>

          {submitted ? (
            <div className="mt-6 rounded-xl border-2 border-border bg-muted/40 p-6 text-center">
              {quiz.reveal_answers && wasCorrect !== null ? (
                <>
                  <p
                    className={`font-display text-2xl font-bold ${
                      wasCorrect ? "text-secondary" : "text-destructive"
                    }`}
                  >
                    {wasCorrect ? "Correct!" : "Not quite"}
                  </p>
                  {answerKey && (
                    <p className="mt-1 text-sm font-bold">
                      Answer: <span className="text-primary">{answerKey}</span>
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Loader2 className="mx-auto size-6 animate-spin text-primary" />
                  <p className="mt-3 font-bold">Answer locked in!</p>
                </>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                {waiting.total > 0
                  ? `Waiting for the others — ${waiting.answered} of ${waiting.total} answered.`
                  : "Waiting for the others…"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Waiting for your tutor to show the next question.
              </p>
            </div>
          ) : (
            <>
              {current.type === "multiple_choice" && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {current.options
                    .filter((option) => option.trim().length > 0)
                    .map((option) => (
                      <Button
                        key={option}
                        onClick={() => submit(option)}
                        variant="outline"
                        className="chunky h-auto min-h-14 whitespace-normal rounded-xl border-2 py-3 text-base font-bold"
                      >
                        {option}
                      </Button>
                    ))}
                </div>
              )}

              {current.type === "true_false" && (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {["True", "False"].map((option) => (
                    <Button
                      key={option}
                      onClick={() => submit(option)}
                      variant="outline"
                      className="chunky h-16 rounded-xl border-2 text-lg font-bold"
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}

              {current.type === "short_answer" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!answer.trim()) return;
                    submit(answer);
                  }}
                  className="mt-6 space-y-3"
                >
                  <Input
                    value={answer}
                    maxLength={120}
                    autoFocus
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type your answer…"
                    className="h-14 rounded-xl border-2 text-lg"
                  />
                  <Button type="submit" className="chunky h-auto min-h-12 w-full whitespace-normal rounded-xl py-3 text-base font-bold">
                    Submit answer
                  </Button>
                </form>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}

function Results({ quiz, participantId }: { quiz: Quiz; participantId: string }) {
  const [board, setBoard] = useState<BoardRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try { setBoard(await getBoard({ data: { quizId: quiz.id } })); } catch { /* retry on next tick */ }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [quiz.id]);

  const me = useMemo(() => board.find((row) => row.id === participantId), [board, participantId]);
  const rank = board.findIndex((row) => row.id === participantId) + 1;

  return (
    <div className="min-h-screen confetti-bg px-4 py-6 sm:px-6 sm:py-12">
      <div className="pop-in mx-auto w-full max-w-xl">
        <div className="surface-card p-5 sm:p-8 text-center">
          <PartyPopper className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 text-3xl font-bold">All done!</h1>
          {me && (
            <p className="mt-2 text-muted-foreground">
              You scored <span className="font-bold text-foreground">{me.score}</span> in{" "}
              <span className="font-bold text-foreground">{formatMs(me.total_time_ms)}</span> — rank #{rank}.
            </p>
          )}
        </div>

        <h2 className="mt-8 flex items-center gap-2 text-2xl font-bold">
          <Trophy className="size-6 text-primary" /> Leaderboard
        </h2>
        <div className="mt-3 space-y-2">
          {board.map((row, position) => (
            <div
              key={row.id}
              className={`surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 sm:px-5 ${
                row.id === participantId ? "border-primary" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-display font-bold">
                  {MEDAL[position] ?? position + 1}
                </span>
                <p className="min-w-0 break-words font-bold">{row.name}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm font-bold sm:flex-row sm:gap-4">
                <span className="text-primary">{row.score}</span>
                <span className="text-muted-foreground">{formatMs(row.total_time_ms)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
