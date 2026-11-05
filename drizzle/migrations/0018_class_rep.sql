ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS rep_member_id uuid REFERENCES public.class_members(id) ON DELETE SET NULL;

CREATE TABLE public.class_rep_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  rep_name text NOT NULL,
  action text NOT NULL,
  target_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_rep_actions_class_idx ON public.class_rep_actions(class_id, created_at DESC);
GRANT SELECT ON public.class_rep_actions TO authenticated;
GRANT ALL ON public.class_rep_actions TO service_role;
ALTER TABLE public.class_rep_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tutors read rep activity" ON public.class_rep_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.tutor_id = auth.uid()));

-- Returns the class id when the member is the approved rep of their class.
CREATE OR REPLACE FUNCTION public.rep_class_id(_rep_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id FROM public.classes c JOIN public.class_members m ON m.id = c.rep_member_id
  WHERE m.id = _rep_id AND m.status = 'approved'
$$;

CREATE OR REPLACE FUNCTION public.rep_members(_rep_id uuid)
RETURNS TABLE(id uuid, name text, phone text, status class_member_status, last_seen_at timestamptz, left_at timestamptz, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.name, m.phone, m.status, m.last_seen_at, m.left_at, m.joined_at
  FROM public.class_members m
  WHERE m.class_id = public.rep_class_id(_rep_id) AND m.status IN ('pending','approved')
  ORDER BY m.joined_at DESC
$$;

CREATE OR REPLACE FUNCTION public.rep_set_member_status(_rep_id uuid, _member_id uuid, _status class_member_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid := public.rep_class_id(_rep_id); _rep text; _target text;
BEGIN
  IF _cid IS NULL THEN RAISE EXCEPTION 'Not a class rep'; END IF;
  IF _status NOT IN ('approved','rejected') OR _member_id = _rep_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.class_members SET status = _status WHERE id = _member_id AND class_id = _cid AND status = 'pending' RETURNING name INTO _target;
  IF _target IS NULL THEN RETURN; END IF;
  SELECT name INTO _rep FROM public.class_members WHERE id = _rep_id;
  INSERT INTO public.class_rep_actions(class_id, rep_name, action, target_name)
  VALUES (_cid, _rep, CASE WHEN _status = 'approved' THEN 'let in' ELSE 'declined' END, _target);
END $$;

CREATE OR REPLACE FUNCTION public.rep_remove_member(_rep_id uuid, _member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid := public.rep_class_id(_rep_id); _rep text; _target text;
BEGIN
  IF _cid IS NULL THEN RAISE EXCEPTION 'Not a class rep'; END IF;
  IF _member_id = _rep_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.class_members WHERE id = _member_id AND class_id = _cid RETURNING name INTO _target;
  IF _target IS NULL THEN RETURN; END IF;
  SELECT name INTO _rep FROM public.class_members WHERE id = _rep_id;
  INSERT INTO public.class_rep_actions(class_id, rep_name, action, target_name) VALUES (_cid, _rep, 'removed', _target);
END $$;

CREATE OR REPLACE FUNCTION public.rep_log_action(_rep_id uuid, _action text, _target text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid := public.rep_class_id(_rep_id);
BEGIN
  IF _cid IS NULL OR _action NOT IN ('muted','muted everyone') THEN RETURN; END IF;
  INSERT INTO public.class_rep_actions(class_id, rep_name, action, target_name)
  SELECT _cid, name, _action, left(coalesce(_target,''), 80) FROM public.class_members WHERE id = _rep_id;
END $$;

GRANT EXECUTE ON FUNCTION public.rep_class_id(uuid), public.rep_members(uuid), public.rep_set_member_status(uuid, uuid, class_member_status), public.rep_remove_member(uuid, uuid), public.rep_log_action(uuid, text, text) TO anon, authenticated;