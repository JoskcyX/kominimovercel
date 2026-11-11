import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { anonymous, authed, tutor } from "@/lib/middleware";
import { contactInput } from "@/lib/validation";

const K = () => import("@/server/kit");

/** Who am I, what plan am I on, and do I still need to accept the current legal documents? */
export const getMe = createServerFn({ method: "GET" })
  .middleware([authed])
  .handler(async ({ context }) => {
    const { withDb, sql } = await K();
    const a = context.actor;
    const referredBy = await withDb({ userId: a.userId }, (tx) =>
      tx.scalar<string>(sql`SELECT referred_by FROM public.profiles WHERE id = ${a.userId}`),
    );
    return {
      userId: a.userId,
      email: a.email,
      displayName: a.displayName,
      plan: a.plan,
      status: a.status,
      roles: a.roles,
      isAdmin: a.roles.includes("admin"),
      referralCode: a.referralCode,
      referredBy,
      legalOk: a.legalOk,
    };
  });

/** The server decides WHICH versions are accepted (the current ones) — the browser can't pick. */
export const acceptLegal = createServerFn({ method: "POST" })
  .middleware([authed])
  .handler(async ({ context }) => {
    const { withDb, sql, LEGAL_VERSIONS } = await K();
    const { userAgent } = await import("@/server/request");
    await withDb({ userId: context.actor.userId }, async (tx) => {
      await tx.exec(
        sql`SELECT app.accept_legal(${LEGAL_VERSIONS.terms}, ${LEGAL_VERSIONS.privacy}, ${context.actor.ipHash}, ${userAgent()})`,
      );
      await tx.exec(sql`INSERT INTO public.audit_log (actor_id, action, target_type, target_id, meta, ip_hash)
        VALUES (${context.actor.userId}, 'legal.accepted', 'user', ${context.actor.userId}, ${JSON.stringify(LEGAL_VERSIONS)}::jsonb, ${context.actor.ipHash})`);
    });
    return { ok: true };
  });

export const attributeReferral = createServerFn({ method: "POST" })
  .middleware([authed])
  .inputValidator(
    z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9-]{3,60}$/),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    const ok = await withDb({ userId: context.actor.userId }, (tx) =>
      tx.scalar<boolean>(sql`SELECT public.attribute_referral(${data.code})`),
    );
    return { attributed: Boolean(ok) };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([authed])
  .inputValidator(z.object({ name: z.string().trim().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`SELECT app.set_display_name(${data.name})`),
    );
    return { ok: true };
  });

export const getReferralSummary = createServerFn({ method: "GET" })
  .middleware([tutor])
  .handler(async ({ context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.one<{
        referral_code: string;
        total_referred: number;
        pro_referred: number;
        earnings_pending_cents: number;
        earnings_paid_cents: number;
      }>(sql`SELECT * FROM public.my_referral_summary()`),
    );
  });

export const getReferralList = createServerFn({ method: "GET" })
  .middleware([tutor])
  .handler(async ({ context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{ display_name: string; plan: string; joined_at: string; earnings_cents: number }>(
        sql`SELECT * FROM public.my_referral_list()`,
      ),
    );
  });

