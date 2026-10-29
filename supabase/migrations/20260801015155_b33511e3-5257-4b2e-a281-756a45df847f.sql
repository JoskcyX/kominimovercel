GRANT SELECT ON public.quizzes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;

GRANT INSERT ON public.participants TO anon;
GRANT SELECT, INSERT, DELETE ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;

GRANT SELECT ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT EXECUTE ON FUNCTION public.get_quiz_questions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_answer(uuid, uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_participant(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_board(uuid) TO anon, authenticated;

ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.quizzes REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;