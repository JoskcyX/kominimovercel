# Kominimo

Live classes with automatic attendance, quizzes students enjoy, and publishable courses — free for classes of up to **250 students**.

Tutors teach live (video, slides, pop quizzes), students join with a link, a name and a phone/matric number (no account), and every session produces an attendance record and quiz analytics.

## Stack

| Concern | Choice |
| --- | --- |
| App | TanStack Start (React 19, TanStack Router/Query), Tailwind v4, shadcn/ui |
| Database | **Neon Postgres** — reached only from server functions, as a least-privilege role with Row Level Security |
| Auth | **Neon Auth** (Managed Better Auth) — the browser signs in; every server call verifies the JWT |
| Files | **Neon Object Storage** (S3-compatible), private, presigned URLs |
| Live video | Daily.co |
| Hosting | **Vercel** (Nitro `vercel` preset) |

## Quick start

```bash
npm install
cp .env.example .env.local        # fill it in — see docs/SETUP-NEON.md
npm run db:migrate                # applies db/migrations to your Neon database
npm run check:env                 # validates env, DB, role safety, Neon Auth keys
npm run dev                       # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `preview` | Vite dev server / production build / preview |
| `npm run typecheck` · `lint` · `test` | Quality gates |
| `npm run db:migrate` · `db:status` | Apply / list SQL migrations |
| `npm run storage:cors` | One-off: allow browser uploads to your bucket |
| `npm run check:env` | Pre-flight for a new environment |
| `node scripts/smoke.mjs` | End-to-end smoke test of the production build (see `docs/SECURITY.md`) |

## Where things live

```
src/config/        ← EDIT HERE: site name & contact (site.ts), plans & pricing copy (plans.ts), legal versions (legal.ts)
src/content/legal/ ← EDIT HERE: Terms of Use and Privacy Policy text
src/routes/        Pages (public site, /auth, /dashboard, /manage-class, /quiz, /join, /class, /admin, …)
src/lib/*.functions.ts   The server API (one file per area) — what the UI calls
src/server/        Server-only code (DB, auth, storage, rate limits…) — the build refuses to bundle it for browsers
db/migrations/     Ordered SQL — the whole schema, RLS policies and functions
docs/              Setup, architecture, security, admin, customising
```

## Documentation

- [`docs/SETUP-NEON.md`](docs/SETUP-NEON.md) — Neon project, Auth, database roles, storage, Vercel, first admin
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how a request flows, and how to add a feature
- [`docs/SECURITY.md`](docs/SECURITY.md) — controls, what was fixed, residual risks, launch checklist
- [`docs/CUSTOMIZING.md`](docs/CUSTOMIZING.md) — change name, plans, pricing copy, legal text
- [`docs/ADMIN.md`](docs/ADMIN.md) — the admin foundation and how to extend it
- [`roadmap.md`](roadmap.md) · [`docs/north-star.md`](docs/north-star.md)

> **Before launch:** the Terms and Privacy Policy are thorough templates, not legal advice. Have a qualified Nigerian lawyer review them, and fill in `VITE_LEGAL_ENTITY`, `VITE_LEGAL_ADDRESS` and `VITE_CONTACT_EMAIL`.
