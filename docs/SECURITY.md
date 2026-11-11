# Security

## Model in one paragraph

The browser never reaches the database. Every call is a server function that first proves *who* is asking (Neon Auth JWT for tutors, a signed token for students, nothing for public pages), validates the input, and only then talks to Postgres — as a least-privilege role (`app_runtime`) with Row Level Security, so a bug in application code still can't read another tutor's data. Sensitive columns (plan, roles, money, class capacity) can't be written by that role at all; they change only through SQL functions that check the caller.

## Controls

| Area | What we do | Where |
| --- | --- | --- |
| Authentication | JWT verified on every call: EdDSA only, issuer + audience pinned, keys from Neon's JWKS, `sub` must be a UUID | `src/server/auth.ts` |
| Authorisation | `WHERE tutor_id = caller` **and** RLS; role middleware **and** `app.require_admin()` in SQL | `src/lib/*.functions.ts`, `db/migrations` |
| Least privilege | `app_runtime`: no login-superuser, no `BYPASSRLS`, no role memberships; column-level `UPDATE` grants; `EXECUTE` revoked from `PUBLIC` | `0001`–`0006` |
| SQL injection | Tagged-template `sql` → every value is a `$n` parameter; column names only from allow-lists | `src/server/db.ts` |
| Input validation | zod on every server function; DB `CHECK` constraints as a second net | `src/lib/validation.ts` |
| Student sessions | HMAC-signed, expiring tokens; ids are public labels, not credentials; key rotation via `SESSION_SECRET_PREVIOUS` | `src/server/capability.ts` |
| Quiz integrity | Server-side timing, only the live question is answerable, resubmits return the original result (no answer oracle), answer key only after answering and only if the tutor enabled reveals | `0002_quizzes.sql` |
| Paywall | Paid lesson bodies are withheld by the database unless owner/enrolled; self-enrolment can only be `free` | `0003_courses.sql` |
| Capacity | Free-plan class cap enforced by a trigger (can't be bypassed by any code path) | `0004_classes.sql` |
| Abuse | Postgres-backed rate limits (shared across instances) on joins, answers, contact, uploads, live tokens; honeypot on the contact form | `src/server/rate-limit.ts` |
| Browser | Strict CSP with a **per-request nonce** + `strict-dynamic`, HSTS, nosniff, frame-ancestors none, Referrer-Policy, Permissions-Policy (camera/mic only for us + Daily), COOP; `no-store` on pages and API | `src/server.ts`, `src/server/security-headers.ts` |
| Files | Private bucket; presigned 10-min PUT / 5-min GET; type allow-list; size verified by asking storage after upload (oversize files are deleted); keys must match a strict pattern | `src/server/storage.ts`, `files.functions.ts` |
| Output safety | `embedUrl` allow-lists YouTube/Vimeo/Loom over https; DB rejects non-https links and cover images; CSV export neutralises formulas | `src/lib/courses.ts`, `src/lib/csv.ts` |
| Privacy | IPs only as salted hashes; phone/matric never on public leaderboards; class reps see masked identifiers; consent recorded (version + time) for tutors and students; data export + account deletion | `me.functions.ts`, `0006` |
| Secrets | Server env validated at startup; nothing secret ships to the browser (verified by scanning the build); `.env*` git-ignored | `src/server/env.ts`, `.gitignore` |
| Errors | Known failures map to friendly messages; anything unexpected is logged server-side and replaced with a generic message | `src/server/errors.ts` |
| Audit | Sensitive actions (legal acceptance, export, erasure, admin changes) are written to `audit_log` | `0001`, `0006` |
| Scheduled jobs | Bearer secret, constant-time compare | `src/server/cron-auth.ts` |

## Problems found in the original code (all fixed)

1. **Any signed-in user could make themselves Pro** — `profiles` allowed a self-`UPDATE` of every column, including `plan`.
2. **Users could rewrite their referral earnings and subscription events** from the browser.
3. **Paid course content was public**; the "locked" state existed only in the UI. Users could also enrol themselves as `paid`.
4. **A student's participant id was both public and the credential.** Leaderboards list ids, so anyone could answer for / finish another player.
5. **Quiz cheating:** the client reported its own answer time; any question (even future ones) could be answered; resubmitting revealed the right answer; any question's key could be fetched at any time.
6. **`javascript:` / arbitrary URLs** could become iframe sources (`embedUrl` returned unknown URLs unchanged); resource links and course URLs weren't restricted to https.
7. **CSV formula injection** through student names in exports.
8. Class reps could see fellow students' full phone numbers.
9. The quiz table was readable by anyone, exposing every join code.
10. `.env` was committed; the sitemap hard-coded a platform domain.
11. Plan limits were advertised but **never enforced**.

## Residual risks and honest limits

- **Students are unauthenticated by design.** A phone/matric number is a claim, not a credential: someone who knows another student's number can rejoin as them (this is what makes returning students seamless). Use "approve each student" or "expected list" admit modes for sensitive classes.
- **Not yet run against a live Neon project or Daily.** Everything was verified against real PostgreSQL 16 as the real restricted role, a stub JWKS issuer, and the production build — but not the Neon serverless driver path, Neon Auth's real claim shape (`email`, `name`), or Daily. `npm run check:env` and a first manual run-through are your safety net.
- **Account deletion** erases all app data and files. Removing the Neon Auth identity (email + password hash) is attempted from the browser; if Neon's managed auth doesn't permit self-deletion, the person is told and you must remove them in the Neon console. Keep your Privacy Policy consistent with what actually happens.
- **CSP:** scripts are nonce-locked, but `style-src` still allows inline styles (React emits them) and `img-src` allows any https image (tutor-supplied covers).
- **Student tokens live in `localStorage`**, so an XSS bug would expose them. The CSP is the main defence.
- **Rate limits are per IP.** A whole school behind one IP is handled with generous join limits (600/10 min); tune `LIMITS` in `src/server/rate-limit.ts`.
- **No malware scanning of uploads**, and no MFA unless Neon Auth provides it.
- **The `neon-auth`/`better-auth` SDKs are beta**; pin versions and test upgrades.
- Backups and point-in-time recovery are Neon's; set the history window to what you need.

## Launch checklist

- [ ] Lawyer reviewed Terms + Privacy; entity, address, contact email set (`VITE_*`)
- [ ] `npm run check:env` is green in production
- [ ] `app_runtime` created with SQL (not the console) and used in `DATABASE_URL`
- [ ] Neon Auth: trusted origins set, email verification on
- [ ] `npm run storage:cors` run for the production origin only
- [ ] `SESSION_SECRET` and `CRON_SECRET` are fresh random values (not reused)
- [ ] First admin granted; admin page loads for you and **404/redirects** for a normal account
- [ ] Sign-up → accept terms → create class → join as student → go live → attendance — done once by hand
- [ ] Security headers verified (e.g. securityheaders.com) on the live URL
- [ ] Neon IP/connection limits and backup window reviewed
- [ ] Decide how you'll honour student data requests (Contact → "Privacy")

## Testing

- `src/server/db.integration.test.ts` — 26 tests against real Postgres as `app_runtime`: privilege escalation, tenant isolation, quiz integrity, capacity, paywall, rate limits, erasure.
- Unit tests: SQL builder, signed tokens, JWT verification (wrong key/issuer/audience/expiry, `alg: none`), CSV/embed safety, errors, config/legal.
- `scripts/smoke.mjs` — drives the **production build** over HTTP with a stub auth issuer: forged/expired tokens, legal gate, tenant isolation, plan cap, student flow, rate limiting, cron auth, CSP nonce on every script, headers, public pages.
