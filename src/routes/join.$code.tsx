import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PartyPopper, Timer, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatMs, MEDAL, toOptions, type BoardRow, type PlayableQuestion } from "@/lib/quiz";

export const Route = createFileRoute("/join/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join the live quiz — Kominimo" },
      { name: "description", content: "Enter your name, wait in the lobby and play the live quiz." },
      { property: "og:title", content: "Join the live quiz — Kominimo" },
      { property: "og:description", content: "Enter your name and play the live quiz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

type Quiz = {
  id: string;
  title: string;
  status: "draft" | "lobby" | "live" | "ended";
  paused: boolean;
  reveal_answers: boolean;
  skip_signal: number;
  extend_signal: number;
  extend_seconds: number;
};

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
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [joining, setJoining] = useState(false);
  const [kicked, setKicked] = useState(false);

  const storageKey = `quizpop:${code}`;

  const loadQuiz = useCallback(async () => {
    const { data } = await supabase
      .from("quizzes")
      .select("id, title, status, paused, reveal_answers, skip_signal, extend_signal, extend_seconds")
      .eq("join_code", code.toUpperCase())
      .maybeSingle();
    setQuiz(data as Quiz | null);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setParticipantId(saved);
    loadQuiz();
  }, [loadQuiz, storageKey]);

  useEffect(() => {
    if (!quiz) return;
    const channel = supabase
      .channel(`quiz-${quiz.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quizzes", filter: `id=eq.${quiz.id}` },
        (payload) => setQuiz(payload.new as Quiz),
      )
      .subscribe();
    const poll = setInterval(loadQuiz, 1500);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [quiz?.id, loadQuiz, quiz]);

  // The tutor can remove a student mid-session.
  useEffect(() => {
    if (!participantId) return;
    const check = async () => {
      const { data, error } = await supabase.rpc("participant_alive", {
        _participant_id: participantId,
      });
      if (!error && data === false) {
        localStorage.removeItem(storageKey);
        setKicked(true);
      }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [participantId, storageKey]);



  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quiz) return;
    const parsed = joinSchema.safeParse({ name, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setJoining(true);
    const { data: open } = await supabase.rpc("quiz_join_open", { _quiz_id: quiz.id });
    if (open === false) {
      setJoining(false);
      toast.error("This quiz isn't open right now — ask your tutor to open the lobby.");
      return;
    }
    // Students have no account and can't read the participants list, so joining goes through a safe server step.
    const { data, error } = await supabase.rpc("join_quiz", {
      _quiz_id: quiz.id,
      _name: parsed.data.name,
      _phone: parsed.data.phone,
    });
    setJoining(false);
    if (error || !data) {
      toast.error("Could not join — the lobby may not be open yet.");
      return;
    }
    localStorage.setItem(storageKey, data as string);
    setParticipantId(data as string);
  };

  if (kicked) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg px-6">
        <div className="surface-card max-w-md p-8 text-center">
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
      <div className="grid min-h-screen place-items-center confetti-bg px-6">
        <div className="surface-card max-w-md p-8 text-center">
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

  if (!participantId) {
    return (
      <div className="grid min-h-screen place-items-center confetti-bg px-6 py-12">
        <div className="pop-in w-full max-w-md surface-card p-8">
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
            <Button
              type="submit"
              disabled={joining || quiz.status === "draft" || quiz.status === "ended"}
              className="chunky h-12 w-full rounded-xl text-base font-bold"
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

  return <Play quiz={quiz} participantId={participantId} />;
}

function Lobby({ quiz }: { quiz: Quiz }) {
  const [board, setBoard] = useState<BoardRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("get_quiz_board", { _quiz_id: quiz.id });
      setBoard((data ?? []) as BoardRow[]);
    };
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [quiz.id]);

  return (
    <div className="grid min-h-screen place-items-center confetti-bg px-6 py-12">
      <div className="pop-in w-full max-w-xl surface-card p-8 text-center">
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
              className="rounded-full border-2 border-border bg-card px-3 py-1 text-sm font-bold"
            >
              {person.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Play({ quiz, participantId }: { quiz: Quiz; participantId: string }) {
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

  useEffect(() => {
    supabase.rpc("get_quiz_questions", { _quiz_id: quiz.id }).then(({ data }) => {
      const rows = (data ?? []).map((row) => ({
        ...(row as PlayableQuestion),
        options: toOptions((row as { options: unknown }).options),
      }));
      setQuestions(rows as PlayableQuestion[]);
    });
  }, [quiz.id]);

  const current = questions?.[index];

  const goNext = useCallback(async () => {
    const isLast = quiz.skip_signal >= (questions?.length ?? 0);
    if (isLast) {
      await supabase.rpc("finish_participant", { _participant_id: participantId });
      setDone(true);
      return;
    }
    setIndex(quiz.skip_signal);
    setAnswer("");
    setSubmitted(false);
    setWasCorrect(null);
    setAnswerKey(null);
    setWaiting({ answered: 0, total: 0 });
    startedAt.current = Date.now();
  }, [quiz.skip_signal, participantId, questions?.length]);

  const submit = useCallback(
    async (response: string) => {
      if (!current || locked.current || submitted || quiz.paused) return;
      locked.current = true;
      const elapsed = Math.max(0, Date.now() - startedAt.current);
      const { data } = await supabase.rpc("submit_answer", {
        _participant_id: participantId,
        _question_id: current.id,
        _response: response,
        _time_ms: elapsed,
      });
      setSubmitted(true);
      setWasCorrect(Boolean(data));
      locked.current = false;
      if (quiz.reveal_answers) {
        const { data: key } = await supabase.rpc("get_answer_key", { _question_id: current.id });
        if (typeof key === "string") setAnswerKey(key);
      }
    },
    [current, participantId, submitted, quiz.reveal_answers, quiz.paused],
  );

  // New question: reset the clock and start ticking.
  useEffect(() => {
    if (!current || done) return;
    locked.current = false;
    setSubmitted(false);
    setWasCorrect(null);
    setAnswerKey(null);
    setWaiting({ answered: 0, total: 0 });
    startedAt.current = Date.now();
    deadline.current = Date.now() + current.time_limit * 1000;
    pausedAt.current = null;
    setRemaining(current.time_limit);
    const timer = setInterval(() => {
      if (pausedAt.current !== null) return;
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, [current?.id, done, current]);

  // Host pressed pause / resume: freeze and thaw the clock for everyone.
  useEffect(() => {
    if (quiz.paused) {
      if (pausedAt.current === null) pausedAt.current = Date.now();
      return;
    }
    if (pausedAt.current !== null) {
      const frozen = Date.now() - pausedAt.current;
      deadline.current += frozen;
      startedAt.current += frozen;
      pausedAt.current = null;
    }
  }, [quiz.paused]);

  // Host added extra seconds to the current question.
  useEffect(() => {
    if (quiz.extend_signal === lastExtend.current) return;
    lastExtend.current = quiz.extend_signal;
    if (quiz.extend_seconds > 0) {
      deadline.current += quiz.extend_seconds * 1000;
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
      toast.info(`Your tutor added ${quiz.extend_seconds} seconds`);
    }
  }, [quiz.extend_signal, quiz.extend_seconds]);

  // The tutor's question signal is the shared cursor, including for late arrivals.
  useEffect(() => {
    if (quiz.skip_signal === lastSkip.current || done || !current) return;
    lastSkip.current = quiz.skip_signal;
    if (!submitted) void submit("");
    void goNext();
  }, [quiz.skip_signal, done, current, submitted, submit, goNext]);

  // Time is up: lock the answer; only the tutor advances the shared question.
  useEffect(() => {
    if (!current || done || remaining > 0 || quiz.paused) return;
    let cancelled = false;
    (async () => {
      if (!submitted) await submit("");
      if (!cancelled && index + 1 >= (questions?.length ?? 0)) {
        await supabase.rpc("finish_participant", { _participant_id: participantId });
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
      const { data } = await supabase.rpc("question_progress", {
        _quiz_id: quiz.id,
        _question_id: current.id,
      });
      const row = (data as { answered: number; total: number }[] | null)?.[0];
      if (!row || stop) return;
      setWaiting(row);
    };
    check();
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
      <div className="grid min-h-screen place-items-center confetti-bg px-6">
        <div className="surface-card max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold">No questions yet</h1>
          <p className="mt-2 text-muted-foreground">Your tutor hasn't added any questions.</p>
        </div>
      </div>
    );
  }

  const progress = ((index + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen confetti-bg px-6 py-10">
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

        <div className="mt-6 surface-card p-8">
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
                  <Button type="submit" className="chunky h-12 w-full rounded-xl text-base font-bold">
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
      const { data } = await supabase.rpc("get_quiz_board", { _quiz_id: quiz.id });
      setBoard((data ?? []) as BoardRow[]);
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [quiz.id]);

  const me = useMemo(() => board.find((row) => row.id === participantId), [board, participantId]);
  const rank = board.findIndex((row) => row.id === participantId) + 1;

  return (
    <div className="min-h-screen confetti-bg px-6 py-12">
      <div className="pop-in mx-auto w-full max-w-xl">
        <div className="surface-card p-8 text-center">
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
              className={`surface-card flex items-center justify-between px-5 py-3 ${
                row.id === participantId ? "border-primary" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-muted font-display font-bold">
                  {MEDAL[position] ?? position + 1}
                </span>
                <p className="font-bold">{row.name}</p>
              </div>
              <div className="flex items-center gap-4 text-sm font-bold">
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
