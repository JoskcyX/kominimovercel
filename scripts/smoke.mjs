/**
 * End-to-end smoke test against the PRODUCTION build (node-server preset) and a real Postgres.
 *
 *   NITRO_PRESET=node-server npm run build
 *   SMOKE_DATABASE_URL=postgres://…/kominimo_test node scripts/smoke.mjs
 *
 * It starts a stub Neon Auth (signs EdDSA JWTs, serves JWKS), launches the built server, then calls
 * the real server functions over HTTP exactly as the browser does — through the real JWT
 * verification, middleware, rate limits and database role. Not part of `npm test` (needs a build + DB).
 */
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { fromCrossJSON, toJSONAsync } from "seroval";
import { encode } from "@tanstack/router-core";
import { createDefaultSerovalPlugins } from "@tanstack/router-core/ssr/client";

const DB = process.env.SMOKE_DATABASE_URL;
if (!DB || !/test/i.test(DB)) throw new Error("Set SMOKE_DATABASE_URL to a throwaway database (name must contain 'test').");
const APP = 3100, AUTH = 3200, ORIGIN = `http://localhost:${APP}`, AUTH_ORIGIN = `http://localhost:${AUTH}`;

// ── stub Neon Auth ───────────────────────────────────────────────────────────────────────
const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
const jwk = { ...(await exportJWK(publicKey)), alg: "EdDSA", use: "sig", kid: "k1" };
// Mirrors Neon: keys are served ONLY under the Auth URL path; anywhere else is a 404.
const authServer = http.createServer((req, res) => {
  if (req.url !== "/neondb/auth/.well-known/jwks.json") { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ keys: [jwk] }));
}).listen(AUTH);
const tokenFor = (id, email, { aud = `${AUTH_ORIGIN}/neondb/auth`, iss = `${AUTH_ORIGIN}/neondb/auth`, ttl = "10m", key = privateKey } = {}) =>
  new SignJWT({ email, name: email.split("@")[0] }).setProtectedHeader({ alg: "EdDSA", kid: "k1" })
    .setSubject(id).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(ttl).sign(key);

