import type { PoolClient, Pool } from "pg";
import { serverEnv } from "./env";
import { toAppError } from "./errors";

/* ── Safe SQL building ───────────────────────────────────────────────────────────────────
 * `sql` is a tagged template: every interpolated value becomes a $n parameter, so string
 * concatenation (and therefore SQL injection) is impossible by construction.            */
export type Sql = {
  readonly text: string;
  readonly values: readonly unknown[];
  readonly __sql: true;
};
class Raw {
  constructor(readonly text: string) {}
}

/** Trusted identifier/keyword fragment. Only ever pass string literals or allow-listed names. */
export const rawSql = (s: string) => new Raw(s);

export function sql(strings: TemplateStringsArray, ...vals: unknown[]): Sql {
  let text = "";
  const values: unknown[] = [];
  strings.forEach((s, i) => {
    text += s;
    if (i >= vals.length) return;
    const v = vals[i];
    if (v instanceof Raw) text += v.text;
    else if (isSql(v)) {
      const offset = values.length;
      text += v.text.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
      values.push(...v.values);
    } else {
      values.push(v);
      text += `$${values.length}`;
    }
  });
  return { text, values, __sql: true };
}
const isSql = (v: unknown): v is Sql =>
  typeof v === "object" && v !== null && (v as Sql).__sql === true;

/** `SET a = $1, b = $2` from an object, restricted to an allow-list of column names. */
export function setClause(patch: Record<string, unknown>, allowed: readonly string[]): Sql | null {
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  for (const k of keys) if (!allowed.includes(k)) throw new Error(`Column not updatable: ${k}`);
  if (keys.length === 0) return null;
  const parts = keys.map((k) => sql`${rawSql(`"${k.replace(/"/g, "")}"`)} = ${patch[k]}`);
  return parts.reduce((acc, p, i) => (i === 0 ? p : sql`${acc}, ${p}`));
}

/* ── Connection ───────────────────────────────────────────────────────────────────────── */
let poolPromise: Promise<Pool> | undefined;

async function getPool(): Promise<Pool> {
  poolPromise ??= (async () => {
    const url = serverEnv().DATABASE_URL;
    const host = new URL(url).hostname;
    // Neon (and any *.neon.* host) → serverless driver (WebSocket, works on Vercel & edge).
    // Anything else (local Postgres in dev/CI) → node-postgres. Both share the same Pool API.
    const isNeon = /(^|\.)neon\.(tech|build|com)$/.test(host);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = isNeon ? await import("@neondatabase/serverless") : await import("pg");
    const pgMod = mod.default ?? mod;
    const types = pgMod.types ?? mod.types;
    if (types) {
      types.setTypeParser(20, (v: string) => Number(v)); // bigint → number
      types.setTypeParser(1700, (v: string) => Number(v)); // numeric → number
      types.setTypeParser(1184, (v: string) => new Date(v).toISOString()); // timestamptz → ISO string
    }
    const Pool = mod.Pool ?? pgMod.Pool;
    return new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    }) as Pool;
  })();
  return poolPromise;
}

// Rows are untyped at this boundary; callers narrow them with the generic parameters on Tx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export interface Tx {
  all<T = Row>(q: Sql): Promise<T[]>;
  one<T = Row>(q: Sql): Promise<T | null>;
  /** Rows affected. */
  exec(q: Sql): Promise<number>;
  /** Value of the first column of the first row. */
  scalar<T = unknown>(q: Sql): Promise<T | null>;
}

export type DbContext = {
  /** Verified user id, or null/undefined for anonymous (student) requests. */
  userId?: string | null;
  /** Trusted non-user context. Unlocks the functions that check app.system_context(). */
  system?: "cron" | "payment";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run `fn` in ONE transaction as the least-privileged `app_runtime` role, with the request's
 * identity bound to the transaction. Row Level Security then enforces tenant isolation even if
 * application code has a bug.
 */
export async function withDb<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (ctx.userId && !UUID.test(ctx.userId)) throw new Error("Invalid user id");
  const pool = await getPool();
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE app_runtime");
    await client.query(
      "SELECT set_config('app.user_id', $1, true), set_config('app.system', $2, true)",
      [ctx.userId ?? "", ctx.system ?? ""],
    );
    const run = async (q: Sql) => client.query(q.text, q.values as unknown[]);
    const tx: Tx = {
      all: async (q) => (await run(q)).rows,
      one: async (q) => (await run(q)).rows[0] ?? null,
      exec: async (q) => (await run(q)).rowCount ?? 0,
      scalar: async (q) => {
        const r = (await run(q)).rows[0];
        return r ? ((Object.values(r)[0] as never) ?? null) : null;
      },
    };
    const out = await fn(tx);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection already broken */
    }
    throw toAppError(e);
  } finally {
    client.release();
  }
}
