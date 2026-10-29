CREATE TYPE public.lesson_kind AS ENUM ('video','text');
CREATE TYPE public.enrollment_status AS ENUM ('free','pending','paid');

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled course',
  slug text NOT NULL UNIQUE,
  summary text NOT NULL DEFAULT '',
  cover_url text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT ON public.courses TO anon;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published courses are public" ON public.courses FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "tutor manages own courses" ON public.courses FOR ALL TO authenticated USING (auth.uid() = tutor_id) WITH CHECK (auth.uid() = tutor_id);

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  kind public.lesson_kind NOT NULL DEFAULT 'text',
  video_url text,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT SELECT ON public.lessons TO anon;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons of published courses are public" ON public.lessons FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.is_published));
CREATE POLICY "tutor manages own lessons" ON public.lessons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.tutor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.tutor_id = auth.uid()));

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);
GRANT SELECT, INSERT ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student reads own enrollments" ON public.enrollments FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "tutor reads course enrollments" ON public.enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = enrollments.course_id AND c.tutor_id = auth.uid()));
CREATE POLICY "student enrolls self" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);