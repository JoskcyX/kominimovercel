-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0002 · Quizzes
-- Students have no account. They are identified by a participant id that only the server hands
-- out (inside a signed token). Every student-facing function below validates its own inputs.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
CREATE TYPE public.quiz_status AS ENUM ('draft','lobby','live','ended');
CREATE TYPE public.question_type AS ENUM ('multiple_choice','true_false','short_answer');

CREATE TABLE public.quizzes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                text NOT NULL DEFAULT 'Untitled quiz' CHECK (char_length(title) <= 120),
  join_code            text NOT NULL UNIQUE,
  status               public.quiz_status NOT NULL DEFAULT 'draft',
  started_at           timestamptz,
  paused               boolean NOT NULL DEFAULT false,
  reveal_answers       boolean NOT NULL DEFAULT false,
  skip_signal          integer NOT NULL DEFAULT 0,
  extend_signal        integer NOT NULL DEFAULT 0,
  extend_seconds       integer NOT NULL DEFAULT 0,
  opens_at             timestamptz,
  closes_at            timestamptz,
  question_deadline_at timestamptz,
  question_paused_at   timestamptz,
  question_started_at  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quizzes_tutor_idx ON public.quizzes (tutor_id, created_at DESC);

CREATE TABLE public.questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  order_index    integer NOT NULL DEFAULT 0,
  type           public.question_type NOT NULL DEFAULT 'multiple_choice',
  prompt         text NOT NULL DEFAULT '' CHECK (char_length(prompt) <= 2000),
  options        jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL DEFAULT '' CHECK (char_length(correct_answer) <= 500),
  time_limit     integer NOT NULL DEFAULT 20 CHECK (time_limit BETWEEN 5 AND 300),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_quiz_idx ON public.questions (quiz_id, order_index);

CREATE TABLE public.participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  name            text NOT NULL,
  phone           text NOT NULL,
  score           integer NOT NULL DEFAULT 0,
  total_time_ms   bigint NOT NULL DEFAULT 0,
  finished_at     timestamptz,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  consent_version text NOT NULL,
  consented_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX participants_quiz_idx ON public.participants (quiz_id);

CREATE TABLE public.answers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  response       text NOT NULL DEFAULT '',
  is_correct     boolean NOT NULL DEFAULT false,
  time_ms        integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_id)
);
CREATE INDEX answers_question_idx ON public.answers (question_id);

ALTER TABLE public.quizzes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor manages own quizzes" ON public.quizzes FOR ALL TO app_runtime
  USING (tutor_id = app.uid()) WITH CHECK (tutor_id = app.uid());
CREATE POLICY "tutor manages own questions" ON public.questions FOR ALL TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.tutor_id = app.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.tutor_id = app.uid()));
CREATE POLICY "tutor reads participants" ON public.participants FOR SELECT TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.tutor_id = app.uid()));
CREATE POLICY "tutor removes participants" ON public.participants FOR DELETE TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.tutor_id = app.uid()));
CREATE POLICY "tutor reads answers" ON public.answers FOR SELECT TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.participants p JOIN public.quizzes q ON q.id = p.quiz_id
                 WHERE p.id = participant_id AND q.tutor_id = app.uid()));

GRANT SELECT, INSERT, DELETE ON public.quizzes TO app_runtime;
GRANT UPDATE (title, status, started_at, paused, reveal_answers, skip_signal, extend_signal, extend_seconds,
              opens_at, closes_at) ON public.quizzes TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO app_runtime;
GRANT SELECT, DELETE ON public.participants TO app_runtime;
GRANT SELECT ON public.answers TO app_runtime;

