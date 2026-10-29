import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function daily(path: string, init: RequestInit = {}) {
  const key = process.env["DAILY_API_KEY"];
  if (!key) throw new Error("Live video isn't connected yet");
  const res = await fetch(`https://api.daily.co/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Video service error (${res.status})`);
  return res.status === 404 ? null : res.json();
}

async function token(room: string, userName: string, owner: boolean) {
  const t = await daily("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: room,
        user_name: userName,
        is_owner: owner,
        start_video_off: !owner,
        start_audio_off: !owner,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6,
      },
    }),
  });
  return t.token as string;
}

const classInput = (d: unknown) => z.object({ classId: z.string().uuid() }).parse(d);

export const startLiveClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(classInput)
  .handler(async ({ data, context }) => {
    const { data: cls } = await context.supabase
      .from("classes")
      .select("id, title, tutor_id, live_room_name, live_room_url")
      .eq("id", data.classId)
      .maybeSingle();
    if (!cls || cls.tutor_id !== context.userId) throw new Error("Not your class");
    let name = cls.live_room_name;
    let url = cls.live_room_url;
    if (!name || !url) {
      const room = await daily("/rooms", {
        method: "POST",
        body: JSON.stringify({
          privacy: "private",
          properties: { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6, enable_chat: true, enable_screenshare: true, enable_prejoin_ui: true },
        }),
      });
      name = room.name as string;
      url = room.url as string;
      const { error } = await context.supabase
        .from("classes")
        .update({ live_room_name: name, live_room_url: url, live_started_at: new Date().toISOString() })
        .eq("id", cls.id);
      if (error) throw error;
    }
    const { data: prof } = await context.supabase.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
    return { url: `${url}?t=${await token(name, prof?.display_name || "Tutor", true)}` };
  });

export const endLiveClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(classInput)
  .handler(async ({ data, context }) => {
    const { data: cls } = await context.supabase
      .from("classes")
      .select("id, tutor_id, live_room_name")
      .eq("id", data.classId)
      .maybeSingle();
    if (!cls || cls.tutor_id !== context.userId) throw new Error("Not your class");
    if (cls.live_room_name) await daily(`/rooms/${cls.live_room_name}`, { method: "DELETE" });
    await context.supabase
      .from("classes")
      .update({ live_room_name: null, live_room_url: null, live_started_at: null })
      .eq("id", cls.id);
    return { ok: true };
  });

// Students have no account: verify they're an approved member before handing out a join token.
export const getLiveStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("class_members").select("class_id, status").eq("id", data.memberId).maybeSingle();
    if (!m || m.status !== "approved") return { live: false as const };
    const { data: c } = await supabaseAdmin.from("classes").select("live_room_name").eq("id", m.class_id).maybeSingle();
    return { live: !!c?.live_room_name };
  });

export const joinLiveClass = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("class_members").select("class_id, status, name").eq("id", data.memberId).maybeSingle();
    if (!m || m.status !== "approved") throw new Error("Not approved");
    const { data: c } = await supabaseAdmin.from("classes").select("live_room_name, live_room_url").eq("id", m.class_id).maybeSingle();
    if (!c?.live_room_name || !c.live_room_url) throw new Error("Class isn't live");
    return { url: `${c.live_room_url}?t=${await token(c.live_room_name, m.name, false)}` };
  });
