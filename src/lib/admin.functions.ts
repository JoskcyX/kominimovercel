import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { admin } from "@/lib/middleware";
import { uuid } from "@/lib/validation";

/**
 * Admin API — the foundation for a future admin dashboard.
 *
 * HOW TO ADD A NEW ADMIN FEATURE (see docs/ADMIN.md):
 *   1. Add a SECURITY DEFINER SQL function that begins with `PERFORM app.require_admin();`
 *      (and writes an audit_log row if it changes anything).
 *   2. Expose it here with `.middleware([admin])`.
 *   3. Add a UI route under src/routes/_authenticated/admin/.
 * Both the middleware AND the SQL function check the role, so a mistake in one can't open a hole.
 */
const K = () => import("@/server/kit");

export const adminStats = createServerFn({ method: "GET" })
  .middleware([admin])
  .handler(async ({ context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.one<{
        users: number;
        pro_users: number;
        suspended_users: number;
        classes: number;
        quizzes: number;
        courses: number;
        live_now: number;
        open_messages: number;
        signups_7d: number;
      }>(sql`SELECT * FROM public.admin_stats()`),
    );
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([admin])
  .inputValidator(
    z.object({
      q: z.string().max(100).default(""),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{
        id: string;
        display_name: string;
        email: string | null;
        plan: string;
        status: string;
        created_at: string;
        roles: string[];
        classes: number;
        quizzes: number;
      }>(sql`SELECT * FROM public.admin_list_users(${data.q}, ${data.limit}, ${data.offset})`),
    );
  });

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator(z.object({ userId: uuid, status: z.enum(["active", "suspended"]) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`SELECT public.admin_set_user_status(${data.userId}, ${data.status})`),
    );
    return { ok: true };
  });

export const adminSetUserPlan = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator(z.object({ userId: uuid, plan: z.enum(["free", "pro"]) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, tierFor } = await K();
    const limit = tierFor(data.plan).maxStudentsPerClass;
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`SELECT public.admin_set_user_plan(${data.userId}, ${data.plan}, ${limit})`),
    );
    return { ok: true };
  });

export const adminListContact = createServerFn({ method: "GET" })
  .middleware([admin])
  .inputValidator(
    z.object({ status: z.enum(["new", "read", "resolved", "spam"]).nullable().default(null) }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    return withDb({ userId: context.actor.userId }, (tx) =>
      tx.all<{
        id: string;
        name: string;
        email: string;
        topic: string;
        message: string;
        status: string;
        created_at: string;
      }>(sql`SELECT * FROM public.admin_list_contact(${data.status}, 100)`),
    );
  });

export const adminMarkContact = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator(z.object({ id: uuid, status: z.enum(["new", "read", "resolved", "spam"]) }))
  .handler(async ({ data, context }) => {
    const { withDb, sql } = await K();
    await withDb({ userId: context.actor.userId }, (tx) =>
      tx.exec(sql`SELECT public.admin_mark_contact(${data.id}, ${data.status})`),
    );
    return { ok: true };
  });
