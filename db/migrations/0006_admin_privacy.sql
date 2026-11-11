-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0006 · Admin foundation + privacy rights
--
-- To make someone an admin (run once, as the owner, after they've signed in at least once):
--   INSERT INTO public.user_roles (user_id, role) VALUES ('<their user id>', 'admin');
-- Every admin function re-checks app.is_admin() and writes an audit_log row.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.require_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT app.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS TABLE (users bigint, pro_users bigint, suspended_users bigint, classes bigint, quizzes bigint,
               courses bigint, live_now bigint, open_messages bigint, signups_7d bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
BEGIN
  PERFORM app.require_admin();
  RETURN QUERY SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.profiles WHERE plan = 'pro'),
    (SELECT count(*) FROM public.profiles WHERE status = 'suspended'),
    (SELECT count(*) FROM public.classes), (SELECT count(*) FROM public.quizzes), (SELECT count(*) FROM public.courses),
    (SELECT count(*) FROM public.classes WHERE live_room_name IS NOT NULL),
    (SELECT count(*) FROM public.contact_messages WHERE status = 'new'),
    (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days');
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(_q text, _limit integer, _offset integer)
RETURNS TABLE (id uuid, display_name text, email text, plan text, status text, created_at timestamptz, roles text[],
               classes bigint, quizzes bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
BEGIN
  PERFORM app.require_admin();
  RETURN QUERY
    SELECT p.id, p.display_name, p.email, p.plan, p.status, p.created_at,
           coalesce((SELECT array_agg(r.role) FROM public.user_roles r WHERE r.user_id = p.id), '{}'::text[]),
           (SELECT count(*) FROM public.classes c WHERE c.tutor_id = p.id),
           (SELECT count(*) FROM public.quizzes z WHERE z.tutor_id = p.id)
    FROM public.profiles p
    WHERE _q IS NULL OR _q = '' OR p.email ILIKE '%' || _q || '%' OR p.display_name ILIKE '%' || _q || '%'
    ORDER BY p.created_at DESC LIMIT least(greatest(_limit, 1), 200) OFFSET greatest(_offset, 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user uuid, _status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM app.require_admin();
  IF _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'bad status'; END IF;
  IF _user = app.uid() THEN RAISE EXCEPTION 'cannot change your own status'; END IF;
  UPDATE public.profiles SET status = _status WHERE id = _user;
  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, meta)
  VALUES (app.uid(), 'admin.user.status', 'user', _user::text, jsonb_build_object('status', _status));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_plan(_user uuid, _plan text, _member_limit integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM app.require_admin();
  PERFORM app.apply_plan(_user, _plan, _member_limit);
  INSERT INTO public.subscription_events (tutor_id, event, meta) VALUES (_user, 'admin_set_' || _plan, jsonb_build_object('by', app.uid()));
  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, meta)
  VALUES (app.uid(), 'admin.user.plan', 'user', _user::text, jsonb_build_object('plan', _plan));
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_contact(_status text, _limit integer)
RETURNS TABLE (id uuid, name text, email text, topic text, message text, status text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
BEGIN
  PERFORM app.require_admin();
  RETURN QUERY SELECT m.id, m.name, m.email, m.topic, m.message, m.status, m.created_at FROM public.contact_messages m
    WHERE _status IS NULL OR m.status = _status ORDER BY m.created_at DESC LIMIT least(greatest(_limit, 1), 200);
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_contact(_id uuid, _status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM app.require_admin();
  IF _status NOT IN ('new','read','resolved','spam') THEN RAISE EXCEPTION 'bad status'; END IF;
  UPDATE public.contact_messages SET status = _status, handled_by = app.uid(), handled_at = now() WHERE id = _id;
END $$;

-- ── Right to erasure ─────────────────────────────────────────────────────────────────────
-- Deletes the signed-in tutor's profile and, by cascade, everything they own (classes, members,
-- attendance, quizzes, participants, answers, courses, enrolments, legal acceptances).
-- Financial records are kept but detached from the person. The audit trail keeps a bare event.
CREATE OR REPLACE FUNCTION public.erase_my_account() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := app.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.contact_messages SET user_id = NULL WHERE user_id = _uid;
  INSERT INTO public.audit_log (actor_id, action, target_type, target_id) VALUES (_uid, 'account.erased', 'user', _uid::text);
  DELETE FROM public.profiles WHERE id = _uid;
END $$;

GRANT EXECUTE ON FUNCTION app.require_admin(), public.admin_stats(), public.admin_list_users(text, integer, integer),
  public.admin_set_user_status(uuid, text), public.admin_set_user_plan(uuid, text, integer),
  public.admin_list_contact(text, integer), public.admin_mark_contact(uuid, text), public.erase_my_account() TO app_runtime;
