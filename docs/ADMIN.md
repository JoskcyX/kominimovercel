# Admin foundation

A starter admin area exists at `/admin` (stats, users with suspend/plan toggle, contact inbox). It is deliberately small: the point is the **safe plumbing** so you can grow it.

## What's in place

- **Roles:** table `user_roles` (`admin`, `support`). `app.is_admin()` / `app.has_role()` read it.
- **Guards, three layers:** the route (`beforeLoad`, UX only) → the `admin` server-function middleware → `app.require_admin()` *inside every admin SQL function*.
- **Audit log:** `audit_log` is append-only. Admin SQL functions that change anything write to it. Admins can read it (RLS).
- **Suspension:** `profiles.status = 'suspended'` blocks all tutor features immediately (the `tutor` middleware checks it on every call).
- **Plan changes:** `admin_set_user_plan` updates the plan *and* resizes that tutor's class capacity in one step.

## Making someone an admin

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM public.profiles WHERE email = 'you@example.com';
```

## Adding an admin feature

1. **SQL** (new migration): a `SECURITY DEFINER` function that starts with `PERFORM app.require_admin();`, validates its arguments, and inserts an `audit_log` row if it changes data.
   ```sql
   CREATE FUNCTION public.admin_do_thing(_id uuid) RETURNS void
   LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
   BEGIN
     PERFORM app.require_admin();
     -- …do the thing…
     INSERT INTO public.audit_log (actor_id, action, target_type, target_id) VALUES (app.uid(), 'admin.thing', 'x', _id::text);
   END $$;
   GRANT EXECUTE ON FUNCTION public.admin_do_thing(uuid) TO app_runtime;
   ```
2. **API:** in `src/lib/admin.functions.ts`, `createServerFn(...).middleware([admin]).inputValidator(...)`.
3. **UI:** a route under `src/routes/_authenticated/admin/` (copy `index.tsx`'s guard).

Ideas that fit this pattern: audit-log viewer, refund/credit tools, referral payouts, class/quiz moderation, support impersonation (log it!), feature flags table.

## Roles beyond admin

`support` exists in the schema for read-mostly staff. To use it, add a `support` middleware next to `admin` in `src/lib/middleware.ts` and a matching `app.require_support()` in SQL.
