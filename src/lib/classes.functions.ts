import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { tutor } from "@/lib/middleware";
import { safeUrl, uuid } from "@/lib/validation";
import type {
  AttendanceRow,
  ClassRow,
  LinkedQuiz,
  MemberRow,
  RepActionRow,
  ResourceRow,
  RosterRow,
  SessionRow,
} from "@/lib/types";

/** Tutor-side class API. Ownership is checked in SQL (tutor_id = caller) AND by Row Level Security. */
const K = () => import("@/server/kit");
const classIdInput = z.object({ classId: uuid });
const MEMBER_COLS =
  "id, class_id, name, phone, status, joined_at, last_seen_at, left_at, present_seconds";

export const listClasses = createServerFn({ method: "GET" })
  .middleware([tutor])
  .handler(async ({ context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{ id: string; title: string; subject: string; join_code: string }>(
        sql`SELECT id, title, subject, join_code FROM public.classes WHERE tutor_id = ${context.actor.userId} ORDER BY created_at DESC`,
      ),
    );
  });

export const createClass = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ title: z.string().trim().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, withUniqueCode, makeCode, tierFor, enforcing } = await K();
    const limit = tierFor(context.actor.plan).maxStudentsPerClass;
    // With enforcement off, new classes get the Pro size so nobody is capped while payments aren't live.
    const memberLimit = enforcing() ? limit : tierFor("pro").maxStudentsPerClass;
    return withDb({ userId: context.actor.userId }, (tx) =>
      withUniqueCode(
        () => makeCode(6),
        async (code) => {
          await tx.exec(sql`SAVEPOINT code_try`);
          try {
            const row = await tx.one<{ id: string }>(
              sql`INSERT INTO public.classes (tutor_id, title, join_code, member_limit) VALUES (${context.actor.userId}, ${data.title}, ${code}, ${memberLimit}) RETURNING id`,
            );
            return { id: row!.id };
          } catch (e) {
            await tx.exec(sql`ROLLBACK TO SAVEPOINT code_try`);
            throw e;
          }
        },
      ),
    );
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    const { deleteObject } = await import("@/server/storage");
    const { storageConfigured } = await import("@/server/env");
    const keys = await withDb({ userId: context.actor.userId }, async (tx) => {
      const k = (
        await tx.all<{ url: string }>(
          sql`SELECT r.url FROM public.class_resources r JOIN public.classes c ON c.id = r.class_id WHERE c.id = ${data.classId} AND c.tutor_id = ${context.actor.userId} AND r.url LIKE 'storage:%'`,
        )
      ).map((r) => r.url.slice(8));
      await tx.exec(
        sql`DELETE FROM public.classes WHERE id = ${data.classId} AND tutor_id = ${context.actor.userId}`,
      );
      return k;
    });
    if (storageConfigured()) await Promise.all(keys.map((k) => deleteObject(k)));
    return { ok: true };
  });

export const getClass = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    const row = await withDb({ userId: context.actor.userId }, (tx) =>
      tx.one<ClassRow>(
        sql`SELECT * FROM public.classes WHERE id = ${data.classId} AND tutor_id = ${context.actor.userId}`,
      ),
    );
    if (!row) throw new AppError("NOT_FOUND", "We couldn't find that class.");
    return row;
  });

export const updateClassSettings = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      classId: uuid,
      admit_mode: z.enum(["manual", "roster", "auto"]).optional(),
      id_label: z.enum(["phone", "matric"]).optional(),
      attendance_threshold: z.number().int().min(1).max(100).optional(),
      title: z.string().trim().min(1).max(120).optional(),
      subject: z.string().trim().max(120).optional(),
      description: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql, setClause } = await K();
    const { classId, ...patch } = data;
    const set = setClause(patch, [
      "admit_mode",
      "id_label",
      "attendance_threshold",
      "title",
      "subject",
      "description",
    ]);
    if (set)
      await withDb({ userId: context.actor.userId }, (tx) =>
        tx.exec(
          sql`UPDATE public.classes SET ${set} WHERE id = ${classId} AND tutor_id = ${context.actor.userId}`,
        ),
      );
    return { ok: true };
  });

