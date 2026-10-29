ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reveal_answers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_signal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extend_signal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extend_seconds integer NOT NULL DEFAULT 0;

ALTER TABLE public.answers DROP CONSTRAINT IF EXISTS answers_participant_id_fkey;
ALTER TABLE public.answers
  ADD CONSTRAINT answers_participant_id_fkey
  FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.participant_alive(_participant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.participants p WHERE p.id = _participant_id);
$$;

CREATE OR REPLACE FUNCTION public.get_answer_key(_question_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT q.correct_answer
  FROM public.questions q
  JOIN public.quizzes z ON z.id = q.quiz_id
  WHERE q.id = _question_id AND (z.reveal_answers OR z.tutor_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.question_stats(_quiz_id uuid)
RETURNS TABLE(question_id uuid, order_index integer, prompt text, correct_answer text, answered integer, correct integer, accuracy numeric, avg_time_ms integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT q.id,
         q.order_index,
         q.prompt,
         q.correct_answer,
         count(a.id)::int,
         count(a.id) FILTER (WHERE a.is_correct)::int,
         CASE WHEN count(a.id) = 0 THEN 0
              ELSE round((count(a.id) FILTER (WHERE a.is_correct))::numeric * 100 / count(a.id), 1) END,
         coalesce(avg(a.time_ms), 0)::int
  FROM public.questions q
  JOIN public.quizzes z ON z.id = q.quiz_id
  LEFT JOIN public.answers a ON a.question_id = q.id
  WHERE q.quiz_id = _quiz_id AND z.tutor_id = auth.uid()
  GROUP BY q.id, q.order_index, q.prompt, q.correct_answer
  ORDER BY q.order_index;
$$;

CREATE OR REPLACE FUNCTION public.tutor_student_progress()
RETURNS TABLE(name text, phone text, sessions integer, total_score integer, avg_score numeric, avg_time_ms bigint, last_played timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.name,
         p.phone,
         count(*)::int,
         sum(p.score)::int,
         round(avg(p.score)::numeric, 1),
         round(avg(p.total_time_ms))::bigint,
         max(p.joined_at)
  FROM public.participants p
  JOIN public.quizzes z ON z.id = p.quiz_id
  WHERE z.tutor_id = auth.uid()
  GROUP BY p.name, p.phone
  ORDER BY sum(p.score) DESC, avg(p.total_time_ms) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.participant_alive(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_answer_key(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.question_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_student_progress() TO authenticated;
