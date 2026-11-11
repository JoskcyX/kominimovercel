# Working on Kominimo

Read `README.md` first, then `docs/ARCHITECTURE.md`. This file is the short list of rules for anyone (human or AI) changing the code.

## Non-negotiables

1. **The browser never talks to the database.** All data access goes through server functions in `src/lib/*.functions.ts`, which call `withDb()` from `src/server/`. Never add a database client, connection string or secret to client code. Files under any `server/` directory cannot be bundled for the browser — keep it that way.
2. **Every server function declares its audience** with middleware from `src/lib/middleware.ts`: `anonymous` (students/public), `optionalAuthed`, `authed`, `tutor` (signed in + account active + current Terms accepted), or `admin`. No middleware = a bug.
3. **Validate all input** with zod (`.inputValidator(...)`). Shared rules live in `src/lib/validation.ts`.
4. **Use the `sql` tagged template** (it parameterises every value). Never concatenate strings into SQL. Dynamic column lists go through `setClause(patch, allowList)`.
5. **Authorisation is enforced twice**: in the query (`WHERE tutor_id = …`) *and* by Row Level Security. Don't weaken either.
6. **Students are identified by signed tokens** (`src/server/capability.ts`), never by bare ids. A participant/member id is a public label, not a credential.
7. **Money, role and identity columns are never writable by the app role directly.** Change them via the SQL functions in `db/migrations` (they check who is calling).
8. **Never edit an applied migration.** Add a new numbered file. The runner checksums them.
9. **Don't promise what isn't built.** Marketing copy (`src/config/plans.ts`) marks unbuilt features `soon: true`.
10. **Legal text must stay true.** If you add analytics, recording, a new processor or region, update `src/content/legal/*` and bump `LEGAL_VERSIONS` in `src/config/legal.ts` (this re-prompts every tutor to accept).

## Conventions

- Plan limits and prices: only in `src/config/plans.ts`. Site name/contact: only in `src/config/site.ts`.
- New student-facing writes need a rate limit (`rateLimit(tx, bucket, …)` in `src/server/rate-limit.ts`).
- Live updates are **polling** (React Query `refetchInterval`); hot public polls use the 1-second shared cache in `src/server/cache.ts`.
- Keep the look: reuse `surface-card`, `chunky`, `pop-in`, `confetti-bg` and the `Brand` component.
- Don't rewrite published git history (force-push / rebase of shared branches).

## Before you finish

```bash
npm run typecheck && npm run lint && npm test
# with a throwaway Postgres (db name must contain "test"):
TEST_DATABASE_URL=… npm test          # also runs the database security tests
NITRO_PRESET=node-server npm run build && SMOKE_DATABASE_URL=… node scripts/smoke.mjs
```