/* ── Students ───────────────────────────────────────────────────────────────────────────── */
export const listMembers = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql, rawSql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<MemberRow>(sql`SELECT ${rawSql(
        MEMBER_COLS.split(", ")
          .map((c) => `m.${c}`)
          .join(", "),
      )} FROM public.class_members m
        JOIN public.classes c ON c.id = m.class_id WHERE m.class_id = ${data.classId} AND c.tutor_id = ${context.actor.userId} ORDER BY m.joined_at DESC`),
    );
  });

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid, status: z.enum(["approved", "rejected"]) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(
        sql`UPDATE public.class_members SET status = ${data.status}::public.class_member_status WHERE id = ${data.id}`,
      ),
    );
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`DELETE FROM public.class_members WHERE id = ${data.id}`),
    );
    return { ok: true };
  });

/** Lets in everyone waiting, up to the plan's class size. Returns how many got in and how many wait. */
export const admitAll = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, async (tx) => {
      const admitted = Number(
        (await tx.scalar(sql`SELECT public.admit_pending(${data.classId})`)) ?? 0,
      );
      const waiting = Number(
        (await tx.scalar(
          sql`SELECT count(*) FROM public.class_members WHERE class_id = ${data.classId} AND status = 'pending'`,
        )) ?? 0,
      );
      return { admitted, waiting };
    });
  });

/* ── Expected-students list ─────────────────────────────────────────────────────────────── */
export const listRoster = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<RosterRow>(
        sql`SELECT r.* FROM public.class_roster r JOIN public.classes c ON c.id = r.class_id WHERE r.class_id = ${data.classId} AND c.tutor_id = ${context.actor.userId} ORDER BY r.created_at`,
      ),
    );
  });

export const addRoster = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      classId: uuid,
      identifiers: z.array(z.string().trim().min(1).max(120)).min(1).max(1000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    const unique = [...new Set(data.identifiers)];
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(
        sql`INSERT INTO public.class_roster (class_id, identifier) SELECT ${data.classId}, x FROM unnest(${unique}::text[]) AS x ON CONFLICT (class_id, identifier) DO NOTHING`,
      ),
    );
    return { ok: true };
  });

export const deleteRoster = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`DELETE FROM public.class_roster WHERE id = ${data.id}`),
    );
    return { ok: true };
  });

/* ── Quizzes inside a class ─────────────────────────────────────────────────────────────── */
export const listClassQuizzes = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    const rows = await withDb({ userId: context.actor.userId }, (tx) =>
      tx.all(sql`SELECT cq.id, cq.mode, cq.pushed_at, cq.quiz_id, q.title, q.join_code, q.status, q.opens_at, q.closes_at, q.id AS qid
        FROM public.class_quizzes cq JOIN public.quizzes q ON q.id = cq.quiz_id JOIN public.classes c ON c.id = cq.class_id
        WHERE cq.class_id = ${data.classId} AND c.tutor_id = ${context.actor.userId} ORDER BY cq.created_at DESC`),
    );
    return rows.map((r) => ({
      id: r["id"],
      mode: r["mode"],
      pushed_at: r["pushed_at"],
      quiz_id: r["quiz_id"],
      quizzes: {
        id: r["qid"],
        title: r["title"],
        join_code: r["join_code"],
        status: r["status"],
        opens_at: r["opens_at"],
        closes_at: r["closes_at"],
      },
    })) as LinkedQuiz[];
  });

export const publishAsyncQuiz = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      classId: uuid,
      quizId: uuid,
      opensAt: z.string().datetime().nullable(),
      closesAt: z.string().datetime().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    await withDb({ userId: context.actor.userId }, async (tx) => {
      const ok = await tx.scalar(
        sql`SELECT 1 FROM public.quizzes z, public.classes c WHERE z.id = ${data.quizId} AND z.tutor_id = ${context.actor.userId} AND c.id = ${data.classId} AND c.tutor_id = ${context.actor.userId}`,
      );
      if (!ok) throw new AppError("NOT_FOUND", "We couldn't find that quiz or class.");
      await tx.exec(
        sql`UPDATE public.quizzes SET opens_at = ${data.opensAt}, closes_at = ${data.closesAt}, status = 'live' WHERE id = ${data.quizId}`,
      );
      await tx.exec(sql`INSERT INTO public.class_quizzes (class_id, quiz_id, mode) VALUES (${data.classId}, ${data.quizId}, 'async')
                        ON CONFLICT (class_id, quiz_id) DO UPDATE SET mode = 'async'`);
    });
    return { ok: true };
  });

export const pushPopQuiz = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ classId: uuid, quizId: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`SELECT public.push_class_quiz(${data.classId}, ${data.quizId})`),
    );
    return { ok: true };
  });

