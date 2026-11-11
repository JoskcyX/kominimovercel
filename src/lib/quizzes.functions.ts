import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { tutor } from "@/lib/middleware";
import { questionInput, uuid } from "@/lib/validation";

/**
 * Tutor-side quiz API. Every function requires a signed-in tutor who has accepted the current
 * Terms; the database additionally enforces ownership through Row Level Security.
 */
const K = () => import("@/server/kit");
const quizIdInput = z.object({ quizId: uuid });
const OPTIONS = (v: unknown) => (Array.isArray(v) ? v.map((o) => String(o ?? "")) : []);

export const listQuizzes = createServerFn({ method: "GET" })
  .middleware([tutor])
  .handler(async ({ context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{
        id: string;
        title: string;
        join_code: string;
        status: "draft" | "lobby" | "live" | "ended";
        created_at: string;
      }>(
        sql`SELECT id, title, join_code, status, created_at FROM public.quizzes WHERE tutor_id = ${context.actor.userId} ORDER BY created_at DESC`,
      ),
    );
  });

export const createQuiz = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ title: z.string().trim().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, assertWithinPlan, withUniqueCode, makeCode } = await K();
    return withDb({ userId: context.actor.userId }, async (tx) => {
      const n =
        (await tx.scalar<number>(
          sql`SELECT count(*) FROM public.quizzes WHERE tutor_id = ${context.actor.userId}`,
        )) ?? 0;
      assertWithinPlan(context.actor, "maxQuizzes", Number(n), "quizzes");
      return withUniqueCode(
        () => makeCode(6),
        async (code) => {
          await tx.exec(sql`SAVEPOINT code_try`);
          try {
            const row = await tx.one<{ id: string }>(
              sql`INSERT INTO public.quizzes (tutor_id, title, join_code) VALUES (${context.actor.userId}, ${data.title}, ${code}) RETURNING id`,
            );
            return { id: row!.id };
          } catch (e) {
            await tx.exec(sql`ROLLBACK TO SAVEPOINT code_try`);
            throw e;
          }
        },
      );
    });
  });

export const deleteQuiz = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(quizIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(
        sql`DELETE FROM public.quizzes WHERE id = ${data.quizId} AND tutor_id = ${context.actor.userId}`,
      ),
    );
    return { ok: true };
  });

export const renameQuiz = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ quizId: uuid, title: z.string().trim().max(120) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(
        sql`UPDATE public.quizzes SET title = ${data.title || "Untitled quiz"} WHERE id = ${data.quizId} AND tutor_id = ${context.actor.userId}`,
      ),
    );
    return { ok: true };
  });

/** The quiz as the host sees it. Polled every ~1.5 s while the quiz runs (replaces realtime). */
export const getQuizAdmin = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(quizIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    const row = await withDb({ userId: context.actor.userId }, (tx) =>
      tx.one(sql`SELECT id, title, join_code, status, paused, reveal_answers, skip_signal, extend_signal, extend_seconds,
                        question_deadline_at, question_paused_at FROM public.quizzes WHERE id = ${data.quizId} AND tutor_id = ${context.actor.userId}`),
    );
    if (!row) throw new AppError("NOT_FOUND", "We couldn't find that quiz.");
    return { ...row, server_now: new Date().toISOString() } as {
      id: string;
      title: string;
      join_code: string;
      status: "draft" | "lobby" | "live" | "ended";
      paused: boolean;
      reveal_answers: boolean;
      skip_signal: number;
      extend_signal: number;
      extend_seconds: number;
      question_deadline_at: string | null;
      question_paused_at: string | null;
      server_now: string;
    };
  });

export const listQuestionsAdmin = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(quizIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    const rows = await withDb({ userId: context.actor.userId }, (tx) =>
      tx.all(sql`SELECT q.id, q.order_index, q.type, q.prompt, q.options, q.correct_answer, q.time_limit
                 FROM public.questions q JOIN public.quizzes z ON z.id = q.quiz_id
                 WHERE q.quiz_id = ${data.quizId} AND z.tutor_id = ${context.actor.userId} ORDER BY q.order_index, q.id`),
    );
    return rows.map((r) => ({ ...r, options: OPTIONS(r["options"]) })) as {
      id: string;
      order_index: number;
      type: "multiple_choice" | "true_false" | "short_answer";
      prompt: string;
      options: string[];
      correct_answer: string;
      time_limit: number;
    }[];
  });

