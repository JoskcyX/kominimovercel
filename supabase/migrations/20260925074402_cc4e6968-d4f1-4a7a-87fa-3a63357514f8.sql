-- Classes
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled class',
  subject text not null default '',
  description text not null default '',
  join_code text not null unique,
  created_at timestamp with time zone not null default now()
);
grant select, insert, update, delete on public.classes to authenticated;
grant all on public.classes to service_role;
alter table public.classes enable row level security;
create policy "tutor manages own classes" on public.classes for all to authenticated
  using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

-- Class members (students join with name + phone, no account)
create type public.class_member_status as enum ('pending', 'approved', 'rejected');
create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  phone text not null default '',
  status public.class_member_status not null default 'pending',
  joined_at timestamp with time zone not null default now(),
  unique (class_id, phone)
);
grant select, insert, update, delete on public.class_members to authenticated;
grant insert on public.class_members to anon;
grant all on public.class_members to service_role;
alter table public.class_members enable row level security;
create policy "anyone can request to join" on public.class_members for insert to anon, authenticated
  with check (true);
create policy "tutor manages class members" on public.class_members for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_members.class_id and c.tutor_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_members.class_id and c.tutor_id = auth.uid()));

-- Class resources
create type public.class_resource_kind as enum ('link', 'note', 'video');
create table public.class_resources (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null default '',
  kind public.class_resource_kind not null default 'link',
  url text,
  body text not null default '',
  order_index integer not null default 0,
  created_at timestamp with time zone not null default now()
);
grant select, insert, update, delete on public.class_resources to authenticated;
grant all on public.class_resources to service_role;
alter table public.class_resources enable row level security;
create policy "tutor manages class resources" on public.class_resources for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_resources.class_id and c.tutor_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_resources.class_id and c.tutor_id = auth.uid()));

-- Quizzes linked to classes
create type public.class_quiz_mode as enum ('pop', 'async');
create table public.class_quizzes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  mode public.class_quiz_mode not null default 'async',
  pushed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  unique (class_id, quiz_id)
);
grant select, insert, update, delete on public.class_quizzes to authenticated;
grant all on public.class_quizzes to service_role;
alter table public.class_quizzes enable row level security;
create policy "tutor manages class quizzes" on public.class_quizzes for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_quizzes.class_id and c.tutor_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_quizzes.class_id and c.tutor_id = auth.uid()));

-- Quiz time windows for async quizzes
alter table public.quizzes
  add column opens_at timestamp with time zone,
  add column closes_at timestamp with time zone;

-- Anon/student RPCs (security definer, same pattern as quiz board)
create or replace function public.get_class_by_code(_code text)
returns table(id uuid, title text, subject text, description text)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.subject, c.description
  from public.classes c where c.join_code = _code limit 1;
$$;

create or replace function public.request_class_join(_class_id uuid, _name text, _phone text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  insert into public.class_members (class_id, name, phone)
  values (_class_id, _name, coalesce(_phone, ''))
  on conflict (class_id, phone) do update set name = excluded.name, status = 'pending'
  returning id into _id;
  return _id;
end;
$$;

create or replace function public.get_class_membership(_member_id uuid)
returns table(class_id uuid, name text, status public.class_member_status)
language sql stable security definer set search_path = public as $$
  select m.class_id, m.name, m.status from public.class_members m where m.id = _member_id;
$$;

create or replace function public.get_class_resources(_member_id uuid)
returns table(id uuid, title text, kind public.class_resource_kind, url text, body text, order_index integer)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.kind, r.url, r.body, r.order_index
  from public.class_resources r
  join public.class_members m on m.class_id = r.class_id
  where m.id = _member_id and m.status = 'approved'
  order by r.order_index asc, r.created_at asc;
$$;

create or replace function public.get_class_quizzes(_member_id uuid)
returns table(quiz_id uuid, title text, join_code text, mode public.class_quiz_mode, pushed_at timestamp with time zone, quiz_status public.quiz_status, opens_at timestamp with time zone, closes_at timestamp with time zone)
language sql stable security definer set search_path = public as $$
  select q.id, q.title, q.join_code, cq.mode, cq.pushed_at, q.status, q.opens_at, q.closes_at
  from public.class_quizzes cq
  join public.quizzes q on q.id = cq.quiz_id
  join public.class_members m on m.class_id = cq.class_id
  where m.id = _member_id and m.status = 'approved'
    and (cq.mode = 'async' or cq.pushed_at is not null)
  order by cq.created_at desc;
$$;

create or replace function public.push_class_quiz(_class_id uuid, _quiz_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.classes c where c.id = _class_id and c.tutor_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  insert into public.class_quizzes (class_id, quiz_id, mode, pushed_at)
  values (_class_id, _quiz_id, 'pop', now())
  on conflict (class_id, quiz_id) do update set mode = 'pop', pushed_at = now();
  update public.quizzes set status = 'live', started_at = coalesce(started_at, now())
  where id = _quiz_id and tutor_id = auth.uid();
end;
$$;

create or replace function public.quiz_join_open(_quiz_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = _quiz_id
      and q.status in ('lobby', 'live')
      and (q.opens_at is null or q.opens_at <= now())
      and (q.closes_at is null or q.closes_at > now())
  );
$$;