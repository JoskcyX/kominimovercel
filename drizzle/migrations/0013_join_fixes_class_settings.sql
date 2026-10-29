CREATE OR REPLACE FUNCTION public.join_quiz(_quiz_id uuid, _name text, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.quiz_join_open(_quiz_id) THEN
    RAISE EXCEPTION 'quiz not open';
  END IF;
  INSERT INTO public.participants (quiz_id, name, phone)
  VALUES (_quiz_id, left(btrim(_name), 60), left(btrim(coalesce(_phone, '')), 40))
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.join_quiz(uuid, text, text) TO anon, authenticated;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS admit_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS id_label text NOT NULL DEFAULT 'phone';

CREATE OR REPLACE FUNCTION public.get_class_join_settings(_code text)
RETURNS TABLE(id_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id_label FROM public.classes c WHERE c.join_code = _code LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_class_join_settings(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_class_join(_class_id uuid, _name text, _phone text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _id uuid; _mode text; _status public.class_member_status := 'pending';
  _norm_id text := lower(regexp_replace(coalesce(_phone, ''), '[^a-zA-Z0-9]', '', 'g'));
  _norm_name text := lower(regexp_replace(coalesce(_name, ''), '[^a-zA-Z0-9]', '', 'g'));
begin
  select admit_mode into _mode from public.classes where id = _class_id;
  if _mode = 'auto' then
    _status := 'approved';
  elsif _mode = 'roster' and exists (
    select 1 from public.class_roster r
    where r.class_id = _class_id
      and lower(regexp_replace(r.identifier, '[^a-zA-Z0-9]', '', 'g')) in (_norm_id, _norm_name)
  ) then
    _status := 'approved';
  end if;
  insert into public.class_members (class_id, name, phone, status)
  values (_class_id, _name, coalesce(_phone, ''), _status)
  on conflict (class_id, phone) do update set name = excluded.name, status = excluded.status
  returning id into _id;
  return _id;
end;
$$;