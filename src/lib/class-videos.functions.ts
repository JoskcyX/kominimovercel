import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const STORAGE_PREFIX = "storage:";

// Approved students (no account) get short-lived links to uploaded class files (videos, documents).
export const getClassVideoUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ memberId: z.string().uuid(), resourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("class_members")
      .select("class_id, status")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!m || m.status !== "approved") throw new Error("Not approved");
    const { data: r } = await supabaseAdmin
      .from("class_resources")
      .select("url, class_id, visible, id")
      .eq("id", data.resourceId)
      .maybeSingle();
    if (!r || r.class_id !== m.class_id || !r.url?.startsWith(STORAGE_PREFIX)) throw new Error("Not found");
    if (!r.visible) {
      const { data: c } = await supabaseAdmin.from("classes").select("presenting_resource_id").eq("id", m.class_id).maybeSingle();
      if (c?.presenting_resource_id !== r.id) throw new Error("Not found");
    }
    const { data: signed, error } = await supabaseAdmin.storage
      .from("class-videos")
      .createSignedUrl(r.url.slice(STORAGE_PREFIX.length), 60 * 60 * 3);
    if (error || !signed) throw new Error("Could not load file");
    return { url: signed.signedUrl };
  });
