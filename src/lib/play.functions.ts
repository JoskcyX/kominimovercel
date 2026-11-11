import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { anonymous } from "@/lib/middleware";
import { identifier, joinCode, personName, uuid } from "@/lib/validation";

/**
 * Student-side quiz API (no account). Reads are public but contain only what students may see;
 * anything that CHANGES state needs the signed participant token issued by joinQuiz.
 * Hot, identical polls are shared per server instance for ~1 s so 250 students ≈ 1 query/sec.
 */
const K = () => import("@/server/kit");
const POLL_TTL = 1000;

export type QuizPublic = {
  id: string;
  title: string;
  status: "draft" | "lobby" | "live" | "ended";
  paused: boolean;
  reveal_answers: boolean;
  skip_signal: number;
  extend_signal: number;
  extend_seconds: number;
  question_deadline_at: string | null;
  question_paused_at: string | null;
  /** Server clock at response time — lets the browser correct for a wrong device clock. */
  server_now: string;
};

async function fetchQuiz(by: { code?: string; id?: string }): Promise<QuizPublic | null> {
  const { withDb, sql } = await K();
  const row = await withDb({}, (tx) =>
    tx.one<Omit<QuizPublic, "server_now">>(
      sql`SELECT * FROM public.get_quiz_public(${by.code ?? null}, ${by.id ?? null})`,
    ),
  );
  return row ? { ...row, server_now: new Date().toISOString() } : null;
}

export const getQuizByCode = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(z.object({ code: joinCode }))
  .handler(async ({ data }) => {
    const { cached } = await K();
    return cached(`quiz:code:${data.code}`, POLL_TTL, () => fetchQuiz({ code: data.code }));
  });

export const getQuizState = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(z.object({ quizId: uuid }))
  .handler(async ({ data }) => {
    const { cached } = await K();
    const q = await cached(`quiz:id:${data.quizId}`, POLL_TTL, () =>
      fetchQuiz({ id: data.quizId }),
    );
    return q ? { ...q, server_now: new Date().toISOString() } : null;
  });

export const getPlayQuestions = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(z.object({ quizId: uuid }))
  .handler(async ({ data }) => {
    const { cached, withDb, sql } = await K();
    const rows = await cached(`quiz:questions:${data.quizId}`, 3000, () =>
      withDb({}, (tx) => tx.all(sql`SELECT * FROM public.get_quiz_questions(${data.quizId})`)),
    );
    return rows.map((r) => ({
      ...r,
      options: Array.isArray(r["options"]) ? (r["options"] as unknown[]).map(String) : [],
    })) as {
      id: string;
      order_index: number;
      type: "multiple_choice" | "true_false" | "short_answer";
      prompt: string;
      options: string[];
      time_limit: number;
    }[];
  });

export const getBoard = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(z.object({ quizId: uuid }))
  .handler(async ({ data }) => {
    const { cached, withDb, sql } = await K();
    return cached(`quiz:board:${data.quizId}`, POLL_TTL * 1.5, () =>
      withDb({}, (tx) =>
        tx.all<{
          id: string;
          name: string;
          score: number;
          total_time_ms: number;
          finished: boolean;
        }>(sql`SELECT * FROM public.get_quiz_board(${data.quizId})`),
      ),
    );
  });

export const getQuestionProgress = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(z.object({ quizId: uuid, questionId: uuid }))
  .handler(async ({ data }) => {
    const { cached, withDb, sql } = await K();
    return cached(
      `quiz:progress:${data.quizId}:${data.questionId}`,
      POLL_TTL,
      async () =>
        (await withDb({}, (tx) =>
          tx.one<{ answered: number; total: number }>(
            sql`SELECT * FROM public.question_progress(${data.quizId}, ${data.questionId})`,
          ),
        )) ?? { answered: 0, total: 0 },
    );
  });

export const joinQuiz = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(
    z.object({
      quizId: uuid,
      name: personName,
      phone: identifier,
      consent: z.literal(true, {
        errorMap: () => ({
          message: "Please accept the Terms of Use and Privacy Policy to continue.",
        }),
      }),
    }),
  )
  .handler(async ({ data, context }) => {
    const {
      withDb,
      sql,
      rateLimit,
      LIMITS,
      STUDENT_CONSENT_TAG,
      signCapability,
      PARTICIPANT_TOKEN_TTL,
    } = await K();
    const participantId = await withDb({}, async (tx) => {
      await rateLimit(
        tx,
        `join-quiz:${context.ipHash}`,
        LIMITS.join.windowSeconds,
        LIMITS.join.max,
      );
      return tx.scalar<string>(
        sql`SELECT public.join_quiz(${data.quizId}, ${data.name}, ${data.phone}, ${STUDENT_CONSENT_TAG})`,
      );
    });
    return {
      participantId: participantId!,
      token: await signCapability("participant", participantId!, PARTICIPANT_TOKEN_TTL),
    };
  });

const tokenInput = z.object({ token: z.string().min(20).max(400) });

async function participant(token: string) {
  const k = await K();
  return k.verifyCapability("participant", token);
}

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(tokenInput.extend({ questionId: uuid, response: z.string().max(500) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, rateLimit, LIMITS } = await K();
    const pid = await participant(data.token);
    return withDb({}, async (tx) => {
      await rateLimit(tx, `submit:${pid}`, LIMITS.submit.windowSeconds, LIMITS.submit.max);
      await rateLimit(
        tx,
        `submit-ip:${context.ipHash}`,
        LIMITS.submit.windowSeconds,
        LIMITS.submit.max * 20,
      );
      const ok = await tx.scalar<boolean>(
        sql`SELECT public.submit_answer(${pid}, ${data.questionId}, ${data.response})`,
      );
      return { correct: Boolean(ok) };
    });
  });

export const finishParticipant = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const pid = await participant(data.token);
    await withDb({}, (tx) => tx.exec(sql`SELECT public.finish_participant(${pid})`));
    return { ok: true };
  });

export const participantAlive = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const pid = await participant(data.token);
    return {
      alive: Boolean(
        await withDb({}, (tx) => tx.scalar<boolean>(sql`SELECT public.participant_alive(${pid})`)),
      ),
    };
  });

export const getAnswerKey = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(tokenInput.extend({ questionId: uuid }))
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const pid = await participant(data.token);
    return {
      answer: await withDb({}, (tx) =>
        tx.scalar<string>(sql`SELECT public.get_answer_key(${pid}, ${data.questionId})`),
      ),
    };
  });

/** Any client may nudge the shared clock; the database only moves it once the deadline truly passed. */
const lastNudge = new Map<string, number>();
export const advanceQuizTimer = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(z.object({ quizId: uuid, expectedIndex: z.number().int().min(0).max(10000) }))
  .handler(async ({ data }) => {
    const key = `${data.quizId}:${data.expectedIndex}`;
    const now = Date.now();
    if (now - (lastNudge.get(key) ?? 0) < 1000) return { advanced: false };
    lastNudge.set(key, now);
    if (lastNudge.size > 500) lastNudge.clear();
    const { withDb, sql } = await K();
    const ok = await withDb({}, (tx) =>
      tx.scalar<boolean>(
        sql`SELECT public.advance_quiz_timer(${data.quizId}, ${data.expectedIndex})`,
      ),
    );
    return { advanced: Boolean(ok) };
  });
