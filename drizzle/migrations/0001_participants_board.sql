DROP POLICY "anyone can read participants" ON public.participants;
REVOKE SELECT ON public.participants FROM anon;
CREATE POLICY "tutor reads participants" ON public.participants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.tutor_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_quiz_board(_quiz_id uuid)
RETURNS TABLE (id uuid, name text, score int, total_time_ms bigint, finished boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.score, p.total_time_ms, (p.finished_at IS NOT NULL)
  FROM public.participants p
  WHERE p.quiz_id = _quiz_id
  ORDER BY p.score DESC, p.total_time_ms ASC, p.joined_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_quiz_board(uuid) TO anon, authenticated;