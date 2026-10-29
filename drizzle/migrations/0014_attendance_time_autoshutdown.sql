ALTER TABLE public.class_members ADD COLUMN IF NOT EXISTS present_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS session_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_threshold integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS live_empty_since timestamptz;

-- Adds time actually spent in the live class (heartbeats every ~15s; gaps over 45s don't count).
CREATE OR REPLACE FUNCTION public.live_heartbeat(_member_id uuid, _present boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.class_members
  SET present_seconds = present_seconds + CASE
        WHEN last_seen_at IS NOT NULL AND left_at IS NULL AND now() - last_seen_at < interval '45 seconds'
        THEN floor(extract(epoch FROM now() - last_seen_at))::int ELSE 0 END,
      last_seen_at = CASE WHEN _present THEN now() ELSE last_seen_at END,
      left_at = CASE WHEN _present THEN NULL ELSE now() END
  WHERE id = _member_id AND status = 'approved'
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_members.class_id AND c.live_room_name IS NOT NULL);
$$;