-- ── Shared question clock ────────────────────────────────────────────────────────────────
-- The database owns the clock so no client can advance early or skew its own timing.
CREATE OR REPLACE FUNCTION public.sync_quiz_question_timer() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE duration integer; shift interval;
BEGIN
  IF NEW.status = 'live' AND (OLD.status IS DISTINCT FROM NEW.status OR NEW.skip_signal IS DISTINCT FROM OLD.skip_signal
                              OR NEW.started_at IS DISTINCT FROM OLD.started_at) THEN
    SELECT time_limit INTO duration FROM public.questions WHERE quiz_id = NEW.id
      ORDER BY order_index, id OFFSET greatest(NEW.skip_signal, 0) LIMIT 1;
    NEW.question_started_at := clock_timestamp();
    NEW.question_deadline_at := clock_timestamp() + make_interval(secs => coalesce(duration, 20));
    NEW.question_paused_at := CASE WHEN NEW.paused THEN clock_timestamp() ELSE NULL END;
  ELSIF NEW.status = 'live' THEN
    IF NEW.paused AND NOT OLD.paused THEN
      NEW.question_paused_at := clock_timestamp();
    ELSIF NOT NEW.paused AND OLD.paused THEN
      shift := clock_timestamp() - coalesce(OLD.question_paused_at, clock_timestamp());
      NEW.question_deadline_at := NEW.question_deadline_at + shift;
      NEW.question_started_at := NEW.question_started_at + shift;
      NEW.question_paused_at := NULL;
    END IF;
    IF NEW.extend_signal IS DISTINCT FROM OLD.extend_signal THEN
      NEW.question_deadline_at := NEW.question_deadline_at + make_interval(secs => greatest(least(NEW.extend_seconds, 300), 0));
    END IF;
  ELSE
    NEW.question_deadline_at := NULL; NEW.question_paused_at := NULL; NEW.question_started_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_quiz_question_timer BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.sync_quiz_question_timer();

