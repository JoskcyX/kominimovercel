# Architecture

```
 Browser (React) ──► server function (TanStack Start) ──► withDb() ──► Neon Postgres
       │                    │  middleware: JWT / token / role / legal          (role app_runtime + RLS)
       │                    └─► Daily.co · Neon Object Storage (presigned)
       └─► Neon Auth (sign-in, JWT)
```

## A request, step by step

1. The browser signs in with Neon Auth and receives a short-lived **JWT** (`src/lib/auth-client.ts`).
2. A server function is called. Its middleware (`src/lib/middleware.ts`) runs on the server:
   - `authed`/`tutor`/`admin` verify the JWT against Neon's JWKS (`src/server/auth.ts`: EdDSA, issuer and audience pinned), then load the profile (creating it on first sight) and check suspension / accepted legal versions / role.
   - `anonymous` adds a salted hash of the caller's IP, used for rate limits.
3. The handler validates input with zod, then calls `withDb({ userId }, tx => …)`. That opens one transaction, `SET LOCAL ROLE app_runtime`, and binds `app.user_id`. SQL runs with RLS enforcing "your rows only".
4. Students (no account) call `anonymous` functions with a **signed token** (`src/server/capability.ts`). Their writes go through `SECURITY DEFINER` SQL functions that validate everything themselves.
5. Errors are mapped to safe messages (`src/server/errors.ts`); unexpected ones are logged server-side and replaced with a generic message.

## Live updates

There's no realtime socket. Screens poll (1.5–5 s). Public polls are shared per server instance for ~1 s (`src/server/cache.ts`), so 250 students ≈ one database query per second. The quiz clock lives in the database (trigger) and responses carry `server_now`, so a wrong phone clock can't skew timing.

## Files

Uploads: `createUploadUrl` → browser `PUT`s straight to storage → `confirmUpload` asks storage what was really uploaded (size/type) and deletes it if it breaks the rules. Reads: a 5-minute signed URL minted only after the DB says this person may open that file.

## Adding a feature

1. **Schema:** new file `db/migrations/000N_name.sql`. Enable RLS on new tables, add policies for `app_runtime`, and grant only the privileges needed (column-level `UPDATE` for anything sensitive). Anonymous/student actions → a `SECURITY DEFINER` function with `SET search_path` and its own checks.
2. **API:** a `createServerFn` in the right `src/lib/*.functions.ts`, with middleware, `.inputValidator`, and `withDb`.
3. **UI:** call it from a route/component with React Query.
4. **Tests:** add cases to `src/server/db.integration.test.ts` (security-relevant SQL) and/or a unit test.
5. Run the checks listed in `AGENTS.md`.

## Directory map

| Path | Purpose |
| --- | --- |
| `src/server/` | `env`, `db`, `auth`, `capability`, `rate-limit`, `storage`, `daily`, `cache`, `security-headers`, `cron-auth`, `kit` (shared imports) |
| `src/lib/*.functions.ts` | API by area: `quizzes`, `play` (students), `classes`, `member` (students), `live`, `files`, `courses`, `me`, `admin` |
| `src/lib/middleware.ts` | The audience middleware |
| `src/server.ts` | Server entry: CSP nonce + security headers + error page |
| `db/migrations/` | `0001` foundation · `0002` quizzes · `0003` courses · `0004` classes · `0005` billing · `0006` admin & privacy |