// ── launch the built app ─────────────────────────────────────────────────────────────────
const server = spawn("node", [".output/server/index.mjs"], {
  env: { ...process.env, PORT: String(APP), NODE_ENV: "production", DATABASE_URL: DB, NEON_AUTH_BASE_URL: `${AUTH_ORIGIN}/neondb/auth`,
    SESSION_SECRET: "x".repeat(48), CRON_SECRET: "c".repeat(32), TRUST_PROXY: "true", PLAN_ENFORCEMENT: "on", DAILY_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

// ── server-function client (same wire format as the browser) ─────────────────────────────
const manifestFile = readdirSync(".output/server").find((f) => f.startsWith("__23tanstack-start-server-fn-resolver"));
const manifest = readFileSync(`.output/server/${manifestFile}`, "utf8");
const idOf = (name) => {
  const m = new RegExp(`"([0-9a-f]{64})":\\s*\\{\\s*functionName:\\s*"${name}_createServerFn_handler"`).exec(manifest);
  if (!m) throw new Error(`no server function named ${name}`);
  return m[1];
};
const plugins = createDefaultSerovalPlugins(); // router plugins (errors, streams…); Start adapters unused here
async function call(name, data, { token, method = "POST", ip = "203.0.113.7" } = {}) {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", "x-forwarded-for": ip, origin: ORIGIN, "sec-fetch-site": "same-origin" };
  if (token) headers.authorization = `Bearer ${token}`;
  const payload = data === undefined ? undefined : await toJSONAsync({ data }, { plugins });
  let url = `${ORIGIN}/_serverFn/${idOf(name)}`, body;
  if (method === "GET") { if (payload) url += `?${encode({ payload: JSON.stringify(payload) })}`; }
  else if (payload) { body = JSON.stringify(payload); headers["content-type"] = "application/json"; }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  if (process.env.SMOKE_DEBUG) console.log("RAW", name, res.status, text.slice(0, 500));
  let json; try { json = JSON.parse(text); } catch { return { ok: false, status: res.status, error: text.slice(0, 200) }; }
  if (res.headers.get("x-tss-serialized")) {
    const value = fromCrossJSON(json, { plugins });
    // Middleware envelope: { result } on success, { error } on failure (message is in the raw payload).
    if (value && typeof value === "object" && "error" in value && value.error !== undefined) {
      const msg = /"\$TSR\/Error"/.test(text) ? (/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"/.exec(text)?.[1] ?? "") : "";
      return { ok: false, status: res.status, error: msg.replace(/\\"/g, '"') };
    }
    return { ok: true, status: res.status, value: value && typeof value === "object" && "result" in value ? value.result : value };
  }
  return res.ok ? { ok: true, status: res.status, value: json } : { ok: false, status: res.status, error: JSON.stringify(json).slice(0, 200) };
}

// ── assertions ───────────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "  ✓" : "  ✗"} ${name}${cond ? "" : `   ${extra}`}`); };
const uid = randomUUID(), uid2 = randomUUID();
const t1 = await tokenFor(uid, "ada@example.dev"), t2 = await tokenFor(uid2, "bob@example.dev");
const fmt = (r) => JSON.stringify(r).slice(0, 160);

try {
  console.log("\nAuthentication");
  let r = await call("getMe", undefined, { method: "GET" });
  check("no token → UNAUTHENTICATED", !r.ok && /UNAUTHENTICATED/.test(r.error), fmt(r));
  r = await call("getMe", undefined, { method: "GET", token: "not.a.jwt" });
  check("garbage token rejected", !r.ok, fmt(r));
  const { publicKey: _p, privateKey: evil } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  r = await call("getMe", undefined, { method: "GET", token: await tokenFor(uid, "ada@example.dev", { key: evil }) });
  check("token signed with a different key rejected", !r.ok, fmt(r));
  r = await call("getMe", undefined, { method: "GET", token: await tokenFor(uid, "ada@example.dev", { aud: "https://evil.example" }) });
  check("wrong audience rejected", !r.ok, fmt(r));
  r = await call("getMe", undefined, { method: "GET", token: await tokenFor(uid, "ada@example.dev", { ttl: "-1m" }) });
  check("expired token rejected", !r.ok, fmt(r));
  r = await call("getMe", undefined, { method: "GET", token: t1 });
  check("valid token → profile created, plan free, legal not yet accepted", r.ok && r.value.plan === "free" && r.value.legalOk === false && r.value.isAdmin === false, fmt(r));

  console.log("\nLegal acceptance gate");
  r = await call("listQuizzes", undefined, { method: "GET", token: t1 });
  check("tutor features blocked until Terms accepted (LEGAL_REQUIRED)", !r.ok && /LEGAL_REQUIRED/.test(r.error), fmt(r));
  r = await call("acceptLegal", undefined, { token: t1 });
  check("acceptLegal succeeds", r.ok, fmt(r));
  r = await call("listQuizzes", undefined, { method: "GET", token: t1 });
  check("tutor features unlocked after acceptance", r.ok && Array.isArray(r.value), fmt(r));
  await call("acceptLegal", undefined, { token: t2 });

  console.log("\nTenant isolation & plan limits (through the real API)");
  r = await call("createQuiz", { title: "Algebra" }, { token: t1 });
  check("create quiz", r.ok && r.value.id, fmt(r));
  const quizId = r.value?.id;
  r = await call("listQuizzes", undefined, { method: "GET", token: t2 });
  check("other tutor can't see it", r.ok && r.value.length === 0, fmt(r));
  r = await call("getQuizAdmin", { quizId }, { method: "GET", token: t2 });
  check("other tutor can't open it by id", !r.ok, fmt(r));
  r = await call("deleteQuiz", { quizId }, { token: t2 });
  const still = await call("listQuizzes", undefined, { method: "GET", token: t1 });
  check("other tutor can't delete it", still.ok && still.value.length === 1, fmt(r));
  for (let i = 0; i < 4; i++) await call("createQuiz", { title: `Q${i}` }, { token: t1 });
  r = await call("createQuiz", { title: "one too many" }, { token: t1 });
  check("free plan quiz cap (5) enforced with a friendly message", !r.ok && /allows 5 quizzes/i.test(r.error), fmt(r));

  console.log("\nStudent flow (no account, signed tokens)");
  await call("addBlankQuestion", { quizId }, { token: t1 });
  const qs = await call("listQuestionsAdmin", { quizId }, { method: "GET", token: t1 });
  const q = qs.value[0];
  await call("updateQuestion", { id: q.id, type: "multiple_choice", prompt: "2+2?", options: ["3", "4"], correct_answer: "4", time_limit: 30 }, { token: t1 });
  await call("quizAction", { quizId, action: "lobby" }, { token: t1 });
  const quiz = await call("getQuizAdmin", { quizId }, { method: "GET", token: t1 });
  const code = quiz.value.join_code;
  r = await call("joinQuiz", { quizId, name: "Zed Student", phone: "08011112222", consent: false });
  check("joining without consent is rejected", !r.ok, fmt(r));
  r = await call("joinQuiz", { quizId, name: "Zed Student", phone: "08011112222", consent: true });
  check("join with consent returns a signed token", r.ok && r.value.token?.startsWith("v1.participant."), fmt(r));
  const sess = r.value;
  const pub = await call("getQuizByCode", { code }, { method: "GET" });
  check("public quiz state carries the server clock", pub.ok && !!pub.value.server_now, fmt(pub));
  check("public state exposes no tutor id", pub.ok && !("tutor_id" in pub.value), fmt(pub));
  await call("quizAction", { quizId, action: "start" }, { token: t1 });
  r = await call("submitAnswer", { token: "v1.participant." + sess.participantId + ".9999999999.AAAA", questionId: q.id, response: "4" });
  check("forged token can't answer for a participant", !r.ok, fmt(r));
  r = await call("submitAnswer", { token: sess.token.replace(/\.[^.]+$/, ".AAAA"), questionId: q.id, response: "4" });
  check("tampered signature rejected", !r.ok, fmt(r));
  r = await call("submitAnswer", { token: sess.token, questionId: q.id, response: "4" });
  check("valid token answers correctly", r.ok && r.value.correct === true, fmt(r));
  const board = await call("getBoard", { quizId }, { method: "GET" });
  check("board shows the player's score and no phone number", board.ok && board.value[0]?.score === 1 && !("phone" in board.value[0]), fmt(board));
  r = await call("getPlayQuestions", { quizId }, { method: "GET" });
  check("student question list has no answers", r.ok && !("correct_answer" in r.value[0]), fmt(r));

  console.log("\nPublic endpoints: abuse protection");
  r = await call("submitContact", { name: "Ada", email: "ada@example.dev", topic: "general", message: "Hello there, this is a test message." }, { ip: "198.51.100.9" });
  check("contact form accepts a valid message", r.ok, fmt(r));
  r = await call("submitContact", { name: "Bot", email: "b@example.dev", topic: "general", message: "spam spam spam spam", website: "http://spam" }, { ip: "198.51.100.10" });
  check("honeypot silently accepted (but not stored)", r.ok, fmt(r));
  let limited = false;
  for (let i = 0; i < 8; i++) { r = await call("submitContact", { name: "Ada", email: "ada@example.dev", topic: "general", message: "Rate limit probe message." }, { ip: "198.51.100.11" }); if (!r.ok && /few messages/i.test(r.error)) limited = true; }
  check("contact form is rate limited per IP", limited, fmt(r));
  r = await call("submitContact", { name: "", email: "nope", topic: "general", message: "x" });
  check("contact form validates input", !r.ok, fmt(r));

  console.log("\nAdmin & privileges");
  r = await call("adminStats", undefined, { method: "GET", token: t1 });
  check("normal user can't call admin API", !r.ok && /permission/i.test(r.error), fmt(r));
  r = await call("exportMyData", undefined, { token: t1 });
  check("data export works and includes the quiz", r.ok && JSON.parse(r.value.json).quizzes.length >= 1, fmt(r));
  r = await call("deleteMyAccount", { confirm: "nope" }, { token: t2 });
  check("account deletion requires the DELETE confirmation", !r.ok, fmt(r));
  r = await call("deleteMyAccount", { confirm: "DELETE" }, { token: t2 });
  check("account deletion succeeds", r.ok, fmt(r));

  console.log("\nHTTP layer");
  const home = await fetch(ORIGIN);
  const html = await home.text();
  const visibleText = html.replace(/<!--.*?-->/g, ""); // React inserts comment nodes between text and values
  const csp = home.headers.get("content-security-policy") ?? "";
  check("home page renders (200)", home.status === 200 && visibleText.includes("Free for classes up to 250 students"), `status ${home.status}`);
  check("CSP present with nonce + strict-dynamic, no unsafe-inline scripts", /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(csp), csp.slice(0, 200));
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
  check("every <script> in the HTML carries this request's nonce", scripts.length > 0 && scripts.every((a) => a.includes(`nonce="${nonce}"`)), `${scripts.filter((a) => !a.includes(`nonce="${nonce}"`)).length} un-nonced of ${scripts.length}`);
  for (const h of ["strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy"])
    check(`header ${h}`, !!home.headers.get(h));
  check("pages are not cacheable", /no-store/.test(home.headers.get("cache-control") ?? ""));
  const n2 = /'nonce-([^']+)'/.exec((await fetch(ORIGIN)).headers.get("content-security-policy") ?? "")?.[1];
  check("nonce is different on every request", nonce && n2 && nonce !== n2);
  for (const path of ["/pricing", "/about", "/contact", "/how-it-works", "/terms", "/privacy", "/courses", "/auth"]) {
    const x = await fetch(ORIGIN + path);
    check(`GET ${path} → 200`, x.status === 200, `status ${x.status}`);
  }
  const cron = await fetch(`${ORIGIN}/api/public/jobs/close-idle-classes`);
  check("cron endpoint refuses without the secret", cron.status === 401, `status ${cron.status}`);
  const cron2 = await fetch(`${ORIGIN}/api/public/jobs/close-idle-classes`, { headers: { authorization: `Bearer ${"c".repeat(32)}` } });
  check("cron endpoint accepts the bearer secret (GET, as Vercel Cron sends)", cron2.status === 200, `status ${cron2.status}`);
  const sm = await fetch(`${ORIGIN}/sitemap.xml`);
  const smText = await sm.text();
  check("sitemap lists public pages and no private ones", /\/pricing/.test(smText) && !/dashboard|manage-class|admin/.test(smText), smText.slice(0, 120));
} catch (e) {
  fail++;
  console.log("  ✗ harness error:", e);
} finally {
  server.kill();
  authServer.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log("\n--- server log (tail) ---\n" + serverLog.split("\n").slice(-25).join("\n"));
  process.exit(fail ? 1 : 0);
}
