-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0001 · Foundation
--
-- Security model (read this before changing anything):
--   • The browser NEVER talks to the database. Only server functions do.
--   • The server connects as the least-privileged role `app_runtime` (or switches to it with
--     SET LOCAL ROLE). It is not the table owner and has no BYPASSRLS, so Row Level Security
--     is a real second line of defence behind the application checks.
--   • Before every request the server sets `app.user_id` (a transaction-local setting) to the
--     verified Neon Auth user id. `app.uid()` reads it. Anonymous requests leave it empty.
--   • Anything students (who have no account) do goes through SECURITY DEFINER functions that
--     take capability ids the server has already verified. Those functions never trust the
--     caller for identity; they validate everything themselves.
--   • Money/role/identity columns are not writable by `app_runtime` directly — only through
--     the purpose-built functions below.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN;
  END IF;
END $$;

-- Let the migration/owner role switch into app_runtime (SET LOCAL ROLE) per request.
DO $$
BEGIN
  EXECUTE format('GRANT app_runtime TO %I', current_user);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not grant app_runtime to %: % (fine if you connect AS app_runtime)', current_user, SQLERRM;
END $$;

CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app, public TO app_runtime;

-- Functions are executable by PUBLIC by default. Close that; grant explicitly instead.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ── Request identity ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- A flag the server sets only for trusted, non-user contexts (payment webhook, scheduled jobs).
CREATE OR REPLACE FUNCTION app.system_context() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.system', true), '')
$$;
GRANT EXECUTE ON FUNCTION app.uid(), app.system_context() TO app_runtime;

-- Short unguessable suffix without needing the pgcrypto extension.
CREATE OR REPLACE FUNCTION app.rand_hex(_n int) RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, _n)
$$;
GRANT EXECUTE ON FUNCTION app.rand_hex(int) TO app_runtime;

-- ── Profiles ──────────────────────────────────────────────────────────────────────────────
-- `id` is the Neon Auth user id (neon_auth."user".id). We deliberately do NOT add a foreign key
-- into the managed neon_auth schema; profiles are created on first authenticated request.
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY,
  display_name  text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 80),
  email         text,
  plan          text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  referral_code text,
  referred_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_referral_code_uniq ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX profiles_referred_by_idx ON public.profiles (referred_by);

CREATE OR REPLACE FUNCTION app.profile_defaults() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := coalesce(nullif(lower(regexp_replace(NEW.display_name, '[^a-zA-Z0-9]+', '', 'g')), ''), 'tutor')
                         || '-' || app.rand_hex(6);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_defaults BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app.profile_defaults();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── Roles (for the future admin dashboard) ───────────────────────────────────────────────
