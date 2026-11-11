-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0003 · Courses
-- Paid-lesson content is protected IN THE DATABASE: lessons are never directly readable by
-- visitors, only through get_course_lessons(), which withholds the body/video of a paid course
-- unless the caller owns it or is enrolled. (The old schema exposed every lesson publicly and
-- hid paid ones only in the browser UI.)
-- ═══════════════════════════════════════════════════════════════════════════════════════════
CREATE TYPE public.lesson_kind AS ENUM ('video','text');
CREATE TYPE public.enrollment_status AS ENUM ('free','pending','paid');

CREATE TABLE public.courses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT 'Untitled course' CHECK (char_length(title) <= 120),
  slug         text NOT NULL UNIQUE,
  summary      text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 2000),
  cover_url    text CHECK (cover_url IS NULL OR cover_url ~ '^https://'),
  price_cents  integer NOT NULL DEFAULT 0 CHECK (price_cents BETWEEN 0 AND 100000000),
  currency     text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','NGN','GBP','EUR')),
  is_published boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courses_tutor_idx ON public.courses (tutor_id, created_at DESC);

CREATE TABLE public.lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  title       text NOT NULL DEFAULT '' CHECK (char_length(title) <= 160),
  kind        public.lesson_kind NOT NULL DEFAULT 'text',
  video_url   text CHECK (video_url IS NULL OR video_url ~ '^https://'),
  body        text NOT NULL DEFAULT '' CHECK (char_length(body) <= 50000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lessons_course_idx ON public.lessons (course_id, order_index);

CREATE TABLE public.enrollments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     public.enrollment_status NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);

ALTER TABLE public.courses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "published courses are public" ON public.courses FOR SELECT TO app_runtime USING (is_published);
CREATE POLICY "tutor manages own courses" ON public.courses FOR ALL TO app_runtime
  USING (tutor_id = app.uid()) WITH CHECK (tutor_id = app.uid());
-- Lessons: owner only. Visitors go through get_course_lessons().
CREATE POLICY "tutor manages own lessons" ON public.lessons FOR ALL TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.tutor_id = app.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.tutor_id = app.uid()));
CREATE POLICY "student reads own enrollments" ON public.enrollments FOR SELECT TO app_runtime USING (student_id = app.uid());
CREATE POLICY "tutor reads course enrollments" ON public.enrollments FOR SELECT TO app_runtime
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.tutor_id = app.uid()));

GRANT SELECT, INSERT, DELETE ON public.courses TO app_runtime;
GRANT UPDATE (title, summary, cover_url, price_cents, currency, is_published) ON public.courses TO app_runtime;
GRANT SELECT, INSERT, DELETE ON public.lessons TO app_runtime;
GRANT SELECT ON public.enrollments TO app_runtime;          -- inserts only via enroll_in_course()

CREATE OR REPLACE FUNCTION public.get_course_lessons(_course_id uuid)
RETURNS TABLE (id uuid, course_id uuid, order_index integer, title text, kind public.lesson_kind,
               video_url text, body text, locked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH c AS (SELECT * FROM public.courses WHERE id = _course_id AND (is_published OR tutor_id = app.uid())),
  access AS (
    SELECT (c.price_cents = 0 OR c.tutor_id = app.uid()
            OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id AND e.student_id = app.uid()
                       AND e.status IN ('free','paid'))) AS ok
    FROM c)
  SELECT l.id, l.course_id, l.order_index, l.title, l.kind,
         CASE WHEN a.ok THEN l.video_url END, CASE WHEN a.ok THEN l.body ELSE '' END, NOT a.ok
  FROM public.lessons l, c, access a WHERE l.course_id = c.id
  ORDER BY l.order_index, l.created_at
$$;

-- Self-enrolment is only ever 'free', and only for free courses. Paid access is granted by the
-- payment flow (not built yet), never by a client-supplied status.
CREATE OR REPLACE FUNCTION public.enroll_in_course(_course_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _price integer;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT price_cents INTO _price FROM public.courses WHERE id = _course_id AND is_published;
  IF NOT FOUND THEN RAISE EXCEPTION 'course_not_found'; END IF;
  IF _price > 0 THEN RAISE EXCEPTION 'payment_required'; END IF;
  INSERT INTO public.enrollments (course_id, student_id, status) VALUES (_course_id, app.uid(), 'free')
  ON CONFLICT (course_id, student_id) DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.get_course_lessons(uuid), public.enroll_in_course(uuid) TO app_runtime;
