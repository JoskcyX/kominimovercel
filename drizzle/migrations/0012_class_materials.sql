ALTER TYPE public.class_resource_kind ADD VALUE IF NOT EXISTS 'document';
ALTER TABLE public.class_resources ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS presenting_resource_id uuid REFERENCES public.class_resources(id) ON DELETE SET NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS presenting_page integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.get_class_resources(_member_id uuid)
 RETURNS TABLE(id uuid, title text, kind class_resource_kind, url text, body text, order_index integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select r.id, r.title, r.kind, r.url, r.body, r.order_index
  from public.class_resources r
  join public.class_members m on m.class_id = r.class_id
  where m.id = _member_id and m.status = 'approved' and r.visible
  order by r.order_index asc, r.created_at asc;
$$;

CREATE OR REPLACE FUNCTION public.get_class_presentation(_member_id uuid)
 RETURNS TABLE(resource_id uuid, title text, page integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select c.presenting_resource_id, r.title, c.presenting_page
  from public.class_members m
  join public.classes c on c.id = m.class_id
  left join public.class_resources r on r.id = c.presenting_resource_id
  where m.id = _member_id and m.status = 'approved' and c.presenting_resource_id is not null;
$$;
GRANT EXECUTE ON FUNCTION public.get_class_presentation(uuid) TO anon, authenticated;