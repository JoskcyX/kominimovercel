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
    const { withDb, sql, assertMemoryRate, STUDENT_CONSENT_TAG, signCapability, MEMBER_TOKEN_TTL } =
      await K();
    // In-memory per instance — see joinQuiz. Capacity and flood caps are enforced in SQL.
    assertMemoryRate(
      `join-class:${context.ipHash}`,
      600,
      3000,
      "Too many people are joining from this network. Please wait a moment.",
    );
    const row = await withDb({}, (tx) =>
      tx.one<{ member_id: string; status: MemberStatus }>(
        sql`SELECT * FROM public.request_class_join(${data.classId}, ${data.name}, ${data.identifier}, ${STUDENT_CONSENT_TAG})`,
      ),
    );
    return {
      memberId: row!.member_id,
      status: row!.status,
      token: await signCapability("member", row!.member_id, MEMBER_TOKEN_TTL),
    };
  });

type Snapshot = {
  class_id: string;
  live: boolean;
  rep: string | null;
  /** member id → [status, name] for the whole class */
  members: Record<string, [MemberStatus, string]>;
  resources: {
    id: string;
    title: string;
    kind: "link" | "note" | "video" | "document";
    url: string | null;
    body: string;
    order_index: number;
  }[];
  quizzes: {
    quiz_id: string;
    title: string;
    join_code: string;
    mode: "pop" | "async";
    pushed_at: string | null;
    quiz_status: "draft" | "lobby" | "live" | "ended";
    opens_at: string | null;
    closes_at: string | null;
  }[];
  presentation: { resource_id: string; title: string | null; page: number } | null;
};

class NotAMember extends Error {}
/** A member always belongs to the same class, so this can be remembered for good. */
const classOfMember = new Map<string, string>();

async function loadSnapshot(memberId: string): Promise<Snapshot> {
  const { withDb, sql } = await K();
  const snap = await withDb({}, (tx) =>
    tx.scalar<Snapshot | null>(sql`SELECT public.class_snapshot(${memberId})`),
  );
  if (!snap) throw new NotAMember();
  return snap;
}

/**
 * Everything the student's class page needs. The whole class is read in ONE query and shared for
 * ~1.5 s, so 1,000 students polling cost one database query — not 1,000. Each student is then
 * answered from memory (their own status comes from the shared membership map). `null` means this
 * student's membership is gone.
 */
export const getMemberHome = createServerFn({ method: "GET" })
  .middleware([anonymous])
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { cached } = await K();
    const memberId = await member(data.token);
    // A member never changes class, so remember which one. The FIRST poll from a student only does a
    // tiny lookup — it must not load the whole class snapshot, or 1,000 students arriving together
    // would each pull 68 KB at once (a thundering herd). Everyone then shares one cached snapshot.
    let classId = classOfMember.get(memberId);
    if (!classId) {
      const { withDb, sql } = await K();
      const row = await withDb({}, (tx) =>
        tx.one<{ class_id: string }>(sql`SELECT class_id FROM public.member_live(${memberId})`),
      );
      if (!row) return null;
      classId = row.class_id;
      classOfMember.set(memberId, classId);
      if (classOfMember.size > 50_000) classOfMember.clear();
    }
    let snap: Snapshot;
    try {
      snap = await cached(`class:snapshot:${classId}`, 1500, () => loadSnapshot(memberId));
    } catch (e) {
      if (!(e instanceof NotAMember)) throw e;
      // The shared load was started by a student who has since been removed — ask for this one directly.
      try {
        snap = await loadSnapshot(memberId);
      } catch (e2) {
        if (e2 instanceof NotAMember) return null;
        throw e2;
      }
    }
    const me = snap.members[memberId];
    if (!me) return null; // removed from the class
    const [status, name] = me;
    const approved = status === "approved";
    return {
      memberId,
      membership: { class_id: snap.class_id, name, status },
      live: approved && snap.live,
      isRep: approved && snap.rep === memberId,
      resources: approved ? snap.resources : [],
      quizzes: approved ? snap.quizzes : [],
      presentation: approved ? snap.presentation : null,
    };
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
    const { withDb, sql, assertMemoryRate } = await K();
    const memberId = await member(data.token);
    assertMemoryRate(`beat:${memberId}`, 60, 30); // in memory: no database write just to count a heartbeat
    await withDb({}, (tx) =>
      tx.exec(sql`SELECT public.live_heartbeat(${memberId}, ${data.present})`),
    );
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