CREATE TABLE public.user_roles (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin','support')),
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app.has_role(_role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = app.uid() AND r.role = _role)
$$;
CREATE OR REPLACE FUNCTION app.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT app.has_role('admin')
$$;
GRANT EXECUTE ON FUNCTION app.has_role(text), app.is_admin() TO app_runtime;

CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO app_runtime
  USING (id = app.uid() OR app.is_admin());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO app_runtime
  USING (id = app.uid()) WITH CHECK (id = app.uid());
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO app_runtime
  USING (user_id = app.uid() OR app.is_admin());

-- Only the display name is directly writable. plan / status / referral fields change through
-- the functions below (or by an admin), never by a plain UPDATE from the app.
GRANT SELECT ON public.profiles TO app_runtime;
GRANT UPDATE (display_name) ON public.profiles TO app_runtime;
GRANT SELECT ON public.user_roles TO app_runtime;

-- ── Legal acceptance (Terms of Use + Privacy Policy), versioned ──────────────────────────
CREATE TABLE public.legal_acceptances (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc         text NOT NULL CHECK (doc IN ('terms','privacy')),
  version     text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_hash     text,
  user_agent  text CHECK (char_length(user_agent) <= 300)
);
CREATE INDEX legal_acceptances_user_idx ON public.legal_acceptances (user_id, doc, accepted_at DESC);
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own acceptances" ON public.legal_acceptances FOR SELECT TO app_runtime
  USING (user_id = app.uid() OR app.is_admin());
GRANT SELECT ON public.legal_acceptances TO app_runtime;

-- ── Audit log ─────────────────────────────────────────────────────────────────────────────
-- Append-only. actor_id deliberately has no FK so history survives account deletion.
CREATE TABLE public.audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    uuid,
  action      text NOT NULL CHECK (char_length(action) <= 80),
  target_type text,
  target_id   text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_action_idx ON public.audit_log (action, created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT TO app_runtime USING (app.is_admin());
CREATE POLICY "write own audit" ON public.audit_log FOR INSERT TO app_runtime
  WITH CHECK (actor_id IS NOT DISTINCT FROM app.uid());
GRANT SELECT, INSERT ON public.audit_log TO app_runtime;

-- ── Rate limiting (fixed window, shared across all server instances) ─────────────────────
CREATE TABLE public.rate_limits (
  bucket       text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;  -- no policies: only the function below touches it

CREATE OR REPLACE FUNCTION app.rate_limit(_bucket text, _window_seconds integer, _max integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _w timestamptz; _h integer;
BEGIN
  IF _window_seconds < 1 OR _max < 1 OR char_length(_bucket) > 200 THEN RAISE EXCEPTION 'bad rate limit arguments'; END IF;
  _w := to_timestamp(floor(extract(epoch FROM clock_timestamp()) / _window_seconds) * _window_seconds);
  INSERT INTO public.rate_limits AS r (bucket, window_start, hits) VALUES (_bucket, _w, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO _h;
  RETURN _h <= _max;
END $$;

CREATE OR REPLACE FUNCTION app.purge_rate_limits() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH d AS (DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day' RETURNING 1)
  SELECT count(*)::int FROM d
$$;
GRANT EXECUTE ON FUNCTION app.rate_limit(text, integer, integer), app.purge_rate_limits() TO app_runtime;

-- ── Contact form ──────────────────────────────────────────────────────────────────────────
CREATE TABLE public.contact_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email      text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  topic      text NOT NULL DEFAULT 'general' CHECK (topic IN ('general','support','sales','privacy','abuse','press')),
  message    text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','resolved','spam')),
  user_id    uuid,
  ip_hash    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_by uuid,
  handled_at timestamptz
);
CREATE INDEX contact_messages_status_idx ON public.contact_messages (status, created_at DESC);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read contact" ON public.contact_messages FOR SELECT TO app_runtime USING (app.is_admin());
GRANT SELECT ON public.contact_messages TO app_runtime;

CREATE OR REPLACE FUNCTION public.submit_contact(_name text, _email text, _topic text, _message text, _ip_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.contact_messages (name, email, topic, message, user_id, ip_hash)
  VALUES (left(btrim(_name), 120), left(btrim(_email), 254), _topic, left(btrim(_message), 5000), app.uid(), _ip_hash)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_contact(text, text, text, text, text) TO app_runtime;

-- ── Session bootstrap: one round-trip that creates the profile on first sight ────────────
CREATE OR REPLACE FUNCTION app.touch_profile(_email text, _name text)
RETURNS TABLE (id uuid, display_name text, email text, plan text, status text, referral_code text,
               referred_by uuid, roles text[], created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE _uid uuid := app.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.profiles AS p (id, display_name, email)
  VALUES (_uid,
          left(coalesce(nullif(btrim(_name), ''), split_part(coalesce(_email, ''), '@', 1)), 80),
          left(_email, 254))
  ON CONFLICT (id) DO UPDATE
    SET email = coalesce(excluded.email, p.email)
    WHERE p.email IS DISTINCT FROM coalesce(excluded.email, p.email);
  RETURN QUERY
    SELECT p.id, p.display_name, p.email, p.plan, p.status, p.referral_code, p.referred_by,
           coalesce((SELECT array_agg(r.role ORDER BY r.role) FROM public.user_roles r WHERE r.user_id = p.id), '{}'::text[]),
           p.created_at
    FROM public.profiles p WHERE p.id = _uid;
END $$;
GRANT EXECUTE ON FUNCTION app.touch_profile(text, text) TO app_runtime;

-- True when the signed-in user has accepted the CURRENT version of every required document.
CREATE OR REPLACE FUNCTION app.legal_current(_terms text, _privacy text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.legal_acceptances WHERE user_id = app.uid() AND doc = 'terms'   AND version = _terms)
     AND EXISTS (SELECT 1 FROM public.legal_acceptances WHERE user_id = app.uid() AND doc = 'privacy' AND version = _privacy)
$$;

CREATE OR REPLACE FUNCTION app.accept_legal(_terms text, _privacy text, _ip_hash text, _ua text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := app.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.legal_acceptances (user_id, doc, version, ip_hash, user_agent)
  SELECT _uid, d.doc, d.version, _ip_hash, left(_ua, 300)
  FROM (VALUES ('terms', _terms), ('privacy', _privacy)) AS d(doc, version)
  WHERE NOT EXISTS (SELECT 1 FROM public.legal_acceptances a WHERE a.user_id = _uid AND a.doc = d.doc AND a.version = d.version);
END $$;
GRANT EXECUTE ON FUNCTION app.legal_current(text, text), app.accept_legal(text, text, text, text) TO app_runtime;

-- Display name changes: the only profile write a normal user can make.
CREATE OR REPLACE FUNCTION app.set_display_name(_name text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.profiles SET display_name = left(btrim(_name), 80) WHERE id = app.uid()
$$;
GRANT EXECUTE ON FUNCTION app.set_display_name(text) TO app_runtime;