-- Any client may ask; only a quiz whose deadline has really passed moves, exactly once.
CREATE OR REPLACE FUNCTION public.advance_quiz_timer(_quiz_id uuid, _expected_index integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE q public.quizzes%ROWTYPE; question_count integer;
BEGIN
  SELECT * INTO q FROM public.quizzes WHERE id = _quiz_id FOR UPDATE;
  IF NOT FOUND OR q.status <> 'live' OR q.paused OR q.skip_signal <> _expected_index
     OR q.question_deadline_at IS NULL OR clock_timestamp() < q.question_deadline_at THEN
    RETURN false;
  END IF;
  SELECT count(*) INTO question_count FROM public.questions WHERE quiz_id = q.id;
  UPDATE public.quizzes
     SET skip_signal = skip_signal + 1,
         status = CASE WHEN skip_signal + 1 >= question_count THEN 'ended'::public.quiz_status ELSE 'live'::public.quiz_status END
   WHERE id = q.id;
  RETURN true;
END $$;

-- Position of a question in its quiz (0-based) — this is what `skip_signal` indexes.
CREATE OR REPLACE FUNCTION app.question_position(_question_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (SELECT count(*) FROM public.questions o
           WHERE o.quiz_id = q.quiz_id AND (o.order_index, o.id) < (q.order_index, q.id))::int
  FROM public.questions q WHERE q.id = _question_id
$$;

-- ── Student-facing reads ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_quiz_public(_code text, _id uuid)
RETURNS TABLE (id uuid, title text, status public.quiz_status, paused boolean, reveal_answers boolean,
               skip_signal integer, extend_signal integer, extend_seconds integer,
               question_deadline_at timestamptz, question_paused_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT q.id, q.title, q.status, q.paused, q.reveal_answers, q.skip_signal, q.extend_signal, q.extend_seconds,
         q.question_deadline_at, q.question_paused_at
  FROM public.quizzes q
  WHERE (_id IS NOT NULL AND q.id = _id) OR (_id IS NULL AND _code IS NOT NULL AND q.join_code = upper(_code))
  LIMIT 1
$$;

-- Prompts and options only. Correct answers never leave the database through this path.
CREATE OR REPLACE FUNCTION public.get_quiz_questions(_quiz_id uuid)
RETURNS TABLE (id uuid, order_index integer, type public.question_type, prompt text, options jsonb, time_limit integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT q.id, q.order_index, q.type, q.prompt, q.options, q.time_limit
  FROM public.questions q JOIN public.quizzes z ON z.id = q.quiz_id
  WHERE q.quiz_id = _quiz_id AND z.status IN ('live','ended')
  ORDER BY q.order_index, q.id
$$;

CREATE OR REPLACE FUNCTION public.quiz_join_open(_quiz_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.quizzes q
    WHERE q.id = _quiz_id AND q.status IN ('lobby','live')
      AND (q.opens_at IS NULL OR q.opens_at <= now()) AND (q.closes_at IS NULL OR q.closes_at > now()))
$$;

CREATE OR REPLACE FUNCTION public.join_quiz(_quiz_id uuid, _name text, _phone text, _consent text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _id uuid; _n text := left(btrim(coalesce(_name, '')), 60); _p text := left(btrim(coalesce(_phone, '')), 40);
BEGIN
  IF coalesce(btrim(_consent), '') = '' THEN RAISE EXCEPTION 'consent_required'; END IF;
  IF char_length(_n) < 2 OR char_length(_p) < 3 THEN RAISE EXCEPTION 'invalid_details'; END IF;
  IF NOT public.quiz_join_open(_quiz_id) THEN RAISE EXCEPTION 'quiz_not_open'; END IF;
  IF (SELECT count(*) FROM public.participants WHERE quiz_id = _quiz_id) >= 5000 THEN RAISE EXCEPTION 'quiz_full'; END IF;
  INSERT INTO public.participants (quiz_id, name, phone, consent_version) VALUES (_quiz_id, _n, _p, left(_consent, 40))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.participant_alive(_participant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.participants p WHERE p.id = _participant_id)
$$;

-- Public leaderboard / lobby list. Names and scores only — never phone numbers.
CREATE OR REPLACE FUNCTION public.get_quiz_board(_quiz_id uuid)
RETURNS TABLE (id uuid, name text, score integer, total_time_ms bigint, finished boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.name, p.score, p.total_time_ms, (p.finished_at IS NOT NULL)
  FROM public.participants p WHERE p.quiz_id = _quiz_id
  ORDER BY p.score DESC, p.total_time_ms ASC, p.joined_at ASC
$$;

CREATE OR REPLACE FUNCTION public.question_progress(_quiz_id uuid, _question_id uuid)
RETURNS TABLE (answered integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (SELECT count(*)::int FROM public.answers a JOIN public.participants p ON p.id = a.participant_id
           WHERE p.quiz_id = _quiz_id AND a.question_id = _question_id),
         (SELECT count(*)::int FROM public.participants p WHERE p.quiz_id = _quiz_id)
$$;

-- ── Answering ────────────────────────────────────────────────────────────────────────────
-- Timing is measured HERE, from the shared clock — a client can't claim it answered in 0 ms.
-- Only the question currently on screen can be answered. Resubmitting returns the originally
-- recorded result, so it can't be used as an oracle to discover the right answer.
CREATE OR REPLACE FUNCTION public.submit_answer(_participant_id uuid, _question_id uuid, _response text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _quiz uuid; _qquiz uuid; _correct text; _qtype public.question_type; _limit integer;
  _status public.quiz_status; _paused boolean; _cursor integer; _started timestamptz; _deadline timestamptz;
  _pos integer; _ok boolean := false; _elapsed integer; _resp text := left(coalesce(_response, ''), 500);
  _existing boolean;
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
    -- The live question, answered in time.
    IF _qtype = 'short_answer' THEN _ok := lower(btrim(_resp)) = lower(btrim(_correct)); ELSE _ok := _resp = _correct; END IF;
    _elapsed := greatest(0, least(floor(extract(epoch FROM clock_timestamp() - _started) * 1000)::int, _limit * 1000 + 300000));
  ELSIF _pos > _cursor AND _status = 'live' THEN
    RAISE EXCEPTION 'question_not_open';
  ELSIF _status = 'live' AND _pos = _cursor AND _paused THEN
    RAISE EXCEPTION 'quiz_paused';
  ELSE
    -- Time ran out / question already passed: recorded as unanswered.
    _ok := false; _resp := ''; _elapsed := _limit * 1000;
  END IF;

  INSERT INTO public.answers (participant_id, question_id, response, is_correct, time_ms)
  VALUES (_participant_id, _question_id, _resp, _ok, _elapsed)
  ON CONFLICT (participant_id, question_id) DO NOTHING;

  UPDATE public.participants p
     SET score = (SELECT count(*) FROM public.answers a WHERE a.participant_id = p.id AND a.is_correct),
         total_time_ms = (SELECT coalesce(sum(a.time_ms), 0) FROM public.answers a WHERE a.participant_id = p.id)
   WHERE p.id = _participant_id;
  RETURN _ok;
END $$;

CREATE OR REPLACE FUNCTION public.finish_participant(_participant_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.participants SET finished_at = now() WHERE id = _participant_id AND finished_at IS NULL
$$;

-- The correct answer is shown only when the tutor enabled reveals, only to a participant who
-- has already answered THAT question — never ahead of time.
CREATE OR REPLACE FUNCTION public.get_answer_key(_participant_id uuid, _question_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT q.correct_answer FROM public.questions q JOIN public.quizzes z ON z.id = q.quiz_id
  WHERE q.id = _question_id AND z.reveal_answers
    AND EXISTS (SELECT 1 FROM public.answers a WHERE a.participant_id = _participant_id AND a.question_id = q.id)
$$;

-- ── Tutor analytics (scoped to the signed-in tutor) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.question_stats(_quiz_id uuid)
RETURNS TABLE (question_id uuid, order_index integer, prompt text, correct_answer text, answered integer,
               correct integer, accuracy numeric, avg_time_ms integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT q.id, q.order_index, q.prompt, q.correct_answer, count(a.id)::int,
         count(a.id) FILTER (WHERE a.is_correct)::int,
         CASE WHEN count(a.id) = 0 THEN 0 ELSE round((count(a.id) FILTER (WHERE a.is_correct))::numeric * 100 / count(a.id), 1) END,
         coalesce(avg(a.time_ms), 0)::int
  FROM public.questions q JOIN public.quizzes z ON z.id = q.quiz_id
  LEFT JOIN public.answers a ON a.question_id = q.id
  WHERE q.quiz_id = _quiz_id AND z.tutor_id = app.uid()
  GROUP BY q.id, q.order_index, q.prompt, q.correct_answer
  ORDER BY q.order_index
$$;

CREATE OR REPLACE FUNCTION public.tutor_student_progress()
RETURNS TABLE (name text, phone text, sessions integer, total_score integer, avg_score numeric,
               avg_time_ms bigint, last_played timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.name, p.phone, count(*)::int, sum(p.score)::int, round(avg(p.score)::numeric, 1),
         round(avg(p.total_time_ms))::bigint, max(p.joined_at)
  FROM public.participants p JOIN public.quizzes z ON z.id = p.quiz_id
  WHERE z.tutor_id = app.uid()
  GROUP BY p.name, p.phone
  ORDER BY sum(p.score) DESC, avg(p.total_time_ms) ASC
$$;

GRANT EXECUTE ON FUNCTION
  public.advance_quiz_timer(uuid, integer), app.question_position(uuid),
  public.get_quiz_public(text, uuid), public.get_quiz_questions(uuid), public.quiz_join_open(uuid),
  public.join_quiz(uuid, text, text, text), public.participant_alive(uuid), public.get_quiz_board(uuid),
  public.question_progress(uuid, uuid), public.submit_answer(uuid, uuid, text), public.finish_participant(uuid),
  public.get_answer_key(uuid, uuid), public.question_stats(uuid), public.tutor_student_progress()
TO app_runtime;
