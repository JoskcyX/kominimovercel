-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0004 · Classes, live sessions, attendance, materials
-- ═══════════════════════════════════════════════════════════════════════════════════════════
CREATE TYPE public.class_member_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.class_resource_kind AS ENUM ('link','note','video','document');
CREATE TYPE public.class_quiz_mode AS ENUM ('pop','async');

CREATE TABLE public.classes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                  text NOT NULL DEFAULT 'Untitled class' CHECK (char_length(title) <= 120),
  subject                text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 120),
  description            text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  join_code              text NOT NULL UNIQUE,
  admit_mode             text NOT NULL DEFAULT 'manual' CHECK (admit_mode IN ('manual','roster','auto')),
  id_label               text NOT NULL DEFAULT 'phone'  CHECK (id_label IN ('phone','matric')),
  attendance_threshold   integer NOT NULL DEFAULT 75 CHECK (attendance_threshold BETWEEN 1 AND 100),
  -- Maximum approved students. Set from the tutor's plan; enforced by a trigger on class_members.
  member_limit           integer NOT NULL DEFAULT 250 CHECK (member_limit >= 1),
  live_room_name         text,
  live_room_url          text CHECK (live_room_url IS NULL OR live_room_url ~ '^https://'),
  live_started_at        timestamptz,
  live_empty_since       timestamptz,
  session_started_at     timestamptz,
  session_ended_at       timestamptz,
  presenting_resource_id uuid,
  presenting_page        integer NOT NULL DEFAULT 1 CHECK (presenting_page >= 1),
  rep_member_id          uuid,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX classes_tutor_idx ON public.classes (tutor_id, created_at DESC);

CREATE TABLE public.class_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name            text NOT NULL,
  phone           text NOT NULL DEFAULT '',         -- the student's identifier (phone or matric number)
  status          public.class_member_status NOT NULL DEFAULT 'pending',
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz,
  left_at         timestamptz,
  present_seconds integer NOT NULL DEFAULT 0,
  consent_version text NOT NULL,
  consented_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, phone)
);
CREATE INDEX class_members_class_idx ON public.class_members (class_id, status);
ALTER TABLE public.classes ADD CONSTRAINT classes_rep_fk
  FOREIGN KEY (rep_member_id) REFERENCES public.class_members(id) ON DELETE SET NULL;

CREATE TABLE public.class_resources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  kind        public.class_resource_kind NOT NULL DEFAULT 'link',
  url         text CHECK (url IS NULL OR url ~ '^(https://|storage:)'),
  body        text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  order_index integer NOT NULL DEFAULT 0,
  visible     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_resources_class_idx ON public.class_resources (class_id, order_index);
ALTER TABLE public.classes ADD CONSTRAINT classes_presenting_fk
  FOREIGN KEY (presenting_resource_id) REFERENCES public.class_resources(id) ON DELETE SET NULL;

CREATE TABLE public.class_quizzes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  quiz_id    uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  mode       public.class_quiz_mode NOT NULL DEFAULT 'async',
  pushed_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, quiz_id)
);

CREATE TABLE public.class_roster (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  identifier text NOT NULL CHECK (char_length(identifier) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, identifier)
);

CREATE TABLE public.class_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id             uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  started_at           timestamptz NOT NULL,
  ended_at             timestamptz,
  title                text NOT NULL,
  subject              text NOT NULL DEFAULT '',
  join_code            text NOT NULL,
  id_label             text NOT NULL DEFAULT 'phone',
  attendance_threshold integer NOT NULL DEFAULT 75
);
CREATE UNIQUE INDEX class_sessions_start_unique ON public.class_sessions (class_id, started_at);
CREATE UNIQUE INDEX class_sessions_one_active ON public.class_sessions (class_id) WHERE ended_at IS NULL;

CREATE TABLE public.class_session_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL,
  name            text NOT NULL,
  identifier      text NOT NULL DEFAULT '',
  present_seconds integer NOT NULL DEFAULT 0,
  joined_at       timestamptz NOT NULL,
  last_seen_at    timestamptz,
  left_at         timestamptz,
  UNIQUE (session_id, member_id)
);

CREATE TABLE public.class_rep_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  rep_name    text NOT NULL,
  action      text NOT NULL,
  target_name text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_rep_actions_class_idx ON public.class_rep_actions (class_id, created_at DESC);

-- ── Row Level Security: a tutor sees and changes only their own classes ──────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes','class_members','class_resources','class_quizzes','class_roster',
                           'class_sessions','class_session_attendance','class_rep_actions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE POLICY "tutor manages own classes" ON public.classes FOR ALL TO app_runtime
  USING (tutor_id = app.uid()) WITH CHECK (tutor_id = app.uid());
