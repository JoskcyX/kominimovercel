CREATE TABLE public.class_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL, ended_at timestamptz, title text NOT NULL, subject text NOT NULL DEFAULT '', join_code text NOT NULL,
 id_label text NOT NULL DEFAULT 'phone', attendance_threshold integer NOT NULL DEFAULT 75
);
GRANT SELECT ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor reads own sessions" ON public.class_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id=class_id AND c.tutor_id=auth.uid()));
CREATE UNIQUE INDEX class_sessions_start_unique ON public.class_sessions(class_id,started_at);
CREATE UNIQUE INDEX class_sessions_one_active ON public.class_sessions(class_id) WHERE ended_at IS NULL;
CREATE TABLE public.class_session_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
 member_id uuid NOT NULL, name text NOT NULL, identifier text NOT NULL DEFAULT '', present_seconds integer NOT NULL DEFAULT 0,
 joined_at timestamptz NOT NULL, last_seen_at timestamptz, left_at timestamptz, UNIQUE(session_id,member_id)
);
GRANT SELECT ON public.class_session_attendance TO authenticated;
GRANT ALL ON public.class_session_attendance TO service_role;
ALTER TABLE public.class_session_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor reads own session attendance" ON public.class_session_attendance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.class_sessions s JOIN public.classes c ON c.id=s.class_id WHERE s.id=session_id AND c.tutor_id=auth.uid()));
INSERT INTO public.class_sessions(class_id,started_at,ended_at,title,subject,join_code,id_label,attendance_threshold)
 SELECT id,session_started_at,CASE WHEN live_room_name IS NULL THEN coalesce(session_ended_at,now()) ELSE NULL END,title,subject,join_code,id_label,attendance_threshold FROM public.classes WHERE session_started_at IS NOT NULL;
INSERT INTO public.class_session_attendance(session_id,member_id,name,identifier,present_seconds,joined_at,last_seen_at,left_at)
 SELECT s.id,m.id,m.name,m.phone,m.present_seconds,greatest(m.joined_at,s.started_at),m.last_seen_at,m.left_at FROM public.class_sessions s JOIN public.class_members m ON m.class_id=s.class_id WHERE m.last_seen_at IS NOT NULL OR m.present_seconds>0;
CREATE OR REPLACE FUNCTION public.track_class_session() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; finish timestamptz;
BEGIN
 IF NEW.live_room_name IS NOT NULL AND (OLD.live_room_name IS NULL OR NEW.session_started_at IS DISTINCT FROM OLD.session_started_at) THEN
  INSERT INTO public.class_sessions(class_id,started_at,title,subject,join_code,id_label,attendance_threshold) VALUES(NEW.id,coalesce(NEW.session_started_at,now()),NEW.title,NEW.subject,NEW.join_code,NEW.id_label,NEW.attendance_threshold);
  UPDATE public.class_members SET present_seconds=0,last_seen_at=NULL,left_at=NULL WHERE class_id=NEW.id;
 ELSIF NEW.live_room_name IS NULL AND OLD.live_room_name IS NOT NULL THEN
  finish := coalesce(NEW.session_ended_at,now());
  SELECT id INTO sid FROM public.class_sessions WHERE class_id=NEW.id AND ended_at IS NULL FOR UPDATE;
  IF sid IS NOT NULL THEN
   UPDATE public.class_session_attendance SET present_seconds=present_seconds+CASE WHEN left_at IS NULL AND last_seen_at IS NOT NULL AND finish-last_seen_at < interval '45 seconds' THEN greatest(0,floor(extract(epoch FROM finish-last_seen_at))::integer) ELSE 0 END,left_at=coalesce(left_at,finish) WHERE session_id=sid;
   UPDATE public.class_sessions SET ended_at=finish WHERE id=sid;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER track_class_session AFTER UPDATE OF live_room_name,session_started_at ON public.classes FOR EACH ROW EXECUTE FUNCTION public.track_class_session();
CREATE OR REPLACE FUNCTION public.live_heartbeat(_member_id uuid,_present boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.class_members%ROWTYPE; c public.classes%ROWTYPE; sid uuid; stamp timestamptz := clock_timestamp(); delta integer;
BEGIN
 SELECT * INTO m FROM public.class_members WHERE id=_member_id AND status='approved';
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO c FROM public.classes WHERE id=m.class_id FOR UPDATE;
 IF c.live_room_name IS NULL THEN RETURN; END IF;
 SELECT id INTO sid FROM public.class_sessions WHERE class_id=c.id AND ended_at IS NULL;
 IF sid IS NULL THEN RETURN; END IF;
 SELECT * INTO m FROM public.class_members WHERE id=_member_id AND status='approved' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 delta:=CASE WHEN m.last_seen_at IS NOT NULL AND m.left_at IS NULL AND stamp-m.last_seen_at < interval '45 seconds' THEN greatest(0,floor(extract(epoch FROM stamp-m.last_seen_at))::integer) ELSE 0 END;
 UPDATE public.class_members SET present_seconds=present_seconds+delta,last_seen_at=CASE WHEN _present THEN stamp ELSE last_seen_at END,left_at=CASE WHEN _present THEN NULL ELSE stamp END WHERE id=m.id;
 IF _present OR m.last_seen_at IS NOT NULL THEN
  INSERT INTO public.class_session_attendance(session_id,member_id,name,identifier,present_seconds,joined_at,last_seen_at,left_at)
  VALUES(sid,m.id,m.name,m.phone,m.present_seconds+delta,stamp,CASE WHEN _present THEN stamp ELSE m.last_seen_at END,CASE WHEN _present THEN NULL ELSE stamp END)
  ON CONFLICT(session_id,member_id) DO UPDATE SET present_seconds=EXCLUDED.present_seconds,last_seen_at=EXCLUDED.last_seen_at,left_at=EXCLUDED.left_at;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.track_class_session() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.live_heartbeat(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_heartbeat(uuid,boolean) TO anon,authenticated,service_role;