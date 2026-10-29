CREATE TYPE public.quiz_status AS ENUM ('draft','lobby','live','ended');
CREATE TYPE public.question_type AS ENUM ('multiple_choice','true_false','short_answer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled quiz',
  join_code text NOT NULL UNIQUE,
  status public.quiz_status NOT NULL DEFAULT 'draft',
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT SELECT ON public.quizzes TO anon;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor manages own quizzes" ON public.quizzes FOR ALL TO authenticated USING (auth.uid() = tutor_id) WITH CHECK (auth.uid() = tutor_id);
CREATE POLICY "public can read quizzes" ON public.quizzes FOR SELECT TO anon USING (true);

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  type public.question_type NOT NULL DEFAULT 'multiple_choice',
  prompt text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL DEFAULT '',
  time_limit int NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_quiz_idx ON public.questions(quiz_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor manages own questions" ON public.questions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.tutor_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.tutor_id = auth.uid()));

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  score int NOT NULL DEFAULT 0,
  total_time_ms bigint NOT NULL DEFAULT 0,
  finished_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX participants_quiz_idx ON public.participants(quiz_id);
GRANT SELECT, INSERT ON public.participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read participants" ON public.participants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone can join" ON public.participants FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.status IN ('lobby','live')));
CREATE POLICY "tutor deletes participants" ON public.participants FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.tutor_id = auth.uid()));

CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  response text NOT NULL DEFAULT '',
  is_correct boolean NOT NULL DEFAULT false,
  time_ms int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_id)
);
GRANT SELECT ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor reads answers" ON public.answers FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.participants p JOIN public.quizzes q ON q.id = p.quiz_id
  WHERE p.id = participant_id AND q.tutor_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.get_quiz_questions(_quiz_id uuid)
RETURNS TABLE (id uuid, order_index int, type public.question_type, prompt text, options jsonb, time_limit int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.order_index, q.type, q.prompt, q.options, q.time_limit
  FROM public.questions q
  JOIN public.quizzes z ON z.id = q.quiz_id
  WHERE q.quiz_id = _quiz_id AND (z.status IN ('live','ended') OR z.tutor_id = auth.uid())
  ORDER BY q.order_index ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_answer(_participant_id uuid, _question_id uuid, _response text, _time_ms int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _correct text; _ok boolean; _qtype public.question_type;
BEGIN
  SELECT correct_answer, type INTO _correct, _qtype FROM public.questions WHERE id = _question_id;
  IF _correct IS NULL THEN RETURN false; END IF;
  IF _qtype = 'short_answer' THEN
    _ok := lower(btrim(coalesce(_response,''))) = lower(btrim(_correct));
  ELSE
    _ok := coalesce(_response,'') = _correct;
  END IF;
  INSERT INTO public.answers (participant_id, question_id, response, is_correct, time_ms)
  VALUES (_participant_id, _question_id, coalesce(_response,''), _ok, greatest(_time_ms,0))
  ON CONFLICT (participant_id, question_id) DO NOTHING;
  UPDATE public.participants p
  SET score = (SELECT count(*) FROM public.answers a WHERE a.participant_id = p.id AND a.is_correct),
      total_time_ms = (SELECT coalesce(sum(a.time_ms),0) FROM public.answers a WHERE a.participant_id = p.id)
  WHERE p.id = _participant_id;
  RETURN _ok;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_answer(uuid, uuid, text, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.finish_participant(_participant_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.participants SET finished_at = now() WHERE id = _participant_id AND finished_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.finish_participant(uuid) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER TABLE public.quizzes REPLICA IDENTITY FULL;
ALTER TABLE public.participants REPLICA IDENTITY FULL;