CREATE POLICY "tutor manages class members" ON public.class_members FOR ALL TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()));
CREATE POLICY "tutor manages class resources" ON public.class_resources FOR ALL TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()));
CREATE POLICY "tutor manages class quizzes" ON public.class_quizzes FOR ALL TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid())
              AND EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = quiz_id AND z.tutor_id = app.uid()));
CREATE POLICY "tutor manages class roster" ON public.class_roster FOR ALL TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()));
CREATE POLICY "tutor reads own sessions" ON public.class_sessions FOR SELECT TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()));
CREATE POLICY "tutor reads own attendance" ON public.class_session_attendance FOR SELECT TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.class_sessions s JOIN public.classes c ON c.id = s.class_id
                 WHERE s.id = session_id AND c.tutor_id = app.uid()));
CREATE POLICY "tutor reads rep activity" ON public.class_rep_actions FOR SELECT TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = app.uid()));

GRANT SELECT, INSERT, DELETE ON public.classes TO app_runtime;
GRANT UPDATE (title, subject, description, admit_mode, id_label, attendance_threshold, live_room_name, live_room_url,
              live_started_at, live_empty_since, session_started_at, session_ended_at, presenting_resource_id,
              presenting_page, rep_member_id) ON public.classes TO app_runtime;
GRANT SELECT, DELETE ON public.class_members TO app_runtime;
GRANT UPDATE (status) ON public.class_members TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_resources, public.class_quizzes, public.class_roster TO app_runtime;
GRANT SELECT ON public.class_sessions, public.class_session_attendance, public.class_rep_actions TO app_runtime;

-- ── Capacity (the free-plan student cap) ─────────────────────────────────────────────────
-- Hard backstop: whatever code path tries to admit a student, the class can't exceed its limit.
CREATE OR REPLACE FUNCTION app.enforce_class_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _limit integer; _have integer;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;
  SELECT member_limit INTO _limit FROM public.classes WHERE id = NEW.class_id FOR UPDATE;
  SELECT count(*) INTO _have FROM public.class_members WHERE class_id = NEW.class_id AND status = 'approved' AND id <> NEW.id;
  IF _have >= _limit THEN RAISE EXCEPTION 'class_full'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER class_members_capacity BEFORE INSERT OR UPDATE OF status ON public.class_members
  FOR EACH ROW EXECUTE FUNCTION app.enforce_class_capacity();

