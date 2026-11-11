import { createFileRoute } from "@tanstack/react-router";

const IDLE_MINUTES = 5;

/**
 * Scheduled job: ends live classes nobody has been in for IDLE_MINUTES, and tidies old rate-limit
 * rows. Triggered by Vercel Cron (GET) — see vercel.json — or any scheduler (POST).
 */
async function run(request: Request): Promise<Response> {
  const { authenticateCron } = await import("@/server/cron-auth");
  const failure = authenticateCron(request);
  if (failure) return failure;

  const { withDb, sql } = await import("@/server/db");
  const { daily } = await import("@/server/daily");

  const live = await withDb({ system: "cron" }, (tx) => tx.all<{ id: string; live_room_name: string; live_empty_since: string | null }>(sql`SELECT * FROM app.live_classes()`));
  let closed = 0;
  for (const c of live) {
    try {
      const presence = await daily(`/rooms/${c.live_room_name}/presence`);
      const count = presence ? Number(presence.total_count ?? 0) : 0;
      const now = Date.now();
      if (count > 0) {
        if (c.live_empty_since) await withDb({ system: "cron" }, (tx) => tx.exec(sql`SELECT app.set_live_empty(${c.id}, NULL)`));
        continue;
      }
      if (!c.live_empty_since) {
        await withDb({ system: "cron" }, (tx) => tx.exec(sql`SELECT app.set_live_empty(${c.id}, ${new Date(now).toISOString()})`));
        continue;
      }
      if (now - new Date(c.live_empty_since).getTime() >= IDLE_MINUTES * 60_000) {
        if (presence !== null) await daily(`/rooms/${c.live_room_name}`, { method: "DELETE" });
        await withDb({ system: "cron" }, (tx) => tx.exec(sql`SELECT app.close_class_live(${c.id})`));
        closed++;
      }
    } catch (e) {
      console.error("[cron] idle check failed", c.id, e);
    }
  }
  const purged = await withDb({}, (tx) => tx.scalar<number>(sql`SELECT app.purge_rate_limits()`));
  return Response.json({ checked: live.length, closed, purgedRateLimits: purged }, { headers: { "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/public/jobs/close-idle-classes")({
  staticData: { sitemap: false },
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
