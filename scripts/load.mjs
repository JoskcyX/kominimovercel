/**
 * Load probe — N simulated students against the PRODUCTION build and a real Postgres.
 *
 *   NITRO_PRESET=node-server npm run build
 *   LOAD_DATABASE_URL=postgres://…/kominimo_test LOAD_STUDENTS=1000 LOAD_SCENARIO=all node scripts/load.mjs
 *
 * Scenarios (LOAD_SCENARIO = join | quiz | class | all):
 *   join   N students join one class at the SAME moment.
 *   quiz   N students join a quiz, then ALL answer each question in the same instant.
 *   class  N students sit in a live class polling like the real page (LOAD_SECONDS long).
 *
 * It reports latency percentiles, errors, and CPU used, and VERIFIES correctness afterwards
 * (nobody lost, nobody double-counted). Run it on the machine you want to size.
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { fromCrossJSON, toJSONAsync } from "seroval";
import { encode } from "@tanstack/router-core";
import { createDefaultSerovalPlugins } from "@tanstack/router-core/ssr/client";

const DB = process.env.LOAD_DATABASE_URL;
if (!DB || !/test/i.test(DB))
  throw new Error("Set LOAD_DATABASE_URL to a throwaway database (name must contain 'test').");
const N = Number(process.env.LOAD_STUDENTS ?? 1000),
  SECONDS = Number(process.env.LOAD_SECONDS ?? 30);
const SCENARIO = process.env.LOAD_SCENARIO ?? "all";
const APP = 3100,
  AUTH = 3200,
  ORIGIN = `http://localhost:${APP}`,
  AO = `http://localhost:${AUTH}`,
  AUTH_URL = `${AO}/neondb/auth`;

const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
  crv: "Ed25519",
  extractable: true,
});
const jwk = { ...(await exportJWK(publicKey)), alg: "EdDSA", use: "sig", kid: "k1" };
const authServer = http
  .createServer((req, res) => {
    if (req.url !== "/neondb/auth/.well-known/jwks.json") {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  })
  .listen(AUTH);
const tokenFor = (id, email) =>
  new SignJWT({ email, name: "Tutor" })
    .setProtectedHeader({ alg: "EdDSA", kid: "k1" })
    .setSubject(id)
    .setIssuer(AUTH_URL)
    .setAudience(AUTH_URL)
    .setIssuedAt()
    .setExpirationTime("60m")
    .sign(privateKey);

const server = spawn(
  "node",
  [
    ...(process.env.LOAD_PROFILE ? ["--prof"] : []),
    join(process.cwd(), ".output/server/index.mjs"),
  ],
  {
    cwd: process.env.LOAD_PROFILE ? "/tmp/prof" : undefined,
    env: {
      ...process.env,
      PORT: String(APP),
      NODE_ENV: "production",
      SERVER_TIMING: "on",
      DATABASE_URL: DB,
      NEON_AUTH_BASE_URL: AUTH_URL,
      SESSION_SECRET: "x".repeat(48),
      TRUST_PROXY: "true",
    },
    stdio: "ignore",
  },
);
for (let i = 0; i < 50; i++) {
  try {
    await fetch(ORIGIN);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

const manifest = readFileSync(
  `.output/server/${readdirSync(".output/server").find((f) => f.startsWith("__23tanstack-start-server-fn-resolver"))}`,
  "utf8",
);
const idOf = (n) =>
  new RegExp(`"([0-9a-f]{64})":\\s*\\{\\s*functionName:\\s*"${n}_createServerFn_handler"`).exec(
    manifest,
  )[1];
const plugins = createDefaultSerovalPlugins();
let stats = {};
// Requests for the same input are identical, so serialise each ONCE. (A real phone does its own work on
// its own CPU; we must not burn the server machine's core re-encoding payloads we've already built.)
const prepared = new Map();
async function prepare(name, data, method) {
  const key = `${name}|${method}|${JSON.stringify(data)}`;
  let p = prepared.get(key);
  if (!p) {
    const payload = data === undefined ? undefined : await toJSONAsync({ data }, { plugins });
    let url = `${ORIGIN}/_serverFn/${idOf(name)}`,
      body;
    if (method === "GET") {
      if (payload) url += `?${encode({ payload: JSON.stringify(payload) })}`;
    } else if (payload) body = JSON.stringify(payload);
    p = { url, body };
    prepared.set(key, p);
  }
  return p;
}
async function call(name, data, { token, method = "POST", record = false, fast = false } = {}) {
  const headers = {
    "x-tsr-serverFn": "true",
    accept: "application/json",
    "x-forwarded-for": "203.0.113.7",
    origin: ORIGIN,
    "sec-fetch-site": "same-origin",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const { url, body } = fast ? await prepare(name, data, method) : { url: null };
  let reqUrl = url,
    reqBody = body;
  if (!fast) {
    const payload = data === undefined ? undefined : await toJSONAsync({ data }, { plugins });
    reqUrl = `${ORIGIN}/_serverFn/${idOf(name)}`;
    if (method === "GET") {
      if (payload) reqUrl += `?${encode({ payload: JSON.stringify(payload) })}`;
    } else if (payload) reqBody = JSON.stringify(payload);
  }
  if (reqBody) headers["content-type"] = "application/json";
  const t0 = performance.now();
  let ok = false,
    value,
    error = "";
  try {
    const res = await fetch(reqUrl, { method, headers, body: reqBody });
    const text = await res.text();
    const st = /dur=([\d.]+)/.exec(res.headers.get("server-timing") ?? "")?.[1];
    if (st && record)
      (stats[name] ??= { ms: [], err: 0, why: {} }).srv = [
        ...((stats[name] ?? {}).srv ?? []),
        Number(st),
      ];
    if (fast) {
      ok = res.ok && !text.includes('"$TSR/Error"');
      if (!ok)
        error = /"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"/.exec(text)?.[1] ?? `HTTP ${res.status}`;
    } else {
      const v = fromCrossJSON(JSON.parse(text), { plugins });
      ok = !(v && typeof v === "object" && "error" in v && v.error !== undefined);
      if (!ok) error = /"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"/.exec(text)?.[1] ?? "error";
      value = v?.result;
    }
  } catch (e) {
    error = String(e.message ?? e).slice(0, 80);
  }
  if (record) {
    const s = (stats[name] ??= { ms: [], err: 0, why: {} });
    s.ms.push(performance.now() - t0);
    if (!ok) {
      s.err++;
      s.why[error] = (s.why[error] ?? 0) + 1;
    }
  }
  return { ok, value, error };
}

const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};
// CPU is measured per process: the SERVER by pid (/proc), the database by name, and this generator by itself.
const TICKS = 100;
const serverCpu = () => {
  try {
    const f = readFileSync(`/proc/${server.pid}/stat`, "utf8").split(") ")[1].split(" ");
    return (Number(f[11]) + Number(f[12])) / TICKS;
  } catch {
    return 0;
  }
};
const dbCpu = () => {
  let t = 0;
  for (const l of execSync("ps -eo comm,cputimes --no-headers").toString().trim().split("\n")) {
    const [c, v] = l.trim().split(/\s+/);
    if (c === "postgres") t += Number(v);
  }
  return t;
};
const genCpu = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1e6;
};
const cpuSec = () => ({ app: serverCpu(), db: dbCpu(), gen: genCpu(), at: performance.now() });
function report(title, secs, before) {
  const after = cpuSec();
  let total = 0,
    errs = 0;
  console.log(`\n── ${title} ──`);
  console.log(
    "call".padEnd(18),
    "calls".padStart(7),
    "req/s".padStart(7),
    "p50 ms".padStart(8),
    "p95 ms".padStart(8),
    "p99 ms".padStart(8),
    "max ms".padStart(8),
    "errors".padStart(7),
  );
  for (const [name, s] of Object.entries(stats)) {
    total += s.ms.length;
    errs += s.err;
    console.log(
      name.padEnd(18),
      String(s.ms.length).padStart(7),
      (s.ms.length / secs).toFixed(0).padStart(7),
      pct(s.ms, 0.5).toFixed(0).padStart(8),
      pct(s.ms, 0.95).toFixed(0).padStart(8),
      pct(s.ms, 0.99).toFixed(0).padStart(8),
      Math.max(...s.ms)
        .toFixed(0)
        .padStart(8),
      String(s.err).padStart(7),
    );
    if (s.srv?.length)
      console.log(
        `      ↳ server-side time (inside the app only): p50 ${pct(s.srv, 0.5).toFixed(0)} ms · p95 ${pct(s.srv, 0.95).toFixed(0)} ms · p99 ${pct(s.srv, 0.99).toFixed(0)} ms · max ${Math.max(...s.srv).toFixed(0)} ms`,
      );
    for (const [why, n] of Object.entries(s.why)) console.log(`      ↳ ${n}× ${why}`);
  }
  const wall = (after.at - before.at) / 1000;
  const app = after.app - before.app,
    db = after.db - before.db,
    gen = after.gen - before.gen;
  const cores = Number(execSync("nproc").toString().trim());
  console.log(
    `CPU seconds → server: ${app.toFixed(1)}  database: ${db.toFixed(1)}  load generator: ${gen.toFixed(1)}   of ${(wall * cores).toFixed(0)} available (${cores} core)`,
  );
  console.log(
    `  per request → server ${((app / total) * 1000).toFixed(2)} ms CPU, database ${((db / total) * 1000).toFixed(2)} ms CPU   | machine ${((100 * (app + db + gen)) / (wall * cores)).toFixed(0)}% busy`,
  );
  stats = {};
  return { total, errs };
}

const owner = new pg.Client({ connectionString: DB });
await owner.connect();
await owner.query("TRUNCATE public.profiles, public.rate_limits, public.audit_log CASCADE");
const tutor = randomUUID(),
  tt = await tokenFor(tutor, "t@example.dev");
await call("acceptLegal", undefined, { token: tt });
const fresh = async (pool = 40, fn) => {
  // run fn(i) for i in 0..N with bounded concurrency
  let next = 0;
  await Promise.all(
    Array.from({ length: pool }, async () => {
      while (next < N) {
        const i = next++;
        await fn(i);
      }
    }),
  );
};
const ids = (prefix, i) => ({
  name: `${prefix} ${i}`,
  identifier: `0805${String(i).padStart(7, "0")}`,
});
let failures = 0;
const verify = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : "   " + detail}`);
};

// ═════════ JOIN STORM ═════════
if (SCENARIO === "join" || SCENARIO === "all") {
  const cls = (await call("createClass", { title: "Join storm" }, { token: tt })).value;
  await call("updateClassSettings", { classId: cls.id, admit_mode: "auto" }, { token: tt });
  await owner.query("UPDATE classes SET member_limit = 5000 WHERE id = $1", [cls.id]);
  console.log(`\n▶ JOIN STORM: ${N} students join one class in the same instant`);
  const before = cpuSec(),
    t0 = performance.now();
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const s = ids("Joiner", i);
      await call(
        "requestJoin",
        { classId: cls.id, name: s.name, identifier: s.identifier, consent: true },
        { record: true },
      );
    }),
  );
  const secs = (performance.now() - t0) / 1000;
  report(`join storm (${N} simultaneous)`, secs, before);
  const n = Number(
    (
      await owner.query(
        "SELECT count(*) FROM class_members WHERE class_id=$1 AND status='approved'",
        [cls.id],
      )
    ).rows[0].count,
  );
  verify(`all ${N} students were admitted exactly once`, n === N, `got ${n}`);
  const dup = Number(
    (
      await owner.query(
        "SELECT count(*) - count(DISTINCT phone_norm) AS count FROM class_members WHERE class_id=$1",
        [cls.id],
      )
    ).rows[0].count,
  );
  verify("no duplicate students created", dup === 0, `${dup} duplicates`);
}

// ═════════ QUIZ: everyone joins, everyone answers at the same instant ═════════
if (SCENARIO === "quiz" || SCENARIO === "all") {
  const Q = 3;
  const quizId = (await call("createQuiz", { title: "Burst" }, { token: tt })).value.id;
  for (let q = 0; q < Q; q++) {
    await call("addBlankQuestion", { quizId }, { token: tt });
  }
  const qs = (await call("listQuestionsAdmin", { quizId }, { token: tt, method: "GET" })).value;
  for (const q of qs)
    await call(
      "updateQuestion",
      {
        id: q.id,
        type: "multiple_choice",
        prompt: "Pick A",
        options: ["A", "B"],
        correct_answer: "A",
        time_limit: 120,
      },
      { token: tt },
    );
  await call("quizAction", { quizId, action: "lobby" }, { token: tt });
  console.log(
    `\n▶ QUIZ: ${N} students join, then ALL submit each of ${Q} answers in the same instant`,
  );
  const players = new Array(N);
  let before = cpuSec(),
    t0 = performance.now();
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const s = ids("Player", i);
      const r = await call(
        "joinQuiz",
        { quizId, name: s.name, phone: s.identifier, consent: true },
        { record: true },
      );
      players[i] = r.value?.token;
    }),
  );
  report(`quiz join (${N} simultaneous)`, (performance.now() - t0) / 1000, before);
  await call("quizAction", { quizId, action: "start" }, { token: tt });
  const state = (
    await call(
      "getQuizByCode",
      {
        code: (await call("getQuizAdmin", { quizId }, { token: tt, method: "GET" })).value
          .join_code,
      },
      { method: "GET" },
    )
  ).value;
  // background state polling while answering, exactly like real phones
  let polling = true;
  const pollers = Array.from({ length: N }, async (_, i) => {
    await new Promise((r) => setTimeout(r, Math.random() * 1500));
    while (polling) {
      await call("getQuizState", { quizId }, { method: "GET", record: true, fast: true });
      await new Promise((r) => setTimeout(r, 1500 * (0.85 + Math.random() * 0.3)));
    }
  });
  before = cpuSec();
  t0 = performance.now();
  for (let q = 0; q < Q; q++) {
    // correct answers: 70 % of students; everyone submits at once
    await Promise.all(
      players.map(
        (tok, i) =>
          tok &&
          call(
            "submitAnswer",
            { token: tok, questionId: qs[q].id, response: i % 10 < 7 ? "A" : "B" },
            { record: true },
          ),
      ),
    );
    if (q < Q - 1) await call("quizAction", { quizId, action: "next" }, { token: tt });
  }
  const secs = (performance.now() - t0) / 1000;
  polling = false;
  await Promise.race([Promise.all(pollers), new Promise((r) => setTimeout(r, 3000))]);
  report(`quiz answer bursts (${N} × ${Q} simultaneous submits + live polling)`, secs, before);
  const rec = Number(
    (
      await owner.query(
        "SELECT count(*) FROM answers a JOIN participants p ON p.id=a.participant_id WHERE p.quiz_id=$1",
        [quizId],
      )
    ).rows[0].count,
  );
  verify(`all ${N * Q} answers recorded exactly once`, rec === N * Q, `got ${rec}`);
  const bad = Number(
    (
      await owner.query(
        "SELECT count(*) FROM participants p WHERE p.quiz_id=$1 AND p.score <> (SELECT count(*) FROM answers a WHERE a.participant_id=p.id AND a.is_correct)",
        [quizId],
      )
    ).rows[0].count,
  );
  verify("every score equals the true number of correct answers", bad === 0, `${bad} wrong`);
  const board = (await call("getBoard", { quizId, limit: 30 }, { method: "GET" })).value;
  verify(
    `leaderboard returns only the top 30 of ${N}`,
    board?.rows?.length === 30 && board.total === N,
    JSON.stringify({ rows: board?.rows?.length, total: board?.total }),
  );
  const me = (await call("getMyRank", { token: players[N - 1] }, { method: "GET" })).value;
  verify(
    "any student can still get their exact rank",
    !!me && me.total === N && me.rank >= 1,
    JSON.stringify(me),
  );
}

// ═════════ CLASS IN SESSION ═════════
if (SCENARIO === "class" || SCENARIO === "all") {
  const cls = (await call("createClass", { title: "In session" }, { token: tt })).value;
  await call("updateClassSettings", { classId: cls.id, admit_mode: "auto" }, { token: tt });
  await owner.query(
    "UPDATE classes SET member_limit = 5000, live_room_name='room', live_room_url='https://x.example/room', session_started_at=now(), live_started_at=now() WHERE id=$1",
    [cls.id],
  );
  const tokens = [];
  await fresh(60, async (i) => {
    const s = ids("Sitter", i);
    const r = (
      await call("requestJoin", {
        classId: cls.id,
        name: s.name,
        identifier: s.identifier,
        consent: true,
      })
    ).value;
    if (r) tokens.push(r.token);
  });
  console.log(
    `\n▶ CLASS IN SESSION: ${tokens.length} students polling for ${SECONDS}s (home every 4 s, attendance heartbeat every 20 s)`,
  );
  stats = {};
  const before = cpuSec(),
    t0 = Date.now();
  let stop = false;
  const loop = (token, name, every, method, data) =>
    (async () => {
      await new Promise((r) => setTimeout(r, Math.random() * every));
      while (!stop) {
        const s = performance.now();
        await call(name, data(token), { method, record: true, fast: true });
        await new Promise((r) =>
          setTimeout(
            r,
            Math.max(0, every * (0.85 + Math.random() * 0.3) - (performance.now() - s)),
          ),
        );
      }
    })();
  const loops = tokens.flatMap((t) => [
    loop(t, "getMemberHome", 4000, "GET", (x) => ({ token: x })),
    loop(t, "heartbeat", 20000, "POST", (x) => ({ token: x, present: true })),
  ]);
  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  stop = true;
  const secs = (Date.now() - t0) / 1000;
  await Promise.race([Promise.all(loops), new Promise((r) => setTimeout(r, 4000))]);
  const { total } = report(`class in session (${tokens.length} students)`, secs, before);
  console.log(
    `requests per student-hour ≈ ${((total / tokens.length / secs) * 3600).toFixed(0)}  →  one ${tokens.length}-student class-hour ≈ ${(((total / secs) * 3600) / 1000).toFixed(0)}k requests`,
  );
  const att = Number(
    (await owner.query("SELECT count(*) FROM class_session_attendance")).rows[0].count,
  );
  verify(
    `attendance recorded for every student (${tokens.length})`,
    att === tokens.length,
    `got ${att}`,
  );
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nAll correctness checks passed.");
server.kill();
authServer.close();
await owner.end();
process.exit(failures ? 1 : 0);
