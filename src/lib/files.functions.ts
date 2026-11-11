import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { tutor } from "@/lib/middleware";
import { uuid } from "@/lib/validation";

/**
 * Class file uploads (Neon Object Storage).
 *   1. createUploadUrl  – checks you own the class, the type and size are allowed, returns a
 *                         short-lived presigned PUT URL.
 *   2. (browser PUTs the file straight to storage — it never passes through our servers)
 *   3. confirmUpload    – asks storage what was REALLY uploaded; deletes it if it's too big or the
 *                         wrong type; only then adds the material to the class.
 */
const K = () => import("@/server/kit");
const S = () => import("@/server/storage");
const HARD_MAX_BYTES = 1024 * 1024 * 1024;

async function maxBytes(plan: "free" | "pro") {
  const { tierFor, enforcing } = await K();
  return enforcing() ? tierFor(plan).maxUploadMb * 1024 * 1024 : HARD_MAX_BYTES;
}

export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      classId: uuid,
      filename: z.string().trim().min(1).max(200),
      contentType: z.string().max(120),
      size: z.number().int().positive(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError, rateLimit, LIMITS } = await K();
    const { ALLOWED_UPLOAD_TYPES, newObjectKey, presignPut } = await S();
    const uid = context.actor.userId;
    const limit = await maxBytes(context.actor.plan);
    if (data.size > limit)
      throw new AppError(
        "LIMIT_REACHED",
        `Files can be up to ${Math.round(limit / 1048576).toLocaleString("en")} MB on your plan.`,
      );
    if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(data.contentType))
      throw new AppError(
        "INVALID",
        "That file type isn't supported. Upload a PDF, Office document, image, audio or video file.",
      );
    await withDb({ userId: uid }, async (tx) => {
      await rateLimit(tx, `upload:${uid}`, LIMITS.upload.windowSeconds, LIMITS.upload.max);
      const owns = await tx.scalar(
        sql`SELECT 1 FROM public.classes WHERE id = ${data.classId} AND tutor_id = ${uid}`,
      );
      if (!owns) throw new AppError("NOT_FOUND", "We couldn't find that class.");
    });
    const key = newObjectKey(data.classId, data.filename);
    return {
      key,
      uploadUrl: await presignPut(key, data.contentType),
      contentType: data.contentType,
    };
  });

export const confirmUpload = createServerFn({ method: "POST" })
  .middleware([tutor])
  .inputValidator(
    z.object({
      classId: uuid,
      key: z.string().max(300),
      title: z.string().trim().max(200),
      visible: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    const { ALLOWED_UPLOAD_TYPES, headObject, deleteObject, isValidKey } = await S();
    const uid = context.actor.userId;
    if (!isValidKey(data.key) || !data.key.startsWith(`${data.classId}/`))
      throw new AppError("INVALID", "That upload isn't valid.");
    const head = await headObject(data.key);
    if (!head)
      throw new AppError("NOT_FOUND", "We couldn't find the uploaded file. Please try again.");
    const type = head.contentType.split(";")[0]!.trim();
    if (
      head.size > (await maxBytes(context.actor.plan)) ||
      !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(type)
    ) {
      await deleteObject(data.key);
      throw new AppError(
        "INVALID",
        "That file is too large or isn't a supported type, so it was discarded.",
      );
    }
    const kind = type.startsWith("video/") ? "video" : "document";
    await withDb({ userId: uid }, async (tx) => {
      const owns = await tx.scalar(
        sql`SELECT 1 FROM public.classes WHERE id = ${data.classId} AND tutor_id = ${uid}`,
      );
      if (!owns) throw new AppError("NOT_FOUND", "We couldn't find that class.");
      const order = Number(
        (await tx.scalar(
          sql`SELECT count(*) FROM public.class_resources WHERE class_id = ${data.classId}`,
        )) ?? 0,
      );
      await tx.exec(sql`INSERT INTO public.class_resources (class_id, title, kind, url, body, order_index, visible)
        VALUES (${data.classId}, ${data.title || "Untitled"}, ${kind}::public.class_resource_kind, ${"storage:" + data.key}, '', ${order}, ${data.visible})`);
    });
    return { ok: true };
  });

/** A tutor opening one of their own files. */
export const getTutorFileUrl = createServerFn({ method: "GET" })
  .middleware([tutor])
  .inputValidator(z.object({ resourceId: uuid }))
  .handler(async ({ data, context }) => {
    const { withDb, sql, AppError } = await K();
    const { presignGet } = await S();
    const url = await withDb({ userId: context.actor.userId }, (tx) =>
      tx.scalar<string>(
        sql`SELECT r.url FROM public.class_resources r JOIN public.classes c ON c.id = r.class_id WHERE r.id = ${data.resourceId} AND c.tutor_id = ${context.actor.userId}`,
      ),
    );
    if (!url?.startsWith("storage:")) throw new AppError("NOT_FOUND", "That file isn't available.");
    return { url: await presignGet(url.slice(8)) };
  });
