import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalAuthed, tutor, anonymous } from "@/lib/middleware";
import { safeUrl, uuid } from "@/lib/validation";

const K = () => import("@/server/kit");
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "course";

export type CourseCard = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  cover_url: string | null;
  price_cents: number;
  currency: string;
};
export type LessonRow = {
  id: string;
  course_id: string;
  order_index: number;
  title: string;
  kind: "video" | "text";
  video_url: string | null;
  body: string;
  locked?: boolean;
};

/* ── Public catalogue ───────────────────────────────────────────────────────────────────── */
export const listPublishedCourses = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .handler(async () => {
    const { cached, withDb, sql } = await K();
    return cached("courses:published", 10_000, () =>
      withDb({}, (tx) =>
        tx.all<CourseCard>(
          sql`SELECT id, title, slug, summary, cover_url, price_cents, currency FROM public.courses WHERE is_published ORDER BY created_at DESC`,
        ),
      ),
    );
  });

/** Course page for a visitor or a signed-in learner. Paid lessons arrive WITHOUT content until enrolled. */
export const getCourseBySlug = createServerFn({ method: "GET" })
  .middleware([optionalAuthed])
  .inputValidator(z.object({ slug: z.string().trim().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.viewerId }, async (tx) => {
      const course = await tx.one<CourseCard & { tutor_id: string }>(
        sql`SELECT id, title, slug, summary, cover_url, price_cents, currency, tutor_id FROM public.courses WHERE slug = ${data.slug} AND (is_published OR tutor_id = ${context.viewerId})`,
      );
      if (!course) return null;
      const lessons = await tx.all<LessonRow>(
        sql`SELECT * FROM public.get_course_lessons(${course.id})`,
      );
      const enrollment = context.viewerId
        ? await tx.one<{ status: "free" | "pending" | "paid" }>(
            sql`SELECT status FROM public.enrollments WHERE course_id = ${course.id} AND student_id = ${context.viewerId}`,
          )
        : null;
      const { tutor_id, ...card } = course;
      return { course: card, lessons, enrollment, isOwner: context.viewerId === tutor_id };
    });
  });

export const enrollInCourse = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ courseId: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`SELECT public.enroll_in_course(${data.courseId})`),
    );
    return { ok: true };
  });

/* ── Tutor: manage courses ──────────────────────────────────────────────────────────────── */
export const listMyCourses = createServerFn({ method: "GET" })
  .middleware([tutor])
  .handler(async ({ context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{
        id: string;
        title: string;
        slug: string;
        price_cents: number;
        currency: string;
        is_published: boolean;
        created_at: string;
      }>(
        sql`SELECT id, title, slug, price_cents, currency, is_published, created_at FROM public.courses WHERE tutor_id = ${context.actor.userId} ORDER BY created_at DESC`,
      ),
    );
  });

export const createCourse = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ title: z.string().trim().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, withUniqueCode, makeCode } = await K();
    const base = slugify(data.title);
    let n = 0;
    return withDb({ userId: context.actor.userId }, (tx) =>
      withUniqueCode(
        () => (n++ === 0 ? base : `${base}-${makeCode(4).toLowerCase()}`),
        async (slug) => {
          await tx.exec(sql`SAVEPOINT slug_try`);
          try {
            const row = await tx.one<{ id: string }>(
              sql`INSERT INTO public.courses (tutor_id, title, slug) VALUES (${context.actor.userId}, ${data.title}, ${slug}) RETURNING id`,
            );
            return { id: row!.id };
          } catch (e) {
            await tx.exec(sql`ROLLBACK TO SAVEPOINT slug_try`);
            throw e;
          }
        },
      ),
    );
  });

export const getMyCourse = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(z.object({ courseId: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    return withDb({ userId: context.actor.userId }, async (tx) => {
      const course = await tx.one<CourseCard & { is_published: boolean }>(
        sql`SELECT id, title, slug, summary, cover_url, price_cents, currency, is_published FROM public.courses WHERE id = ${data.courseId} AND tutor_id = ${context.actor.userId}`,
      );
      if (!course) throw new AppError("NOT_FOUND", "We couldn't find that course.");
      const lessons = await tx.all<LessonRow>(
        sql`SELECT id, course_id, order_index, title, kind, video_url, body FROM public.lessons WHERE course_id = ${data.courseId} ORDER BY order_index, created_at`,
      );
      return { course, lessons };
    });
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      courseId: uuid,
      title: z.string().trim().max(120),
      summary: z.string().trim().max(2000),
      coverUrl: safeUrl().nullable(),
      priceCents: z.number().int().min(0).max(100_000_000),
      currency: z.enum(["USD", "NGN", "GBP", "EUR"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`UPDATE public.courses SET title = ${data.title || "Untitled course"}, summary = ${data.summary}, cover_url = ${data.coverUrl},
                  price_cents = ${data.priceCents}, currency = ${data.currency} WHERE id = ${data.courseId} AND tutor_id = ${context.actor.userId}`),
    );
    return { ok: true };
  });

export const setCoursePublished = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ courseId: uuid, published: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, assertWithinPlan } = await K();
    await withDb({ userId: context.actor.userId }, async (tx) => {
      if (data.published) {
        const n = Number(
          (await tx.scalar(
            sql`SELECT count(*) FROM public.courses WHERE tutor_id = ${context.actor.userId} AND is_published AND id <> ${data.courseId}`,
          )) ?? 0,
        );
        assertWithinPlan(context.actor, "maxCourses", n, "published courses");
      }
      await tx.exec(
        sql`UPDATE public.courses SET is_published = ${data.published} WHERE id = ${data.courseId} AND tutor_id = ${context.actor.userId}`,
      );
    });
    return { ok: true };
  });

export const addLesson = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      courseId: uuid,
      title: z.string().trim().min(2).max(160),
      kind: z.enum(["video", "text"]),
      videoUrl: safeUrl().nullable(),
      body: z.string().max(50000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    await withDb({ userId: context.actor.userId }, async (tx) => {
      const owns = await tx.scalar(
        sql`SELECT 1 FROM public.courses WHERE id = ${data.courseId} AND tutor_id = ${context.actor.userId}`,
      );
      if (!owns) throw new AppError("NOT_FOUND", "We couldn't find that course.");
      const next = Number(
        (await tx.scalar(
          sql`SELECT coalesce(max(order_index), 0) + 1 FROM public.lessons WHERE course_id = ${data.courseId}`,
        )) ?? 1,
      );
      await tx.exec(sql`INSERT INTO public.lessons (course_id, order_index, title, kind, video_url, body)
                        VALUES (${data.courseId}, ${next}, ${data.title}, ${data.kind}::public.lesson_kind, ${data.kind === "video" ? data.videoUrl : null}, ${data.kind === "text" ? data.body : ""})`);
    });
    return { ok: true };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`DELETE FROM public.lessons WHERE id = ${data.id}`),
    );
    return { ok: true };
  });
