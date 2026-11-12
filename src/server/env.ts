import { z } from "zod";

/** Accepts the Auth URL even if the JWKS path or a trailing slash was pasted on the end. */
export const normalizeAuthUrl = (u: string) =>
  u
    .trim()
    .replace(/\/\.well-known\/jwks\.json\/?$/i, "")
    .replace(/\/+$/, "");

/**
 * Server-only environment, validated once. Missing or malformed values produce ONE clear error
 * that names the variable (never its value). Run `npm run check:env` to validate before deploying.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEON_AUTH_BASE_URL: z
    .string()
    .url("NEON_AUTH_BASE_URL must be a URL")
    .transform(normalizeAuthUrl),
  /** Only if Neon shows a JWKS URL that isn't simply <Auth URL>/.well-known/jwks.json. */
  NEON_AUTH_JWKS_URL: z.string().url().optional(),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters (openssl rand -base64 48)"),
  SESSION_SECRET_PREVIOUS: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(24).optional(),
  APP_URL: z.string().url().optional(),
  DAILY_API_KEY: z.string().min(1).optional(),
  AWS_ENDPOINT_URL_S3: z.string().url().optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  AWS_REGION: z.string().default("us-east-2"),
  STORAGE_BUCKET: z.string().default("class-files"),
  PLAN_ENFORCEMENT: z.enum(["on", "off"]).default("on"),
  TRUST_PROXY: z.enum(["true", "false"]).default("true"),
  /** Max database connections per server instance (Neon's pooler handles many clients; 10 suits Vercel Fluid). */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
});

export type ServerEnv = z.infer<typeof schema>;
let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(
    Object.fromEntries(Object.keys(schema.shape).map((k) => [k, emptyToUndefined(process.env[k])])),
  );
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Server is misconfigured. Fix these environment variables:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}

const emptyToUndefined = (v: string | undefined) =>
  v === undefined || v.trim() === "" ? undefined : v.trim();

export const storageConfigured = () => {
  const e = serverEnv();
  return Boolean(e.AWS_ENDPOINT_URL_S3 && e.AWS_ACCESS_KEY_ID && e.AWS_SECRET_ACCESS_KEY);
};
