import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const IDLE_MINUTES = 5;

async function dailyFetch(path: string, init: RequestInit = {}) {
  const key = process.env["DAILY_API_KEY"];
  if (!key) throw new Error("DAILY_API_KEY missing");
  const res = await fetch(`https://api.daily.co/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Daily ${res.status}`);
  return res.json();
}

// Ends live classes nobody has been in for IDLE_MINUTES.
export const Route = createFileRoute("/api/public/jobs/close-idle-classes")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: live } = await supabaseAdmin
          .from("classes")
          .select("id, live_room_name, live_empty_since")
          .not("live_room_name", "is", null);

        let closed = 0;
        for (const c of live ?? []) {
          try {
            const presence = await dailyFetch(`/rooms/${c.live_room_name}/presence`);
            const count = presence ? Number(presence.total_count ?? 0) : 0;
            const now = new Date();
            if (count > 0) {
              if (c.live_empty_since) await supabaseAdmin.from("classes").update({ live_empty_since: null }).eq("id", c.id);
              continue;
            }
            if (!c.live_empty_since) {
              await supabaseAdmin.from("classes").update({ live_empty_since: now.toISOString() }).eq("id", c.id);
              continue;
            }
            if (now.getTime() - new Date(c.live_empty_since).getTime() >= IDLE_MINUTES * 60_000) {
              if (presence !== null) await dailyFetch(`/rooms/${c.live_room_name}`, { method: "DELETE" });
              await supabaseAdmin
                .from("classes")
                .update({ live_room_name: null, live_room_url: null, live_started_at: null, session_ended_at: now.toISOString(), live_empty_since: null })
                .eq("id", c.id);
              closed++;
            }
          } catch (e) {
            console.error("idle check failed", c.id, e);
          }
        }
        return Response.json({ checked: live?.length ?? 0, closed });
      },
    },
  },
});
