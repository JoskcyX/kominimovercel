CREATE TABLE public.class_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, identifier)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_roster TO authenticated;
GRANT ALL ON public.class_roster TO service_role;
ALTER TABLE public.class_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor manages class roster" ON public.class_roster FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_roster.class_id AND c.tutor_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_roster.class_id AND c.tutor_id = auth.uid()));

ALTER TABLE public.class_members ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.class_members ADD COLUMN IF NOT EXISTS left_at timestamptz;

CREATE OR REPLACE FUNCTION public.live_heartbeat(_member_id uuid, _present boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.class_members
  SET last_seen_at = CASE WHEN _present THEN now() ELSE last_seen_at END,
      left_at = CASE WHEN _present THEN NULL ELSE now() END
  WHERE id = _member_id AND status = 'approved';
$$;
GRANT EXECUTE ON FUNCTION public.live_heartbeat(uuid, boolean) TO anon, authenticated;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_quiz_id_fkey,
  ADD CONSTRAINT questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
ALTER TABLE public.participants DROP CONSTRAINT IF EXISTS participants_quiz_id_fkey,
  ADD CONSTRAINT participants_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
ALTER TABLE public.class_quizzes DROP CONSTRAINT IF EXISTS class_quizzes_quiz_id_fkey,
  ADD CONSTRAINT class_quizzes_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
ALTER TABLE public.answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey,
  ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;