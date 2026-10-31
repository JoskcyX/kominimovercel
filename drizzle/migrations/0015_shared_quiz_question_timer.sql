ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS question_deadline_at timestamptz, ADD COLUMN IF NOT EXISTS question_paused_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_quiz_question_timer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE duration integer;
BEGIN
  IF NEW.status = 'live' AND (OLD.status IS DISTINCT FROM NEW.status OR NEW.skip_signal IS DISTINCT FROM OLD.skip_signal OR NEW.started_at IS DISTINCT FROM OLD.started_at) THEN
    SELECT time_limit INTO duration FROM public.questions WHERE quiz_id = NEW.id ORDER BY order_index, id OFFSET greatest(NEW.skip_signal, 0) LIMIT 1;
    NEW.question_deadline_at := clock_timestamp() + make_interval(secs => coalesce(duration, 20));
    NEW.question_paused_at := CASE WHEN NEW.paused THEN clock_timestamp() ELSE NULL END;
  ELSIF NEW.status = 'live' THEN
    IF NEW.paused AND NOT OLD.paused THEN
      NEW.question_paused_at := clock_timestamp();
    ELSIF NOT NEW.paused AND OLD.paused THEN
      NEW.question_deadline_at := NEW.question_deadline_at + (clock_timestamp() - coalesce(OLD.question_paused_at, clock_timestamp()));
      NEW.question_paused_at := NULL;
    END IF;
    IF NEW.extend_signal IS DISTINCT FROM OLD.extend_signal THEN
      NEW.question_deadline_at := NEW.question_deadline_at + make_interval(secs => greatest(NEW.extend_seconds, 0));
    END IF;
  ELSE
    NEW.question_deadline_at := NULL;
    NEW.question_paused_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sync_quiz_question_timer BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.sync_quiz_question_timer();

CREATE OR REPLACE FUNCTION public.advance_quiz_timer(_quiz_id uuid, _expected_index integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.quizzes%ROWTYPE; question_count integer;
BEGIN
  SELECT * INTO q FROM public.quizzes WHERE id = _quiz_id FOR UPDATE;
  IF NOT FOUND OR q.status <> 'live' OR q.paused OR q.skip_signal <> _expected_index OR q.question_deadline_at IS NULL OR clock_timestamp() < q.question_deadline_at THEN
    RETURN false;
  END IF;
  SELECT count(*) INTO question_count FROM public.questions WHERE quiz_id = q.id;
  UPDATE public.quizzes SET skip_signal = skip_signal + 1, status = CASE WHEN skip_signal + 1 >= question_count THEN 'ended'::public.quiz_status ELSE 'live'::public.quiz_status END WHERE id = q.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_quiz_timer(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_quiz_timer(uuid, integer) TO anon, authenticated, service_role;