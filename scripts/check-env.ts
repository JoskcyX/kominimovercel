/**
 * Pre-flight check:  npm run check:env
 * Validates environment variables, then (if they look right) tests the database, the migration
 * state, the least-privilege role, Neon Auth's signing keys and object storage. Prints no secrets.
 */
import { existsSync } from "node:fs";
import pg from "pg";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const { serverEnv, storageConfigured } = await import("../src/server/env");
let failed = false;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => {
  failed = true;
  console.log(`  ✗ ${m}`);
};
const warn = (m: string) => console.log(`  ! ${m}`);

console.log("Environment");
let env: ReturnType<typeof serverEnv> | undefined;
try {
  env = serverEnv();
  ok("required variables are present and well-formed");
} catch (e) {
  bad((e as Error).message);
}

if (env) {
  for (const k of [
    "VITE_NEON_AUTH_URL",
    "VITE_SITE_URL",
    "VITE_CONTACT_EMAIL",
    "VITE_LEGAL_ENTITY",
  ]) {
    if (process.env[k]) ok(`${k} set`);
    else warn(`${k} is empty (legal pages and metadata look better with it set)`);
  }
  if (!env.CRON_SECRET) warn("CRON_SECRET not set — the idle-class job will refuse to run");
  if (!env.DAILY_API_KEY) warn("DAILY_API_KEY not set — live video is disabled");
  if (storageConfigured()) ok("object storage credentials present");
  else warn("object storage not configured — file uploads are disabled");

  console.log("\nDatabase");
  const client = new pg.Client({
    connectionString: process.env["DATABASE_URL_MIGRATIONS"] ?? env.DATABASE_URL,
  });
  try {
    await client.connect();
    ok("connected");
    const mig = await client
      .query("SELECT count(*)::int AS n FROM public.schema_migrations")
      .catch(() => null);
    if (mig && mig.rows[0].n > 0) ok(`${mig.rows[0].n} migration(s) applied`);
    else bad("no migrations applied — run `npm run db:migrate`");
    const role = await client.query(
      "SELECT rolcanlogin, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'app_runtime'",
    );
    if (!role.rowCount) bad("role app_runtime missing — run migrations");
    else if (role.rows[0].rolbypassrls || role.rows[0].rolsuper)
      bad("app_runtime must NOT bypass RLS or be a superuser");
    else ok("app_runtime role exists with no RLS bypass");
    // A role created in the Neon Console can be made a member of neon_superuser, which would hand it
    // broad inherited privileges and defeat least-privilege. It must have NO powerful memberships.
    const member = await client.query(
      `SELECT r.rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid JOIN pg_roles u ON u.oid = m.member WHERE u.rolname = 'app_runtime'`,
    );
    if (member.rowCount)
      bad(
        `app_runtime is a member of: ${member.rows.map((r) => r.rolname).join(", ")} — remove it (REVOKE … FROM app_runtime) and create the role with SQL, not the console`,
      );
    else ok("app_runtime has no inherited role memberships");
    const rls = await client.query(
      "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity AND tablename <> 'schema_migrations'",
    );
    if (rls.rows[0].n === 0) ok("row-level security enabled on every table");
    else bad(`${rls.rows[0].n} table(s) without RLS`);
  } catch (e) {
    bad(`database: ${(e as Error).message}`);
  } finally {
    await client.end().catch(() => undefined);
  }

  console.log("\nNeon Auth");
  try {
    const origin = new URL(env.NEON_AUTH_BASE_URL).origin;
    const res = await fetch(`${origin}/.well-known/jwks.json`);
    const keys = res.ok ? (((await res.json()) as { keys?: unknown[] }).keys?.length ?? 0) : 0;
    if (keys > 0) ok(`signing keys reachable (${keys})`);
    else bad(`JWKS not reachable at ${origin}/.well-known/jwks.json (HTTP ${res.status})`);
  } catch (e) {
    bad(`auth: ${(e as Error).message}`);
  }
}

console.log(failed ? "\nSome checks failed." : "\nAll good.");
process.exit(failed ? 1 : 0);
