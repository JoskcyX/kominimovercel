CREATE OR REPLACE FUNCTION public.question_progress(_quiz_id uuid, _question_id uuid)
RETURNS TABLE(answered integer, total integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*)::int FROM public.answers a
       JOIN public.participants p ON p.id = a.participant_id
      WHERE p.quiz_id = _quiz_id AND a.question_id = _question_id),
    (SELECT count(*)::int FROM public.participants p WHERE p.quiz_id = _quiz_id);
$$;

GRANT EXECUTE ON FUNCTION public.question_progress(uuid, uuid) TO anon, authenticated;