export const addBlankQuestion = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(quizIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql, assertWithinPlan } = await K();
    await withDb({ userId: context.actor.userId }, async (tx) => {
      const n = Number(
        (await tx.scalar(
          sql`SELECT count(*) FROM public.questions q JOIN public.quizzes z ON z.id = q.quiz_id WHERE q.quiz_id = ${data.quizId} AND z.tutor_id = ${context.actor.userId}`,
        )) ?? 0,
      );
      assertWithinPlan(context.actor, "maxQuestionsPerQuiz", n, "questions per quiz");
      const next = Number(
        (await tx.scalar(
          sql`SELECT coalesce(max(order_index), 0) + 1 FROM public.questions WHERE quiz_id = ${data.quizId}`,
        )) ?? 1,
      );
      await tx.exec(sql`INSERT INTO public.questions (quiz_id, order_index, type, prompt, options, correct_answer, time_limit)
                        VALUES (${data.quizId}, ${next}, 'multiple_choice', '', ${JSON.stringify(["", "", "", ""])}::jsonb, '', 20)`);
    });
    return { ok: true };
  });

export const updateQuestion = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid }).merge(questionInput))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`UPDATE public.questions SET type = ${data.type}::public.question_type, prompt = ${data.prompt},
                         options = ${JSON.stringify(data.type === "multiple_choice" ? data.options : [])}::jsonb,
                         correct_answer = ${data.correct_answer}, time_limit = ${data.time_limit} WHERE id = ${data.id}`),
    );
    return { ok: true };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`DELETE FROM public.questions WHERE id = ${data.id}`),
    );
    return { ok: true };
  });

export const importQuestions = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      quizId: uuid,
      timeLimit: z.number().int().min(5).max(300),
      items: z
        .array(questionInput.omit({ time_limit: true }))
        .min(1)
        .max(200),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql, assertWithinPlan } = await K();
    return withDb({ userId: context.actor.userId }, async (tx) => {
      const owns = await tx.scalar(
        sql`SELECT 1 FROM public.quizzes WHERE id = ${data.quizId} AND tutor_id = ${context.actor.userId}`,
      );
      if (!owns) throw new (await K()).AppError("NOT_FOUND", "We couldn't find that quiz.");
      const have = Number(
        (await tx.scalar(
          sql`SELECT count(*) FROM public.questions WHERE quiz_id = ${data.quizId}`,
        )) ?? 0,
      );
      assertWithinPlan(
        context.actor,
        "maxQuestionsPerQuiz",
        have + data.items.length - 1,
        "questions per quiz",
      );
      let order = Number(
        (await tx.scalar(
          sql`SELECT coalesce(max(order_index), 0) FROM public.questions WHERE quiz_id = ${data.quizId}`,
        )) ?? 0,
      );
      for (const q of data.items) {
        order += 1;
        await tx.exec(sql`INSERT INTO public.questions (quiz_id, order_index, type, prompt, options, correct_answer, time_limit)
                          VALUES (${data.quizId}, ${order}, ${q.type}::public.question_type, ${q.prompt}, ${JSON.stringify(q.options)}::jsonb, ${q.correct_answer}, ${data.timeLimit})`);
      }
      return { count: data.items.length };
    });
  });

/* ── Running a quiz ───────────────────────────────────────────────────────────────────────
 * The host sends an intent ("next", "pause"…); the server decides the new state. A browser can't
 * set arbitrary columns (e.g. fabricate a deadline or jump the cursor).                      */
const ACTIONS = [
  "lobby",
  "start",
  "end",
  "pause",
  "resume",
  "next",
  "extend15",
  "extend30",
  "reveal_on",
  "reveal_off",
] as const;