/* ── Class rep ──────────────────────────────────────────────────────────────────────────── */
export const setClassRep = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ classId: uuid, memberId: uuid.nullable() }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    await withDb({ userId: context.actor.userId }, async (tx) => {
      if (data.memberId) {
        const ok = await tx.scalar(
          sql`SELECT 1 FROM public.class_members WHERE id = ${data.memberId} AND class_id = ${data.classId} AND status = 'approved'`,
        );
        if (!ok)
          throw new AppError("INVALID", "The class rep must be an approved student in this class.");
      }
      await tx.exec(
        sql`UPDATE public.classes SET rep_member_id = ${data.memberId} WHERE id = ${data.classId} AND tutor_id = ${context.actor.userId}`,
      );
    });
    return { ok: true };
  });

export const listRepActions = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<RepActionRow>(
        sql`SELECT a.* FROM public.class_rep_actions a JOIN public.classes c ON c.id = a.class_id WHERE a.class_id = ${data.classId} AND c.tutor_id = ${context.actor.userId} ORDER BY a.created_at DESC LIMIT 50`,
      ),
    );
  });

/* ── Materials ──────────────────────────────────────────────────────────────────────────── */
export const listResources = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<ResourceRow>(
        sql`SELECT r.* FROM public.class_resources r JOIN public.classes c ON c.id = r.class_id WHERE r.class_id = ${data.classId} AND c.tutor_id = ${context.actor.userId} ORDER BY r.order_index, r.created_at`,
      ),
    );
  });

/** Links and notes. (Uploaded files go through files.functions.ts so their bytes are verified first.) */
export const addResource = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      classId: uuid,
      title: z.string().trim().max(200),
      kind: z.enum(["link", "note", "video", "document"]),
      url: safeUrl().nullable(),
      body: z.string().trim().max(20000),
      visible: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    await withDb({ userId: context.actor.userId }, async (tx) => {
      const owns = await tx.scalar(
        sql`SELECT 1 FROM public.classes WHERE id = ${data.classId} AND tutor_id = ${context.actor.userId}`,
      );
      if (!owns) throw new AppError("NOT_FOUND", "We couldn't find that class.");
      const order = Number(
        (await tx.scalar(
          sql`SELECT count(*) FROM public.class_resources WHERE class_id = ${data.classId}`,
        )) ?? 0,
      );
      await tx.exec(sql`INSERT INTO public.class_resources (class_id, title, kind, url, body, order_index, visible)
                        VALUES (${data.classId}, ${data.title || "Untitled"}, ${data.kind}::public.class_resource_kind, ${data.url}, ${data.body}, ${order}, ${data.visible})`);
    });
    return { ok: true };
  });

export const setResourceVisible = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid, visible: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(
        sql`UPDATE public.class_resources SET visible = ${data.visible} WHERE id = ${data.id}`,
      ),
    );
    return { ok: true };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    const { deleteObject } = await import("@/server/storage");
    const { storageConfigured } = await import("@/server/env");
    const url = await withDb({ userId: context.actor.userId }, async (tx) => {
      const u = await tx.scalar<string>(
        sql`SELECT url FROM public.class_resources WHERE id = ${data.id}`,
      );
      await tx.exec(sql`DELETE FROM public.class_resources WHERE id = ${data.id}`);
      return u;
    });
    if (url?.startsWith("storage:") && storageConfigured()) await deleteObject(url.slice(8));
    return { ok: true };
  });

export const presentResource = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      classId: uuid,
      resourceId: uuid.nullable(),
      page: z.number().int().min(1).max(5000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(
        sql`UPDATE public.classes SET presenting_resource_id = ${data.resourceId}, presenting_page = ${data.page} WHERE id = ${data.classId} AND tutor_id = ${context.actor.userId}`,
      ),
    );
    return { ok: true };
  });

/* ── Attendance history ─────────────────────────────────────────────────────────────────── */
export const listSessions = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(classIdInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<SessionRow>(
        sql`SELECT s.* FROM public.class_sessions s JOIN public.classes c ON c.id = s.class_id WHERE s.class_id = ${data.classId} AND c.tutor_id = ${context.actor.userId} ORDER BY s.started_at DESC`,
      ),
    );
  });

export const getSessionAttendance = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(z.object({ sessionId: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<AttendanceRow>(
        sql`SELECT a.* FROM public.class_session_attendance a JOIN public.class_sessions s ON s.id = a.session_id JOIN public.classes c ON c.id = s.class_id WHERE a.session_id = ${data.sessionId} AND c.tutor_id = ${context.actor.userId} ORDER BY a.name`,
      ),
    );
  });
