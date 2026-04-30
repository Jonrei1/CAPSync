-- CAPSync database schema
-- Safe to re-run in Supabase SQL Editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  member_id uuid references profiles(id) on delete cascade,
  color text,
  role text default 'member',
  joined_at timestamptz default now(),
  unique(group_id, member_id)
);

create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  goal text,
  status text default 'upcoming',
  ai_generated boolean default false,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  sprint_id uuid references sprints(id) on delete set null,
  created_by uuid references profiles(id),
  assigned_to uuid references profiles(id),
  title text not null,
  description text,
  status text default 'todo',
  category text,
  due_date date,
  priority text default 'medium',
  requires_pm_approval boolean default false,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  position integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

create table if not exists group_fund (
  id uuid primary key default gen_random_uuid(),
  group_id uuid unique references groups(id) on delete cascade,
  balance numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table groups add column if not exists archived_at timestamptz;
alter table groups add column if not exists subject text;
alter table groups add column if not exists color text default '#4f46e5';
alter table groups add column if not exists invite_code text unique;
alter table groups add column if not exists methodology text;

alter table group_members add column if not exists color text;

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table tasks enable row level security;
alter table sprints enable row level security;
alter table task_comments enable row level security;
alter table group_fund enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Non-recursive membership helper used by RLS policies.
create or replace function public.is_group_member(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.member_id = target_user_id
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;

-- Clean old/legacy policies first (idempotent reruns).
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can view own or same-group profiles" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

drop policy if exists "member sees own groups" on groups;
drop policy if exists "users can create groups" on groups;
drop policy if exists "group creators can update their groups" on groups;

drop policy if exists "members can view tasks in their group" on tasks;
drop policy if exists "users can view their group fund" on group_fund;

-- Remove all existing policies on group_members to avoid leftover recursive policies.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_members'
  loop
    execute format('drop policy if exists %I on public.group_members', p.policyname);
  end loop;
end;
$$;

-- Profiles policies
create policy "Users can view own or same-group profiles"
on profiles
for select
using (
  auth.uid() = id
  or exists (
    select 1
    from public.group_members gm_target
    where gm_target.member_id = profiles.id
      and public.is_group_member(gm_target.group_id, auth.uid())
  )
);

create policy "Users can insert own profile"
on profiles
for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Group members policies
create policy "group_members_insert_self"
on group_members
for insert
with check (member_id = auth.uid());

create policy "group_members_select_self_or_same_group"
on group_members
for select
using (
  member_id = auth.uid()
  or public.is_group_member(group_id, auth.uid())
);

create policy "group_members_update_self"
on group_members
for update
using (member_id = auth.uid())
with check (member_id = auth.uid());

-- Groups policies
create policy "member sees own groups"
on groups
for select
using (public.is_group_member(id, auth.uid()));

create policy "users can create groups"
on groups
for insert
with check (created_by = auth.uid());

create policy "group creators can update their groups"
on groups
for update
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- Tasks policies
create policy "members can view tasks in their group"
on tasks
for select
using (public.is_group_member(group_id, auth.uid()));

-- Group fund policies
create policy "users can view their group fund"
on group_fund
for select
using (public.is_group_member(group_id, auth.uid()));

-- Calendar data model extensions
alter table tasks add column if not exists starts_at timestamptz;
alter table tasks add column if not exists ends_at timestamptz;
alter table tasks add column if not exists is_all_day boolean default false;

create table if not exists personal_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  details text,
  color text default '#374151',
  days_of_week smallint[] not null,
  start_time time not null,
  end_time time not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table personal_routines enable row level security;

drop policy if exists "users can view own routines" on personal_routines;
drop policy if exists "group members can view co-member routines" on personal_routines;
drop policy if exists "users can create own routines" on personal_routines;
drop policy if exists "users can update own routines" on personal_routines;
drop policy if exists "users can delete own routines" on personal_routines;

create policy "users can view own routines"
on personal_routines
for select
using (user_id = auth.uid());

create policy "group members can view co-member routines"
on personal_routines
for select
using (
  exists (
    select 1
    from public.group_members gm_self
    join public.group_members gm_owner
      on gm_self.group_id = gm_owner.group_id
    where gm_self.member_id = auth.uid()
      and gm_owner.member_id = personal_routines.user_id
  )
);

create policy "users can create own routines"
on personal_routines
for insert
with check (user_id = auth.uid());

create policy "users can update own routines"
on personal_routines
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own routines"
on personal_routines
for delete
using (user_id = auth.uid());

-- Stores per-day overrides or deletions for recurring routines.
create table if not exists routine_overrides (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references personal_routines(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  override_date date not null,
  label text,
  color text,
  start_time time,
  end_time time,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  unique(routine_id, override_date)
);

alter table routine_overrides enable row level security;

drop policy if exists "users can manage own overrides" on routine_overrides;

create policy "users can manage own overrides"
on routine_overrides
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- One-off activity blocks tied to a specific date. No recurrence.
create table if not exists scheduled_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  details text,
  color text default '#374151',
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table scheduled_blocks enable row level security;

drop policy if exists "users can manage own scheduled blocks" on scheduled_blocks;

create policy "users can manage own scheduled blocks"
on scheduled_blocks
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
