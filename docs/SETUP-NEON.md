# Setup: Neon + Vercel

About 30 minutes. You'll create a Neon project (database + auth + file storage), a Daily account for live video, and deploy to Vercel.

> Neon Auth and Neon Object Storage are newer products and parts of them are in **beta**. Their consoles and option names change — if a step below doesn't match what you see, follow Neon's current docs for the same task. Nothing in this repo has been run against *your* Neon project yet; use `npm run check:env` to verify each step.

## 1. Create the Neon project

1. Create a project at <https://console.neon.tech>. Pick the region closest to your students. For Object Storage, choose a region it supports (check Neon's Object Storage docs).
2. Note two connection strings (Console → Connect):
   - **Direct** (no `-pooler` in the host) → used for migrations → `DATABASE_URL_MIGRATIONS`
   - **Pooled** (`-pooler` host) → used by the running app → `DATABASE_URL`

## 2. Enable Neon Auth

1. Console → your branch → **Auth** → enable.
2. Copy the **Auth URL** into both `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL`.
3. Add your **trusted origins / redirect domains**: `http://localhost:3000` and your production URL (e.g. `https://your-app.vercel.app` and any custom domain). Without this, sign-in and password-reset redirects are blocked.
4. Turn on **email verification** (recommended) and review the email-provider settings (Neon sends verification/reset emails by default; you can bring your own SMTP).
5. Users appear in the `neon_auth` schema. The app does not depend on that schema — it creates its own `profiles` row the first time someone signs in.

## 3. Database: migrate, then create the runtime login

```bash
cp .env.example .env.local        # fill in DATABASE_URL_MIGRATIONS first
npm run db:migrate
```

The migrations create a role `app_runtime` (no login, no superuser, no RLS bypass). **Give it a login with SQL — do not create it in the Neon Console** (console-created roles can be put in `neon_superuser`, which defeats the point):

```sql
-- run as the owner, in the Neon SQL editor
ALTER ROLE app_runtime LOGIN PASSWORD '<a long random password>';
```

Build the runtime connection string from your **pooled** host with user `app_runtime`, and put it in `DATABASE_URL`:

```
postgresql://app_runtime:<password>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require
```

(If you'd rather use the owner connection string for `DATABASE_URL` while getting started, the app still switches to `app_runtime` on every request — but a dedicated login is better.)

Run `npm run check:env`. It must report: migrations applied, `app_runtime` has no RLS bypass **and no role memberships**, RLS on every table.

## 4. Object Storage (class files)

1. Create a bucket (default name `class-files`, or set `STORAGE_BUCKET`).
2. Create an access key → `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; endpoint → `AWS_ENDPOINT_URL_S3`; region → `AWS_REGION`.
3. Allow browser uploads (CORS), once per origin set:
   ```bash
   APP_ORIGINS="https://your-app.vercel.app,http://localhost:3000" npm run storage:cors
   ```
Files are private. The app only ever hands out 5-minute signed links after checking who's asking.

## 5. Secrets and live video

```bash
openssl rand -base64 48   # → SESSION_SECRET   (signs student tokens; rotate by moving the old one to SESSION_SECRET_PREVIOUS)
openssl rand -base64 48   # → CRON_SECRET
```
Create a Daily.co account → API key → `DAILY_API_KEY`.

## 6. Deploy to Vercel

1. Import the repo into Vercel (framework: auto-detected; the build already targets Vercel).
2. Add every variable from `.env.example` in **Project → Settings → Environment Variables**. `VITE_*` values are baked in at **build** time, so set them before deploying (and redeploy if you change them).
3. Set `VITE_SITE_URL` to your real origin and `TRUST_PROXY=true`.
4. Put your Vercel functions in the same region as your Neon database (Project → Settings → Functions) to cut latency.
5. **Idle-class cron.** Add `vercel.json` to close live rooms nobody is in for 5 minutes:
   ```json
   { "crons": [{ "path": "/api/public/jobs/close-idle-classes", "schedule": "*/5 * * * *" }] }
   ```
   Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. **Hobby plans only allow daily cron jobs** — on Hobby, use a daily schedule or call `POST /api/public/jobs/close-idle-classes` with the bearer secret from an external scheduler. Without the job, nothing breaks: tutors end classes themselves, and Daily rooms expire after 6 hours.

## 7. First admin

Sign in once with the account that should be the admin, then in the Neon SQL editor:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM public.profiles WHERE email = 'you@example.com';
```
`/admin` then appears for that account. See `ADMIN.md`.

## 8. Bringing data over from Supabase (if you have any)

- **Content** (quizzes, classes, courses): `pg_dump --data-only` the old `public` tables you want, adapt column names (they're unchanged except new columns — consent fields are `NOT NULL`, so supply a value like `legacy`), and load into Neon after migrating. Foreign keys to the old `auth.users` become plain user ids; ids must match the **new** Neon Auth user ids, so users generally need to sign up again (Neon documents bulk-importing users if you need to preserve accounts).
- **Files:** copy objects from the old bucket to the new one with the same `<classId>/<uuid>-<name>` keys, and keep `class_resources.url` as `storage:<key>`.
- If you launched before, the old database had issues listed in `SECURITY.md`; audit imported data (e.g. `profiles.plan`, enrolments with `status = 'paid'`).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Signed in but every call says `UNAUTHENTICATED` | `NEON_AUTH_BASE_URL` wrong, or the Auth URL's origin differs from the token's issuer. Run `npm run check:env` (it fetches the JWKS). |
| Sign-in redirects blocked | Origin not in Neon Auth's trusted origins. |
| Upload fails with a CORS error | Run `npm run storage:cors` for the exact origin you're using. |
| `permission denied for table …` | The runtime role is missing grants — re-run migrations; don't connect as a different role. |
| Everything is slow | Functions and database in different regions; not using the pooled host. |