/* ── Your data, your rights (access/portability and erasure) ─────────────────────────────── */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([authed])
  .handler(async ({ context }) => {
    const { withDb, sql, rateLimit } = await K();
    const uid = context.actor.userId;
    return withDb({ userId: uid }, async (tx) => {
      await rateLimit(
        tx,
        `export:${uid}`,
        3600,
        5,
        "You can export your data a few times per hour. Please try again later.",
      );
      const own = <T>(q: ReturnType<typeof sql>) => tx.all<T>(q);
      const data = {
        exported_at: new Date().toISOString(),
        account: await tx.one(
          sql`SELECT id, display_name, email, plan, status, referral_code, created_at FROM public.profiles WHERE id = ${uid}`,
        ),
        legal_acceptances: await own(
          sql`SELECT doc, version, accepted_at FROM public.legal_acceptances WHERE user_id = ${uid} ORDER BY accepted_at`,
        ),
        quizzes: await own(
          sql`SELECT id, title, join_code, status, created_at FROM public.quizzes WHERE tutor_id = ${uid}`,
        ),
        questions: await own(
          sql`SELECT q.* FROM public.questions q JOIN public.quizzes z ON z.id = q.quiz_id WHERE z.tutor_id = ${uid}`,
        ),
        quiz_participants: await own(
          sql`SELECT p.id, p.quiz_id, p.name, p.phone, p.score, p.total_time_ms, p.joined_at FROM public.participants p JOIN public.quizzes z ON z.id = p.quiz_id WHERE z.tutor_id = ${uid}`,
        ),
        classes: await own(
          sql`SELECT id, title, subject, description, join_code, admit_mode, attendance_threshold, created_at FROM public.classes WHERE tutor_id = ${uid}`,
        ),
        class_members: await own(
          sql`SELECT m.id, m.class_id, m.name, m.phone, m.status, m.joined_at FROM public.class_members m JOIN public.classes c ON c.id = m.class_id WHERE c.tutor_id = ${uid}`,
        ),
        class_sessions: await own(
          sql`SELECT s.* FROM public.class_sessions s JOIN public.classes c ON c.id = s.class_id WHERE c.tutor_id = ${uid}`,
        ),
        attendance: await own(
          sql`SELECT a.* FROM public.class_session_attendance a JOIN public.class_sessions s ON s.id = a.session_id JOIN public.classes c ON c.id = s.class_id WHERE c.tutor_id = ${uid}`,
        ),
        courses: await own(
          sql`SELECT id, title, slug, summary, price_cents, currency, is_published, created_at FROM public.courses WHERE tutor_id = ${uid}`,
        ),
        lessons: await own(
          sql`SELECT l.* FROM public.lessons l JOIN public.courses c ON c.id = l.course_id WHERE c.tutor_id = ${uid}`,
        ),
        enrollments: await own(
          sql`SELECT course_id, status, created_at FROM public.enrollments WHERE student_id = ${uid}`,
        ),
      };
      await tx.exec(
        sql`INSERT INTO public.audit_log (actor_id, action, target_type, target_id, ip_hash) VALUES (${uid}, 'account.exported', 'user', ${uid}, ${context.actor.ipHash})`,
      );
      return { json: JSON.stringify(data, null, 2) };
    });
  });

/** Permanently deletes the tutor's profile and everything they own, plus their stored files. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authed])
  .inputValidator(z.object({ confirm: z.literal("DELETE") }))
  .handler(async ({ context }) => {
    const { withDb, sql, rateLimit } = await K();
    const { deleteObject } = await import("@/server/storage");
    const { storageConfigured } = await import("@/server/env");
    const uid = context.actor.userId;
    const keys = await withDb({ userId: uid }, async (tx) => {
      await rateLimit(tx, `erase:${uid}`, 3600, 3);
      return (
        await tx.all<{ url: string }>(
          sql`SELECT r.url FROM public.class_resources r JOIN public.classes c ON c.id = r.class_id WHERE c.tutor_id = ${uid} AND r.url LIKE 'storage:%'`,
        )
      ).map((r) => r.url.slice(8));
    });
    await withDb({ userId: uid }, (tx) => tx.exec(sql`SELECT public.erase_my_account()`));
    if (storageConfigured()) await Promise.all(keys.map((k) => deleteObject(k)));
    return { ok: true };
  });

/* ── Contact form (public) ───────────────────────────────────────────────────────────────── */
export const submitContact = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(contactInput)
  .handler(async ({ data, context }) => {
    // Honeypot filled in → pretend success so bots learn nothing.
    if (data.website) return { ok: true };
    const { withDb, sql, rateLimit, LIMITS } = await K();
    await withDb({}, async (tx) => {
      await rateLimit(
        tx,
        `contact:${context.ipHash}`,
        LIMITS.contact.windowSeconds,
        LIMITS.contact.max,
        "You've sent a few messages already. Please try again later.",
      );
      await tx.exec(
        sql`SELECT public.submit_contact(${data.name}, ${data.email}, ${data.topic}, ${data.message}, ${context.ipHash})`,
      );
    });
    return { ok: true };
  });