CREATE OR REPLACE FUNCTION app.class_has_room(_class_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (SELECT count(*) FROM public.class_members m WHERE m.class_id = c.id AND m.status = 'approved') < c.member_limit
  FROM public.classes c WHERE c.id = _class_id
$$;

-- ── Live session history (database-owned so attendance can't be skewed by a client) ──────
CREATE OR REPLACE FUNCTION public.track_class_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE sid uuid; finish timestamptz;
BEGIN
  IF NEW.live_room_name IS NOT NULL AND (OLD.live_room_name IS NULL OR NEW.session_started_at IS DISTINCT FROM OLD.session_started_at) THEN
    INSERT INTO public.class_sessions (class_id, started_at, title, subject, join_code, id_label, attendance_threshold)
    VALUES (NEW.id, coalesce(NEW.session_started_at, now()), NEW.title, NEW.subject, NEW.join_code, NEW.id_label, NEW.attendance_threshold);
    UPDATE public.class_members SET present_seconds = 0, last_seen_at = NULL, left_at = NULL WHERE class_id = NEW.id;
  ELSIF NEW.live_room_name IS NULL AND OLD.live_room_name IS NOT NULL THEN
    finish := coalesce(NEW.session_ended_at, now());
    SELECT id INTO sid FROM public.class_sessions WHERE class_id = NEW.id AND ended_at IS NULL FOR UPDATE;
    IF sid IS NOT NULL THEN
      UPDATE public.class_session_attendance
         SET present_seconds = present_seconds + CASE WHEN left_at IS NULL AND last_seen_at IS NOT NULL
                                  AND finish - last_seen_at < interval '45 seconds'
                             THEN greatest(0, floor(extract(epoch FROM finish - last_seen_at))::integer) ELSE 0 END,
             left_at = coalesce(left_at, finish)
       WHERE session_id = sid;
      UPDATE public.class_sessions SET ended_at = finish WHERE id = sid;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER track_class_session AFTER UPDATE OF live_room_name, session_started_at ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.track_class_session();

-- ── Student-facing functions ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_class_by_code(_code text)
RETURNS TABLE (id uuid, title text, subject text, description text, id_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.id, c.title, c.subject, c.description, c.id_label FROM public.classes c WHERE c.join_code = upper(_code) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.request_class_join(_class_id uuid, _name text, _identifier text, _consent text)
RETURNS TABLE (member_id uuid, status public.class_member_status)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  _id uuid; _mode text; _st public.class_member_status := 'pending'; _cur public.class_member_status;
  _norm_id text := lower(regexp_replace(coalesce(_identifier, ''), '[^a-zA-Z0-9]', '', 'g'));
  _norm_name text := lower(regexp_replace(coalesce(_name, ''), '[^a-zA-Z0-9]', '', 'g'));
BEGIN
  IF coalesce(btrim(_consent), '') = '' THEN RAISE EXCEPTION 'consent_required'; END IF;
  IF length(_norm_id) < 3 OR length(btrim(coalesce(_name, ''))) < 2 THEN RAISE EXCEPTION 'invalid_details'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_class_id::text || ':' || _norm_id, 0));
  SELECT admit_mode INTO _mode FROM public.classes WHERE id = _class_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'class_not_found'; END IF;

  -- A returning student gets their existing membership back (no duplicates).
  SELECT m.id, m.status INTO _id, _cur FROM public.class_members m
   WHERE m.class_id = _class_id AND lower(regexp_replace(m.phone, '[^a-zA-Z0-9]', '', 'g')) = _norm_id
   ORDER BY (m.status = 'approved') DESC, m.joined_at LIMIT 1;
  IF _id IS NOT NULL THEN RETURN QUERY SELECT _id, _cur; RETURN; END IF;

  IF _mode = 'auto' OR (_mode = 'roster' AND EXISTS (SELECT 1 FROM public.class_roster r WHERE r.class_id = _class_id
        AND lower(regexp_replace(r.identifier, '[^a-zA-Z0-9]', '', 'g')) IN (_norm_id, _norm_name))) THEN
    IF app.class_has_room(_class_id) THEN _st := 'approved'; END IF;   -- full class: wait for the tutor
  END IF;
  INSERT INTO public.class_members (class_id, name, phone, status, consent_version)
  VALUES (_class_id, left(btrim(_name), 60), left(btrim(_identifier), 40), _st, left(_consent, 40))
  RETURNING id INTO _id;
  RETURN QUERY SELECT _id, _st;
END $$;

CREATE OR REPLACE FUNCTION public.get_class_membership(_member_id uuid)
RETURNS TABLE (class_id uuid, name text, status public.class_member_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.class_id, m.name, m.status FROM public.class_members m WHERE m.id = _member_id
$$;

CREATE OR REPLACE FUNCTION public.get_class_resources(_member_id uuid)
RETURNS TABLE (id uuid, title text, kind public.class_resource_kind, url text, body text, order_index integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.id, r.title, r.kind, r.url, r.body, r.order_index
  FROM public.class_resources r JOIN public.class_members m ON m.class_id = r.class_id
  WHERE m.id = _member_id AND m.status = 'approved' AND r.visible
  ORDER BY r.order_index, r.created_at
$$;

CREATE OR REPLACE FUNCTION public.get_class_quizzes(_member_id uuid)
RETURNS TABLE (quiz_id uuid, title text, join_code text, mode public.class_quiz_mode, pushed_at timestamptz,
               quiz_status public.quiz_status, opens_at timestamptz, closes_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT q.id, q.title, q.join_code, cq.mode, cq.pushed_at, q.status, q.opens_at, q.closes_at
  FROM public.class_quizzes cq JOIN public.quizzes q ON q.id = cq.quiz_id
  JOIN public.class_members m ON m.class_id = cq.class_id
  WHERE m.id = _member_id AND m.status = 'approved' AND (cq.mode = 'async' OR cq.pushed_at IS NOT NULL)
  ORDER BY cq.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_class_presentation(_member_id uuid)
RETURNS TABLE (resource_id uuid, title text, page integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.presenting_resource_id, r.title, c.presenting_page
  FROM public.class_members m JOIN public.classes c ON c.id = m.class_id
  LEFT JOIN public.class_resources r ON r.id = c.presenting_resource_id
  WHERE m.id = _member_id AND m.status = 'approved' AND c.presenting_resource_id IS NOT NULL
$$;

-- Everything the server needs to decide whether to hand a student a video-room token.
CREATE OR REPLACE FUNCTION public.member_live(_member_id uuid)
RETURNS TABLE (class_id uuid, status public.class_member_status, name text, live_room_name text,
               live_room_url text, is_rep boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.class_id, m.status, m.name, c.live_room_name, c.live_room_url, (c.rep_member_id = m.id)
  FROM public.class_members m JOIN public.classes c ON c.id = m.class_id WHERE m.id = _member_id
$$;

-- Returns the storage key of a file this member is allowed to open (else nothing).
CREATE OR REPLACE FUNCTION public.class_file_key(_member_id uuid, _resource_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT substr(r.url, 9)
  FROM public.class_resources r JOIN public.class_members m ON m.class_id = r.class_id
  JOIN public.classes c ON c.id = r.class_id
  WHERE m.id = _member_id AND m.status = 'approved' AND r.id = _resource_id AND r.url LIKE 'storage:%'
    AND (r.visible OR c.presenting_resource_id = r.id)
$$;

CREATE OR REPLACE FUNCTION public.live_heartbeat(_member_id uuid, _present boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE m public.class_members%ROWTYPE; c public.classes%ROWTYPE; sid uuid; stamp timestamptz := clock_timestamp(); delta integer;
BEGIN
  SELECT * INTO m FROM public.class_members WHERE id = _member_id AND status = 'approved';
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO c FROM public.classes WHERE id = m.class_id FOR UPDATE;
  IF c.live_room_name IS NULL THEN RETURN; END IF;
  SELECT id INTO sid FROM public.class_sessions WHERE class_id = c.id AND ended_at IS NULL;
  IF sid IS NULL THEN RETURN; END IF;
  SELECT * INTO m FROM public.class_members WHERE id = _member_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- Heartbeats arrive every ~15 s; gaps over 45 s (tab asleep, offline) don't count as time present.
  delta := CASE WHEN m.last_seen_at IS NOT NULL AND m.left_at IS NULL AND stamp - m.last_seen_at < interval '45 seconds'
                THEN greatest(0, floor(extract(epoch FROM stamp - m.last_seen_at))::integer) ELSE 0 END;
  UPDATE public.class_members
     SET present_seconds = present_seconds + delta,
         last_seen_at = CASE WHEN _present THEN stamp ELSE last_seen_at END,
         left_at = CASE WHEN _present THEN NULL ELSE stamp END
   WHERE id = m.id;
  IF _present OR m.last_seen_at IS NOT NULL THEN
    INSERT INTO public.class_session_attendance (session_id, member_id, name, identifier, present_seconds, joined_at, last_seen_at, left_at)
    VALUES (sid, m.id, m.name, m.phone, m.present_seconds + delta, stamp,
            CASE WHEN _present THEN stamp ELSE m.last_seen_at END, CASE WHEN _present THEN NULL ELSE stamp END)
    ON CONFLICT (session_id, member_id) DO UPDATE
      SET present_seconds = excluded.present_seconds, last_seen_at = excluded.last_seen_at, left_at = excluded.left_at;
  END IF;
END $$;

-- ── Tutor actions ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.push_class_quiz(_class_id uuid, _quiz_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = _class_id AND c.tutor_id = app.uid())
     OR NOT EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = _quiz_id AND z.tutor_id = app.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.class_quizzes (class_id, quiz_id, mode, pushed_at) VALUES (_class_id, _quiz_id, 'pop', now())
  ON CONFLICT (class_id, quiz_id) DO UPDATE SET mode = 'pop', pushed_at = now();
  UPDATE public.quizzes SET status = 'live', started_at = coalesce(started_at, now()) WHERE id = _quiz_id AND tutor_id = app.uid();
END $$;

-- Admit waiting students up to the class limit, oldest first. Returns how many got in.
CREATE OR REPLACE FUNCTION public.admit_pending(_class_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _limit integer; _have integer; _room integer; _n integer;
BEGIN
  SELECT member_limit INTO _limit FROM public.classes WHERE id = _class_id AND tutor_id = app.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT count(*) INTO _have FROM public.class_members WHERE class_id = _class_id AND status = 'approved';
  _room := greatest(_limit - _have, 0);
  WITH pick AS (SELECT id FROM public.class_members WHERE class_id = _class_id AND status = 'pending'
                 ORDER BY joined_at LIMIT _room)
  UPDATE public.class_members m SET status = 'approved' FROM pick WHERE m.id = pick.id;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- ── Class rep (a student the tutor trusts to admit and remove others) ────────────────────
CREATE OR REPLACE FUNCTION app.mask_identifier(_v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN char_length(_v) <= 4 THEN repeat('*', char_length(_v))
              ELSE left(_v, 2) || repeat('*', char_length(_v) - 4) || right(_v, 2) END
$$;

CREATE OR REPLACE FUNCTION public.rep_class_id(_rep_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.id FROM public.classes c JOIN public.class_members m ON m.id = c.rep_member_id
  WHERE m.id = _rep_id AND m.status = 'approved'
$$;

-- Reps see a MASKED identifier (privacy: a fellow student has no need for full phone numbers).
CREATE OR REPLACE FUNCTION public.rep_members(_rep_id uuid)
RETURNS TABLE (id uuid, name text, phone text, status public.class_member_status, last_seen_at timestamptz,
               left_at timestamptz, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.id, m.name, app.mask_identifier(m.phone), m.status, m.last_seen_at, m.left_at, m.joined_at
  FROM public.class_members m
  WHERE m.class_id = public.rep_class_id(_rep_id) AND m.status IN ('pending','approved')
  ORDER BY m.joined_at DESC
$$;

CREATE OR REPLACE FUNCTION public.rep_set_member_status(_rep_id uuid, _member_id uuid, _status public.class_member_status) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _cid uuid := public.rep_class_id(_rep_id); _rep text; _target text;
BEGIN
  IF _cid IS NULL THEN RAISE EXCEPTION 'Not a class rep'; END IF;
  IF _status NOT IN ('approved','rejected') OR _member_id = _rep_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.class_members SET status = _status WHERE id = _member_id AND class_id = _cid AND status = 'pending' RETURNING name INTO _target;
  IF _target IS NULL THEN RETURN; END IF;
  SELECT name INTO _rep FROM public.class_members WHERE id = _rep_id;
  INSERT INTO public.class_rep_actions (class_id, rep_name, action, target_name)
  VALUES (_cid, _rep, CASE WHEN _status = 'approved' THEN 'let in' ELSE 'declined' END, _target);
END $$;

CREATE OR REPLACE FUNCTION public.rep_remove_member(_rep_id uuid, _member_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _cid uuid := public.rep_class_id(_rep_id); _rep text; _target text;
BEGIN
  IF _cid IS NULL THEN RAISE EXCEPTION 'Not a class rep'; END IF;
  IF _member_id = _rep_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.class_members WHERE id = _member_id AND class_id = _cid RETURNING name INTO _target;
  IF _target IS NULL THEN RETURN; END IF;
  SELECT name INTO _rep FROM public.class_members WHERE id = _rep_id;
  INSERT INTO public.class_rep_actions (class_id, rep_name, action, target_name) VALUES (_cid, _rep, 'removed', _target);
END $$;

CREATE OR REPLACE FUNCTION public.rep_log_action(_rep_id uuid, _action text, _target text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _cid uuid := public.rep_class_id(_rep_id);
BEGIN
  IF _cid IS NULL OR _action NOT IN ('muted','muted everyone') THEN RETURN; END IF;
  INSERT INTO public.class_rep_actions (class_id, rep_name, action, target_name)
  SELECT _cid, name, _action, left(coalesce(_target, ''), 80) FROM public.class_members WHERE id = _rep_id;
END $$;

-- ── Scheduled job helpers (only usable from a trusted "cron" context) ────────────────────
CREATE OR REPLACE FUNCTION app.live_classes() RETURNS TABLE (id uuid, live_room_name text, live_empty_since timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
BEGIN
  IF app.system_context() <> 'cron' THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT c.id, c.live_room_name, c.live_empty_since FROM public.classes c WHERE c.live_room_name IS NOT NULL;
END $$;
CREATE OR REPLACE FUNCTION app.set_live_empty(_id uuid, _since timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app.system_context() <> 'cron' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.classes SET live_empty_since = _since WHERE id = _id;
END $$;
CREATE OR REPLACE FUNCTION app.close_class_live(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app.system_context() <> 'cron' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.classes SET live_room_name = NULL, live_room_url = NULL, live_started_at = NULL,
         session_ended_at = now(), live_empty_since = NULL WHERE id = _id;
END $$;

GRANT EXECUTE ON FUNCTION
  app.class_has_room(uuid), app.mask_identifier(text), app.live_classes(), app.set_live_empty(uuid, timestamptz), app.close_class_live(uuid),
  public.get_class_by_code(text), public.request_class_join(uuid, text, text, text), public.get_class_membership(uuid),
  public.get_class_resources(uuid), public.get_class_quizzes(uuid), public.get_class_presentation(uuid),
  public.member_live(uuid), public.class_file_key(uuid, uuid), public.live_heartbeat(uuid, boolean),
  public.push_class_quiz(uuid, uuid), public.admit_pending(uuid), public.rep_class_id(uuid), public.rep_members(uuid),
  public.rep_set_member_status(uuid, uuid, public.class_member_status), public.rep_remove_member(uuid, uuid),
  public.rep_log_action(uuid, text, text)
TO app_runtime;
