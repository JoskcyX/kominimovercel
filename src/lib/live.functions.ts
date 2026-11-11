import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { anonymous, tutor } from "@/lib/middleware";
import { uuid } from "@/lib/validation";

/** Live video (Daily.co). Tutors start/end; approved students get a personal join link. */
const K = () => import("@/server/kit");
const D = () => import("@/server/daily");
const classInput = z.object({ classId: uuid });

export const startLiveClass = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(classInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError, rateLimit, LIMITS } = await K();
    const { createRoom, meetingToken } = await D();
    const uid = context.actor.userId;
    const cls = await withDb({ userId: uid }, async (tx) => {
      await rateLimit(tx, `live:${uid}`, LIMITS.liveToken.windowSeconds, LIMITS.liveToken.max);
      return tx.one<{ live_room_name: string | null; live_room_url: string | null }>(
        sql`SELECT live_room_name, live_room_url FROM public.classes WHERE id = ${data.classId} AND tutor_id = ${uid}`,
      );
    });
    if (!cls) throw new AppError("NOT_FOUND", "We couldn't find that class.");
    let { live_room_name: name, live_room_url: url } = cls;
    if (!name || !url) {
      const room = await createRoom();
      name = room.name as string;
      url = room.url as string;
      // The class-session trigger atomically records history and resets current attendance.
      await withDb({ userId: uid }, (tx) =>
        tx.exec(sql`UPDATE public.classes SET live_room_name = ${name}, live_room_url = ${url}, live_started_at = now(),
                    session_started_at = now(), session_ended_at = NULL, live_empty_since = NULL WHERE id = ${data.classId} AND tutor_id = ${uid}`),
      );
    }
    return {
      url: `${url}?t=${await meetingToken(name!, context.actor.displayName || "Tutor", true, uid)}`,
    };
  });

export const endLiveClass = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(classInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    const { daily } = await D();
    const uid = context.actor.userId;
    const room = await withDb({ userId: uid }, (tx) =>
      tx.one<{ live_room_name: string | null }>(
        sql`SELECT live_room_name FROM public.classes WHERE id = ${data.classId} AND tutor_id = ${uid}`,
      ),
    );
    if (!room) throw new AppError("NOT_FOUND", "We couldn't find that class.");
    if (room.live_room_name) await daily(`/rooms/${room.live_room_name}`, { method: "DELETE" });
    await withDb({ userId: uid }, (tx) =>
      tx.exec(
        sql`UPDATE public.classes SET live_room_name = NULL, live_room_url = NULL, live_started_at = NULL, session_ended_at = now(), live_empty_since = NULL WHERE id = ${data.classId} AND tutor_id = ${uid}`,
      ),
    );
    return { ok: true };
  });

const tokenInput = z.object({ token: z.string().min(20).max(400) });

export const getLiveStatus = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { withDb, sql, verifyCapability } = await K();
    const memberId = await verifyCapability("member", data.token);
    const m = await withDb({}, (tx) =>
      tx.one<{ status: string; live_room_name: string | null }>(
        sql`SELECT status, live_room_name FROM public.member_live(${memberId})`,
      ),
    );
    return { live: m?.status === "approved" && Boolean(m.live_room_name) };
  });

export const joinLiveClass = createServerFn({ method: "POST" })
  .middleware([anonymous])
  .inputValidator(tokenInput)
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError, verifyCapability, rateLimit, LIMITS } = await K();
    const { meetingToken } = await D();
    const memberId = await verifyCapability("member", data.token);
    const m = await withDb({}, async (tx) => {
      await rateLimit(
        tx,
        `livejoin:${memberId}`,
        LIMITS.liveToken.windowSeconds,
        LIMITS.liveToken.max,
      );
      await rateLimit(tx, `livejoin-ip:${context.ipHash}`, 60, 600);
      return tx.one<{
        status: string;
        name: string;
        live_room_name: string | null;
        live_room_url: string | null;
        is_rep: boolean;
      }>(sql`SELECT * FROM public.member_live(${memberId})`);
    });
    if (!m || m.status !== "approved")
      throw new AppError("FORBIDDEN", "You haven't been approved for this class yet.");
    if (!m.live_room_name || !m.live_room_url)
      throw new AppError("CONFLICT", "The class isn't live right now.");
    return {
      url: `${m.live_room_url}?t=${await meetingToken(m.live_room_name, m.name, false, memberId, m.is_rep)}`,
    };
  });