export const quizAction = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ quizId: uuid, action: z.enum(ACTIONS) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    await withDb({ userId: context.actor.userId }, async (tx) => {
      const q = await tx.one<{ status: string; skip_signal: number; extend_signal: number }>(
        sql`SELECT status, skip_signal, extend_signal FROM public.quizzes WHERE id = ${data.quizId} AND tutor_id = ${context.actor.userId} FOR UPDATE`,
      );
      if (!q) throw new AppError("NOT_FOUND", "We couldn't find that quiz.");
      const count = Number(
        (await tx.scalar(
          sql`SELECT count(*) FROM public.questions WHERE quiz_id = ${data.quizId}`,
        )) ?? 0,
      );
      const id = data.quizId;
      const live = q.status === "live";
      switch (data.action) {
        case "lobby":
          await tx.exec(sql`UPDATE public.quizzes SET status = 'lobby' WHERE id = ${id}`);
          break;
        case "start":
          if (count === 0)
            throw new AppError("INVALID", "Add at least one question before starting.");
          await tx.exec(
            sql`UPDATE public.quizzes SET status = 'live', started_at = now(), skip_signal = 0, extend_signal = 0, paused = false WHERE id = ${id}`,
          );
          break;
        case "end":
          await tx.exec(sql`UPDATE public.quizzes SET status = 'ended' WHERE id = ${id}`);
          break;
        case "pause":
        case "resume":
          if (!live) throw new AppError("CONFLICT", "The quiz isn't live.");
          await tx.exec(
            sql`UPDATE public.quizzes SET paused = ${data.action === "pause"} WHERE id = ${id}`,
          );
          break;
        case "next":
          if (!live) throw new AppError("CONFLICT", "The quiz isn't live.");
          if (q.skip_signal + 1 >= count)
            await tx.exec(
              sql`UPDATE public.quizzes SET skip_signal = skip_signal + 1, status = 'ended' WHERE id = ${id}`,
            );
          else
            await tx.exec(
              sql`UPDATE public.quizzes SET skip_signal = skip_signal + 1 WHERE id = ${id}`,
            );
          break;
        case "extend15":
        case "extend30":
          if (!live) throw new AppError("CONFLICT", "The quiz isn't live.");
          await tx.exec(
            sql`UPDATE public.quizzes SET extend_seconds = ${data.action === "extend15" ? 15 : 30}, extend_signal = extend_signal + 1 WHERE id = ${id}`,
          );
          break;
        case "reveal_on":
        case "reveal_off":
          await tx.exec(
            sql`UPDATE public.quizzes SET reveal_answers = ${data.action === "reveal_on"} WHERE id = ${id}`,
          );
          break;
      }
    });
    return { ok: true };
  });

/** Optional answer window for "anytime" quizzes pushed to a class. */
export const setQuizWindow = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      quizId: uuid,
      opensAt: z.string().datetime().nullable(),
      closesAt: z.string().datetime().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(
        sql`UPDATE public.quizzes SET opens_at = ${data.opensAt}, closes_at = ${data.closesAt} WHERE id = ${data.quizId} AND tutor_id = ${context.actor.userId}`,
      ),
    );
    return { ok: true };
  });

export const listParticipants = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(quizIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{
        id: string;
        name: string;
        phone: string;
        score: number;
        total_time_ms: number;
        finished_at: string | null;
      }>(
        sql`SELECT p.id, p.name, p.phone, p.score, p.total_time_ms, p.finished_at
            FROM public.participants p JOIN public.quizzes z ON z.id = p.quiz_id
            WHERE p.quiz_id = ${data.quizId} AND z.tutor_id = ${context.actor.userId}
            ORDER BY p.score DESC, p.total_time_ms ASC`,
      ),
    );
  });

export const removeParticipant = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`DELETE FROM public.participants WHERE id = ${data.id}`),
    );
    return { ok: true };
  });

export const getQuestionStats = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(quizIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{
        question_id: string;
        order_index: number;
        prompt: string;
        correct_answer: string;
        answered: number;
        correct: number;
        accuracy: number;
        avg_time_ms: number;
      }>(sql`SELECT * FROM public.question_stats(${data.quizId})`),
    );
  });

export const getStudentProgress = createServerFn({ method: "GET" })
  .middleware([tutor])
  .handler(async ({ context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{
        name: string;
        phone: string;
        sessions: number;
        total_score: number;
        avg_score: number;
        avg_time_ms: number;
        last_played: string;
      }>(sql`SELECT * FROM public.tutor_student_progress()`),
    );
  });

/** IDs only — never responses or contact details — so the projector view can show answered counts. */
export const getPresentationAnswers = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(quizIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{ question_id: string; participant_id: string }>(
        sql`SELECT a.question_id, a.participant_id FROM public.answers a
            JOIN public.questions q ON q.id = a.question_id JOIN public.quizzes z ON z.id = q.quiz_id
            WHERE q.quiz_id = ${data.quizId} AND z.tutor_id = ${context.actor.userId} LIMIT 100000`,
      ),
    );
  });
