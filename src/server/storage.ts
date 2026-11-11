import { AwsClient } from "aws4fetch";
import { AppError } from "./errors";
import { serverEnv, storageConfigured } from "./env";

/**
 * Neon Object Storage (S3-compatible). Files are private: nobody gets a permanent URL.
 *   • Tutors upload straight from their browser to a short-lived presigned PUT URL.
 *   • Students/tutors read through a short-lived presigned GET URL minted only after the
 *     server (and the database) agree that person may open that file.
 */
const MAX_UPLOAD_EXPIRY = 10 * 60;
const GET_EXPIRY = 5 * 60;

function client() {
  if (!storageConfigured()) throw new AppError("UNAVAILABLE", "File storage isn't configured yet.");
  const e = serverEnv();
  return new AwsClient({
    accessKeyId: e.AWS_ACCESS_KEY_ID!,
    secretAccessKey: e.AWS_SECRET_ACCESS_KEY!,
    region: e.AWS_REGION,
    service: "s3",
  });
}
const objectUrl = (key: string) => {
  const e = serverEnv();
  const safe = key.split("/").map(encodeURIComponent).join("/");
  return `${e.AWS_ENDPOINT_URL_S3!.replace(/\/+$/, "")}/${e.STORAGE_BUCKET}/${safe}`;
};

/** Object keys we generate look like `<classId>/<uuid>-<safe-name>`. Anything else is rejected. */
const KEY_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,120}$/i;
export const isValidKey = (k: string) => KEY_RE.test(k);

export function newObjectKey(classId: string, filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext =
    dot > 0
      ? filename
          .slice(dot)
          .replace(/[^A-Za-z0-9.]/g, "")
          .slice(0, 10)
      : "";
  const stem =
    (dot > 0 ? filename.slice(0, dot) : filename)
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";
  return `${classId}/${crypto.randomUUID()}-${stem}${ext}`;
}

export async function presignPut(key: string, contentType: string): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(MAX_UPLOAD_EXPIRY));
  const signed = await client().sign(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

export async function presignGet(key: string, downloadName?: string): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(GET_EXPIRY));
  if (downloadName)
    url.searchParams.set(
      "response-content-disposition",
      `inline; filename="${downloadName.replace(/["\\\r\n]/g, "")}"`,
    );
  const signed = await client().sign(url.toString(), { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

/** Size and type as the storage service actually sees them (never trust the browser's claim). */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string } | null> {
  const res = await client().fetch(objectUrl(key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new AppError("UNAVAILABLE", "Couldn't verify the uploaded file.");
  return {
    size: Number(res.headers.get("content-length") ?? 0),
    contentType: res.headers.get("content-type") ?? "",
  };
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await client().fetch(objectUrl(key), { method: "DELETE" });
  } catch (e) {
    console.error("[storage] delete failed", key, e); // orphaned bytes are harmless; don't fail the request
  }
}

/** Used by scripts/storage-cors.ts. */
export async function putBucketCors(origins: string[]) {
  const e = serverEnv();
  const xml =
    `<CORSConfiguration><CORSRule>${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join("")}` +
    `<AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>` +
    `<AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3000</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
  const res = await client().fetch(
    `${e.AWS_ENDPOINT_URL_S3!.replace(/\/+$/, "")}/${e.STORAGE_BUCKET}?cors`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/xml" },
      body: xml,
    },
  );
  if (!res.ok) throw new Error(`PutBucketCors failed: ${res.status} ${await res.text()}`);
}

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
