-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0007 · Performance
--
--  • class_snapshot(): everything the student class page needs, for the WHOLE class, in one
--    query. The server caches it for ~1.5 s, so 250 students polling cost ONE query, not 750.
--  • live_heartbeat(): no longer locks the whole class row — heartbeats from different students
--    never block each other (it used to serialise every student in a class on one lock).
--  • submit_answer(): O(1) scoring (increments) instead of re-aggregating every answer.
--  • question_progress(): no join; counts by question directly.
--  • Hot rows get spare page space so frequent updates stay in-page (HOT updates, less bloat).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ── One-shot class snapshot (server verifies the caller's token first, then shares the result) ─
CREATE OR REPLACE FUNCTION public.class_snapshot(_member_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH me AS (SELECT class_id FROM public.class_members WHERE id = _member_id),
       c  AS (SELECT cl.* FROM public.classes cl JOIN me ON me.class_id = cl.id)
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM me) THEN NULL ELSE jsonb_build_object(
    'class_id', (SELECT id FROM c),
    'live',     (SELECT live_room_name IS NOT NULL FROM c),
    'rep',      (SELECT rep_member_id FROM c),
    -- id → [status, name] for every student, so each student's poll is answered from memory
    'members',  (SELECT coalesce(jsonb_object_agg(m.id::text, jsonb_build_array(m.status::text, m.name)), '{}'::jsonb)
                   FROM public.class_members m WHERE m.class_id = (SELECT class_id FROM me)),
    'resources', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'kind', r.kind, 'url', r.url,
                         'body', r.body, 'order_index', r.order_index) ORDER BY r.order_index, r.created_at), '[]'::jsonb)
                   FROM public.class_resources r WHERE r.class_id = (SELECT class_id FROM me) AND r.visible),
    'quizzes',  (SELECT coalesce(jsonb_agg(jsonb_build_object('quiz_id', q.id, 'title', q.title, 'join_code', q.join_code,
                         'mode', cq.mode, 'pushed_at', cq.pushed_at, 'quiz_status', q.status, 'opens_at', q.opens_at,
                         'closes_at', q.closes_at) ORDER BY cq.created_at DESC), '[]'::jsonb)
                   FROM public.class_quizzes cq JOIN public.quizzes q ON q.id = cq.quiz_id
                  WHERE cq.class_id = (SELECT class_id FROM me) AND (cq.mode = 'async' OR cq.pushed_at IS NOT NULL)),
    'presentation', (SELECT jsonb_build_object('resource_id', c.presenting_resource_id, 'title', r.title, 'page', c.presenting_page)
                       FROM c LEFT JOIN public.class_resources r ON r.id = c.presenting_resource_id
                      WHERE c.presenting_resource_id IS NOT NULL)
  ) END
$$;
GRANT EXECUTE ON FUNCTION public.class_snapshot(uuid) TO app_runtime;

