/**
 * Minimal, dependency-light migration runner.
 *   npm run db:migrate          apply any new files in db/migrations (in filename order)
 *   npm run db:status           show applied / pending
 * Uses DATABASE_URL_MIGRATIONS (owner role, direct connection), falling back to DATABASE_URL.
 * Each file runs in its own transaction and is checksummed: editing an applied file is an error.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const dir = join(process.cwd(), "db", "migrations");
const url = process.env["DATABASE_URL_MIGRATIONS"] ?? process.env["DATABASE_URL"];
if (!url) {
  console.error("Set DATABASE_URL_MIGRATIONS (or DATABASE_URL).");
  process.exit(1);
}
const statusOnly = process.argv.includes("--status");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Map<string, string>(
    (
      await client.query<{ name: string; checksum: string }>(
        "SELECT name, checksum FROM public.schema_migrations",
      )
    ).rows.map((r) => [r.name, r.checksum]),
  );
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let applied = 0;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const sum = createHash("sha256").update(sql).digest("hex");
    const prev = done.get(file);
    if (prev) {
      if (prev !== sum)
        throw new Error(
          `${file} was already applied but has been edited. Add a new migration instead.`,
        );
      console.log(`  ✓ ${file}`);
      continue;
    }
    if (statusOnly) {
      console.log(`  · ${file}  (pending)`);
      continue;
    }
    console.log(`  → applying ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)", [
        file,
        sum,
      ]);
      await client.query("COMMIT");
      applied++;
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`${file} failed: ${(e as Error).message}`);
    }
  }
  console.log(statusOnly ? "Status complete." : `Done. ${applied} migration(s) applied.`);
} finally {
  await client.end();
}
