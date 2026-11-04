CREATE OR REPLACE FUNCTION public.request_class_join(_class_id uuid, _name text, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _mode text; _status public.class_member_status := 'pending';
_norm_id text := lower(regexp_replace(coalesce(_phone,''),'[^a-zA-Z0-9]','','g'));
_norm_name text := lower(regexp_replace(coalesce(_name,''),'[^a-zA-Z0-9]','','g'));
BEGIN
IF length(_norm_id) < 3 OR length(btrim(_name)) < 2 THEN RAISE EXCEPTION 'Enter your name and identifier'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_class_id::text || ':' || _norm_id,0));
SELECT admit_mode INTO _mode FROM public.classes WHERE id=_class_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;
SELECT id INTO _id FROM public.class_members WHERE class_id=_class_id AND lower(regexp_replace(phone,'[^a-zA-Z0-9]','','g'))=_norm_id ORDER BY (status='approved') DESC,joined_at LIMIT 1;
IF _id IS NOT NULL THEN RETURN _id; END IF;
IF _mode='auto' OR (_mode='roster' AND EXISTS (SELECT 1 FROM public.class_roster r WHERE r.class_id=_class_id AND lower(regexp_replace(r.identifier,'[^a-zA-Z0-9]','','g')) IN (_norm_id,_norm_name))) THEN _status:='approved'; END IF;
INSERT INTO public.class_members(class_id,name,phone,status) VALUES(_class_id,left(btrim(_name),60),left(btrim(_phone),40),_status) RETURNING id INTO _id;
RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.request_class_join(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_class_join(uuid,text,text) TO anon,authenticated;