-- ── Heartbeat: lock only this student's row ────────────────────────────────────────────────
-- (A heartbeat racing the instant a class ends can at worst lose one ~20 s gap of presence.)
CREATE OR REPLACE FUNCTION public.live_heartbeat(_member_id uuid, _present boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE m public.class_members%ROWTYPE; sid uuid; stamp timestamptz := clock_timestamp(); delta integer;
BEGIN
  SELECT * INTO m FROM public.class_members WHERE id = _member_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT s.id INTO sid FROM public.class_sessions s JOIN public.classes c ON c.id = s.class_id
   WHERE s.class_id = m.class_id AND s.ended_at IS NULL AND c.live_room_name IS NOT NULL;
  IF sid IS NULL THEN RETURN; END IF;
  -- Gaps over 45 s (tab asleep, offline) don't count as time present.
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

-- ── Answering: O(1) scoring ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_answer(_participant_id uuid, _question_id uuid, _response text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _quiz uuid; _qquiz uuid; _correct text; _qtype public.question_type; _limit integer;
  _status public.quiz_status; _paused boolean; _cursor integer; _started timestamptz; _deadline timestamptz;
  _pos integer; _ok boolean := false; _elapsed integer; _resp text := left(coalesce(_response, ''), 500);
  _existing boolean; _n integer;
BEGIN
  SELECT quiz_id INTO _quiz FROM public.participants WHERE id = _participant_id;
  IF _quiz IS NULL THEN RAISE EXCEPTION 'participant_not_found'; END IF;
  SELECT quiz_id, correct_answer, type, time_limit INTO _qquiz, _correct, _qtype, _limit FROM public.questions WHERE id = _question_id;
  IF _qquiz IS NULL OR _qquiz <> _quiz THEN RAISE EXCEPTION 'question_not_in_quiz'; END IF;

  SELECT is_correct INTO _existing FROM public.answers WHERE participant_id = _participant_id AND question_id = _question_id;
  IF FOUND THEN RETURN _existing; END IF;

  SELECT status, paused, skip_signal, question_started_at, question_deadline_at
    INTO _status, _paused, _cursor, _started, _deadline FROM public.quizzes WHERE id = _quiz;
  _pos := app.question_position(_question_id);

  IF _status = 'live' AND _pos = _cursor AND NOT _paused AND _started IS NOT NULL
     AND clock_timestamp() <= _deadline + interval '2 seconds' THEN
    IF _qtype = 'short_answer' THEN _ok := lower(btrim(_resp)) = lower(btrim(_correct)); ELSE _ok := _resp = _correct; END IF;
    _elapsed := greatest(0, least(floor(extract(epoch FROM clock_timestamp() - _started) * 1000)::int, _limit * 1000 + 300000));
  ELSIF _pos > _cursor AND _status = 'live' THEN
    RAISE EXCEPTION 'question_not_open';
  ELSIF _status = 'live' AND _pos = _cursor AND _paused THEN
    RAISE EXCEPTION 'quiz_paused';
  ELSE
    _ok := false; _resp := ''; _elapsed := _limit * 1000;
  END IF;

  INSERT INTO public.answers (participant_id, question_id, response, is_correct, time_ms)
  VALUES (_participant_id, _question_id, _resp, _ok, _elapsed)
  ON CONFLICT (participant_id, question_id) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;

  IF _n = 0 THEN  -- lost a race with an identical concurrent submit: report what was recorded
    SELECT is_correct INTO _existing FROM public.answers WHERE participant_id = _participant_id AND question_id = _question_id;
    RETURN coalesce(_existing, false);
  END IF;
  UPDATE public.participants
     SET score = score + CASE WHEN _ok THEN 1 ELSE 0 END, total_time_ms = total_time_ms + _elapsed
   WHERE id = _participant_id;
  RETURN _ok;
END $$;

-- ── Progress counter: answers belong to exactly one question, so no join is needed ─────────
CREATE OR REPLACE FUNCTION public.question_progress(_quiz_id uuid, _question_id uuid)
RETURNS TABLE (answered integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (SELECT count(*)::int FROM public.answers a
            JOIN public.questions q ON q.id = a.question_id AND q.quiz_id = _quiz_id WHERE a.question_id = _question_id),
         (SELECT count(*)::int FROM public.participants p WHERE p.quiz_id = _quiz_id)
$$;

-- ── Join storms: O(log n) lookups instead of scanning the class and regex-ing every row ────
-- A returning-student check used to regexp every member of the class on every join (O(n²) over a
-- 1,000-student join storm). Normalised copies are stored and indexed once, at write time.
ALTER TABLE public.class_members ADD COLUMN phone_norm text
  GENERATED ALWAYS AS (lower(regexp_replace(phone, '[^a-zA-Z0-9]', '', 'g'))) STORED;
CREATE INDEX class_members_norm_idx ON public.class_members (class_id, phone_norm);
ALTER TABLE public.class_roster ADD COLUMN identifier_norm text
  GENERATED ALWAYS AS (lower(regexp_replace(identifier, '[^a-zA-Z0-9]', '', 'g'))) STORED;
CREATE INDEX class_roster_norm_idx ON public.class_roster (class_id, identifier_norm);

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
  -- Serialises only the SAME student joining twice, never different students.
  PERFORM pg_advisory_xact_lock(hashtextextended(_class_id::text || ':' || _norm_id, 0));
  SELECT admit_mode INTO _mode FROM public.classes WHERE id = _class_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'class_not_found'; END IF;

  SELECT m.id, m.status INTO _id, _cur FROM public.class_members m
   WHERE m.class_id = _class_id AND m.phone_norm = _norm_id
   ORDER BY (m.status = 'approved') DESC, m.joined_at LIMIT 1;
  IF _id IS NOT NULL THEN RETURN QUERY SELECT _id, _cur; RETURN; END IF;

  IF _mode = 'auto' OR (_mode = 'roster' AND EXISTS (SELECT 1 FROM public.class_roster r
        WHERE r.class_id = _class_id AND r.identifier_norm IN (_norm_id, _norm_name))) THEN
    IF app.class_has_room(_class_id) THEN _st := 'approved'; END IF;   -- full class: wait for the tutor
  END IF;
  -- Flood guard: waiting-room rows can't grow without bound (3× the class size, at least 500).
  IF (SELECT count(*) FROM public.class_members WHERE class_id = _class_id)
     >= greatest(3 * (SELECT member_limit FROM public.classes WHERE id = _class_id), 500) THEN
    RAISE EXCEPTION 'class_full';
  END IF;
  INSERT INTO public.class_members (class_id, name, phone, status, consent_version)
  VALUES (_class_id, left(btrim(_name), 60), left(btrim(_identifier), 40), _st, left(_consent, 40))
  RETURNING id INTO _id;
  RETURN QUERY SELECT _id, _st;
END $$;

-- ── Leaderboards that stay small no matter how many students play ──────────────────────────
-- Sending 1,000 rows to 1,000 phones every few seconds is ~100 KB × hundreds of requests/second.
-- Students get the top N plus a total; their own rank is fetched once, on the results screen.
CREATE INDEX participants_board_idx ON public.participants (quiz_id, score DESC, total_time_ms ASC, joined_at ASC);

CREATE OR REPLACE FUNCTION public.get_quiz_board_top(_quiz_id uuid, _limit integer)
RETURNS TABLE (id uuid, name text, score integer, total_time_ms bigint, finished boolean, rank integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH top AS (
    SELECT p.id, p.name, p.score, p.total_time_ms, (p.finished_at IS NOT NULL) AS finished, p.joined_at
      FROM public.participants p WHERE p.quiz_id = _quiz_id
     ORDER BY p.score DESC, p.total_time_ms ASC, p.joined_at ASC LIMIT least(greatest(_limit, 1), 200))
  SELECT t.id, t.name, t.score, t.total_time_ms, t.finished,
         (row_number() OVER (ORDER BY t.score DESC, t.total_time_ms ASC, t.joined_at ASC))::int,
         (SELECT count(*)::int FROM public.participants x WHERE x.quiz_id = _quiz_id)
    FROM top t
   ORDER BY 6
$$;

CREATE OR REPLACE FUNCTION public.get_my_rank(_participant_id uuid)
RETURNS TABLE (id uuid, name text, score integer, total_time_ms bigint, finished boolean, rank integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT me.id, me.name, me.score, me.total_time_ms, (me.finished_at IS NOT NULL),
         1 + (SELECT count(*)::int FROM public.participants o
               WHERE o.quiz_id = me.quiz_id
                 AND (o.score > me.score
                      OR (o.score = me.score AND o.total_time_ms < me.total_time_ms)
                      OR (o.score = me.score AND o.total_time_ms = me.total_time_ms AND o.joined_at < me.joined_at))),
         (SELECT count(*)::int FROM public.participants x WHERE x.quiz_id = me.quiz_id)
    FROM public.participants me WHERE me.id = _participant_id
$$;
GRANT EXECUTE ON FUNCTION public.get_quiz_board_top(uuid, integer), public.get_my_rank(uuid) TO app_runtime;

-- ── Spare space on rows that are updated constantly (heartbeats, scores, quiz clock) ───────
ALTER TABLE public.class_members            SET (fillfactor = 80);
ALTER TABLE public.class_session_attendance SET (fillfactor = 80);
ALTER TABLE public.participants             SET (fillfactor = 80);
ALTER TABLE public.quizzes                  SET (fillfactor = 85);
ALTER TABLE public.classes                  SET (fillfactor = 85);
ALTER TABLE public.rate_limits              SET (fillfactor = 70);
