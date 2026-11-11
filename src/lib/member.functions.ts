import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { anonymous } from "@/lib/middleware";
import { identifier, joinCode, personName, uuid } from "@/lib/validation";
import type { MemberStatus } from "@/lib/types";

/**
 * Student-side class API (no account). The class code is public; control of a membership needs
 * the signed MEMBER token handed out when the student joined.
 */
const K = () => import("@/server/kit");
const tokenInput = z.object({ token: z.string().min(20).max(400) });
async function member(token: string) {
  return (await K()).verifyCapability("member", token);
}

export const getClassPublic = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(z.object({ code: joinCode }))
  .handler(async ({ data }) => {
    const { cached, withDb, sql } = await K();
    return cached(`class:${data.code}`, 5000, () =>
      withDb({}, (tx) =>
        tx.one<{
          id: string;
          title: string;
          subject: string;
          description: string;
          id_label: "phone" | "matric";
        }>(sql`SELECT * FROM public.get_class_by_code(${data.code})`),
      ),
    );
  });

export const requestJoin = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(
    z.object({
      classId: uuid,
      name: personName,
      identifier,
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
      MEMBER_TOKEN_TTL,
    } = await K();
    const row = await withDb({}, async (tx) => {
      await rateLimit(
        tx,
        `join-class:${context.ipHash}`,
        LIMITS.join.windowSeconds,
        LIMITS.join.max,
      );
      return tx.one<{ member_id: string; status: MemberStatus }>(
        sql`SELECT * FROM public.request_class_join(${data.classId}, ${data.name}, ${data.identifier}, ${STUDENT_CONSENT_TAG})`,
      );
    });
    return {
      memberId: row!.member_id,
      status: row!.status,
      token: await signCapability("member", row!.member_id, MEMBER_TOKEN_TTL),
    };
  });

/** Everything the student's class page needs, in one round trip. `null` means the membership is gone. */
export const getMemberHome = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const memberId = await member(data.token);
    return withDb({}, async (tx) => {
      const m = await tx.one<{ class_id: string; name: string; status: MemberStatus }>(
        sql`SELECT * FROM public.get_class_membership(${memberId})`,
      );
      if (!m) return null;
      const approved = m.status === "approved";
      const live = approved
        ? await tx.one<{ live_room_name: string | null; is_rep: boolean }>(
            sql`SELECT live_room_name, is_rep FROM public.member_live(${memberId})`,
          )
        : null;
      return {
        memberId,
        membership: m,
        live: Boolean(live?.live_room_name),
        isRep: Boolean(live?.is_rep),
        resources: approved
          ? await tx.all<{
              id: string;
              title: string;
              kind: "link" | "note" | "video" | "document";
              url: string | null;
              body: string;
              order_index: number;
            }>(sql`SELECT * FROM public.get_class_resources(${memberId})`)
          : [],
        quizzes: approved
          ? await tx.all<{
              quiz_id: string;
              title: string;
              join_code: string;
              mode: "pop" | "async";
              pushed_at: string | null;
              quiz_status: "draft" | "lobby" | "live" | "ended";
              opens_at: string | null;
              closes_at: string | null;
            }>(sql`SELECT * FROM public.get_class_quizzes(${memberId})`)
          : [],
      };
    });
  });

export const getPresentation = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const memberId = await member(data.token);
    return withDb({}, (tx) =>
      tx.one<{ resource_id: string; title: string | null; page: number }>(
        sql`SELECT * FROM public.get_class_presentation(${memberId})`,
      ),
    );
  });

export const getMemberFileUrl = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(tokenInput.extend({ resourceId: uuid }))
  .handler(async ({ data }) => {
    const { withDb, sql, AppError } = await K();
    const { presignGet } = await import("@/server/storage");
    const memberId = await member(data.token);
    const key = await withDb({}, (tx) =>
      tx.scalar<string>(sql`SELECT public.class_file_key(${memberId}, ${data.resourceId})`),
    );
    if (!key) throw new AppError("NOT_FOUND", "That file isn't available.");
    return { url: await presignGet(key) };
  });

/** Attendance heartbeat (about every 15 s while the student is in the live room). */
export const heartbeat = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(tokenInput.extend({ present: z.boolean() }))
  .handler(async ({ data }) => {
    const { withDb, sql, rateLimit } = await K();
    const memberId = await member(data.token);
    await withDb({}, async (tx) => {
      await rateLimit(tx, `beat:${memberId}`, 60, 20);
      await tx.exec(sql`SELECT public.live_heartbeat(${memberId}, ${data.present})`);
    });
    return { ok: true };
  });

/* ── Class rep ─────────────────────────────────────────────────────────────────────────── */
export const repGetMembers = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const repId = await member(data.token);
    return withDb({}, async (tx) => {
      const cid = await tx.scalar<string>(sql`SELECT public.rep_class_id(${repId})`);
      if (!cid) return null;
      return tx.all<{
        id: string;
        name: string;
        phone: string;
        status: MemberStatus;
        last_seen_at: string | null;
        left_at: string | null;
        joined_at: string;
      }>(sql`SELECT * FROM public.rep_members(${repId})`);
    });
  });

export const repSetStatus = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(tokenInput.extend({ memberId: uuid, status: z.enum(["approved", "rejected"]) }))
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const repId = await member(data.token);
    await withDb({}, (tx) =>
      tx.exec(
        sql`SELECT public.rep_set_member_status(${repId}, ${data.memberId}, ${data.status}::public.class_member_status)`,
      ),
    );
    return { ok: true };
  });

export const repRemove = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(tokenInput.extend({ memberId: uuid }))
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const repId = await member(data.token);
    await withDb({}, (tx) =>
      tx.exec(sql`SELECT public.rep_remove_member(${repId}, ${data.memberId})`),
    );
    return { ok: true };
  });

export const repLog = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(
    tokenInput.extend({ action: z.enum(["muted", "muted everyone"]), target: z.string().max(80) }),
  )
  .handler(async ({ data }) => {
    const { withDb, sql } = await K();
    const repId = await member(data.token);
    await withDb({}, (tx) =>
      tx.exec(sql`SELECT public.rep_log_action(${repId}, ${data.action}, ${data.target})`),
    );
    return { ok: true };
  });
