-- Libré database schema
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

create table if not exists login_attempts (
  key_hash text primary key,
  attempts integer not null default 0,
  window_expires_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table login_attempts enable row level security;

create index if not exists idx_login_attempts_blocked_until
on login_attempts(blocked_until);

create or replace function public.check_login_rate_limit(p_key_hash text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.login_attempts%rowtype;
  now_ts timestamptz := now();
begin
  select *
  into attempt_row
  from public.login_attempts
  where key_hash = p_key_hash;

  if not found then
    allowed := true;
    retry_after_seconds := null;
    return next;
    return;
  end if;

  if attempt_row.blocked_until is not null and attempt_row.blocked_until > now_ts then
    allowed := false;
    retry_after_seconds := ceil(extract(epoch from attempt_row.blocked_until - now_ts))::integer;
    return next;
    return;
  end if;

  if attempt_row.window_expires_at <= now_ts then
    delete from public.login_attempts
    where key_hash = p_key_hash;

    allowed := true;
    retry_after_seconds := null;
    return next;
  end if;

  allowed := true;
  retry_after_seconds := null;
  return next;
end;
$$;

revoke all on function public.check_login_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_login_rate_limit(text) to service_role;

create or replace function public.record_login_failure(
  p_key_hash text,
  p_max_attempts integer,
  p_block_seconds integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  current_attempts integer;
  window_expires timestamptz;
begin
  select attempts, window_expires_at
  into current_attempts, window_expires
  from public.login_attempts
  where key_hash = p_key_hash
  for update;

  if not found or window_expires <= now_ts then
    insert into public.login_attempts (
      key_hash,
      attempts,
      window_expires_at,
      blocked_until,
      updated_at
    )
    values (
      p_key_hash,
      1,
      now_ts + make_interval(secs => p_window_seconds),
      null,
      now_ts
    )
    on conflict (key_hash) do update
      set attempts = excluded.attempts,
          window_expires_at = excluded.window_expires_at,
          blocked_until = null,
          updated_at = excluded.updated_at;

    return;
  end if;

  current_attempts := current_attempts + 1;

  if current_attempts >= p_max_attempts then
    update public.login_attempts
    set attempts = current_attempts,
        window_expires_at = now_ts + make_interval(secs => p_block_seconds),
        blocked_until = now_ts + make_interval(secs => p_block_seconds),
        updated_at = now_ts
    where key_hash = p_key_hash;
  else
    update public.login_attempts
    set attempts = current_attempts,
        updated_at = now_ts
    where key_hash = p_key_hash;
  end if;
end;
$$;

revoke all on function public.record_login_failure(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.record_login_failure(text, integer, integer, integer) to service_role;

-- ============================================================
-- ACTIVITY_NOTIFICATIONS TABLE
-- Stores per-user notification entries for calendar activity.
-- ============================================================
create table if not exists activity_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  group_name text,
  group_color text,
  type text not null check (type in ('meeting', 'deadline', 'schedule', 'task')),
  title text not null,
  event_date text,
  event_start_hour numeric,
  event_end_hour numeric,
  link text,
  created_by_name text,
  read_at timestamptz,
  created_at timestamptz default now()
);

alter table activity_notifications enable row level security;

drop policy if exists "users can view own notifications" on activity_notifications;
drop policy if exists "users can insert own notifications" on activity_notifications;
drop policy if exists "users can update own notifications" on activity_notifications;
drop policy if exists "users can delete own notifications" on activity_notifications;

create policy "users can view own notifications"
on activity_notifications
for select
using (user_id = auth.uid());

create policy "users can insert own notifications"
on activity_notifications
for insert
with check (
  (
    group_id is null
    and user_id = auth.uid()
  )
  or (
    group_id is not null
    and public.is_group_member(group_id, auth.uid())
  )
);

create policy "users can update own notifications"
on activity_notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own notifications"
on activity_notifications
for delete
using (user_id = auth.uid());

create index if not exists idx_activity_notifications_user_unread
on activity_notifications(user_id, read_at, created_at desc);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.activity_notifications';
  end if;
end;
$$;

alter table groups add column if not exists archived_at timestamptz;
alter table groups add column if not exists subject text;
alter table groups add column if not exists color text default '#4f46e5';
alter table groups add column if not exists invite_code text unique;
alter table groups add column if not exists methodology text;

-- Enforce allowed methodology values (allow NULL so older rows without a selection are fine)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_methodology_chk';
  EXECUTE $sql$
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_methodology_chk
      CHECK (methodology is null or methodology in ('simple', 'scrum', 'agile', 'kanban')) NOT VALID
  $sql$;
END
$$;

-- Backfill / normalize existing methodology values to canonical slugs.
BEGIN;

UPDATE public.groups
SET methodology = CASE
  WHEN methodology ILIKE 'simple%' OR methodology ILIKE '%Simple%' THEN 'simple'
  WHEN methodology ILIKE 'scrum%' OR methodology ILIKE '%Scrum%' THEN 'scrum'
  WHEN methodology ILIKE 'agile%' OR methodology ILIKE '%Agile%' THEN 'agile'
  WHEN methodology ILIKE 'waterfall%' OR methodology ILIKE '%Waterfall%' THEN 'scrum'
  WHEN methodology ILIKE 'kanban%' OR methodology ILIKE '%Kanban%' THEN 'kanban'
  ELSE NULL
END
WHERE methodology IS NOT NULL
  AND LOWER(methodology) NOT IN ('simple','scrum','agile','kanban');

COMMIT;

-- Validate the constraint now that existing rows have been normalized.
ALTER TABLE public.groups VALIDATE CONSTRAINT groups_methodology_chk;

alter table group_members add column if not exists color text;

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table tasks enable row level security;
alter table sprints enable row level security;
alter table task_comments enable row level security;
alter table group_fund enable row level security;

-- Re-create the profile trigger with safe conflict handling.
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
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        email     = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any existing auth users that have no profile yet.
insert into public.profiles (id, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.email
from auth.users u
on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email     = excluded.email;

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
alter table tasks add column if not exists edited_by uuid references profiles(id);

alter table tasks
drop constraint if exists tasks_status_check;

alter table tasks
add constraint tasks_status_check
check (status in ('todo', 'doing', 'review', 'done', 'blocked'));

alter table sprints
drop constraint if exists sprints_status_check;

alter table sprints
add constraint sprints_status_check
check (status in ('upcoming', 'active', 'done', 'locked'));

create or replace function public.is_group_pm(target_group_id uuid, target_user_id uuid)
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
          and gm.role in ('pm', 'admin', 'owner', 'copm')
  );
$$;

revoke all on function public.is_group_pm(uuid, uuid) from public;
grant execute on function public.is_group_pm(uuid, uuid) to authenticated;

drop policy if exists "members can create tasks in their group" on tasks;
drop policy if exists "members can update tasks in their group" on tasks;
drop policy if exists "members can delete tasks in their group" on tasks;

create policy "members can create tasks in their group"
on tasks
for insert
with check (
  public.is_group_member(group_id, auth.uid())
  and created_by = auth.uid()
);

create policy "members can update tasks in their group"
on tasks
for update
using (public.is_group_member(group_id, auth.uid()))
with check (public.is_group_member(group_id, auth.uid()));

create policy "members can delete tasks in their group"
on tasks
for delete
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "members can view sprints in their group" on sprints;
drop policy if exists "members can create sprints in their group" on sprints;
drop policy if exists "members can update sprints in their group" on sprints;

create policy "members can view sprints in their group"
on sprints
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "members can create sprints in their group"
on sprints
for insert
with check (public.is_group_member(group_id, auth.uid()));

create policy "members can update sprints in their group"
on sprints
for update
using (public.is_group_member(group_id, auth.uid()))
with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "group pms can update groups" on groups;

create policy "group pms can update groups"
on groups
for update
using (public.is_group_pm(id, auth.uid()))
with check (public.is_group_pm(id, auth.uid()));

drop policy if exists "members can view task comments in their group" on task_comments;
drop policy if exists "members can create task comments in their group" on task_comments;

create policy "members can view task comments in their group"
on task_comments
for select
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_comments.task_id
      and public.is_group_member(t.group_id, auth.uid())
  )
);

create policy "members can create task comments in their group"
on task_comments
for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_comments.task_id
      and public.is_group_member(t.group_id, auth.uid())
  )
);

drop policy if exists "authors can update own task comments in their group" on task_comments;
drop policy if exists "authors can delete own task comments in their group" on task_comments;

create policy "authors can update own task comments in their group"
on task_comments
for update
using (
  author_id = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_comments.task_id
      and public.is_group_member(t.group_id, auth.uid())
  )
)
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_comments.task_id
      and public.is_group_member(t.group_id, auth.uid())
  )
);

create policy "authors can delete own task comments in their group"
on task_comments
for delete
using (
  author_id = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_comments.task_id
      and public.is_group_member(t.group_id, auth.uid())
  )
);

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

-- Circle-scoped overrides for personal routines.
create table if not exists circle_routine_overrides (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  personal_routine_id uuid not null references personal_routines(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  hidden boolean not null default false,
  label text,
  details text,
  color text,
  days_of_week integer[],
  start_time text,
  end_time text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (group_id, personal_routine_id, user_id)
);

alter table circle_routine_overrides enable row level security;

drop policy if exists "Members manage own overrides" on circle_routine_overrides;
drop policy if exists "Members read all overrides in their groups" on circle_routine_overrides;

create policy "Members manage own overrides"
on circle_routine_overrides
for all
using (
  user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

create policy "Members read all overrides in their groups"
on circle_routine_overrides
for select
using (public.is_group_member(group_id, auth.uid()));

-- Circle-scoped occurrence overrides (exceptions) for personal routines.
create table if not exists circle_routine_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  routine_id uuid not null references personal_routines(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  override_date date not null,
  is_deleted boolean not null default false,
  label text,
  details text,
  color text,
  start_time text,
  end_time text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (group_id, routine_id, override_date)
);

alter table circle_routine_occurrence_overrides enable row level security;

create policy "Members manage own circle occurrence overrides"
on circle_routine_occurrence_overrides
for all
using (
  user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

create policy "Members read all circle occurrence overrides in their groups"
on circle_routine_occurrence_overrides
for select
using (public.is_group_member(group_id, auth.uid()));

-- ============================================================
-- CIRCLE_MEMBER_ROUTINES
-- Per-member, per-circle recurring routines.
-- Entirely separate from personal_routines so main calendar is unaffected.
-- ============================================================
create table if not exists circle_member_routines (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
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

alter table circle_member_routines enable row level security;

drop policy if exists "group members can view circle routines" on circle_member_routines;
drop policy if exists "users can create own circle routines" on circle_member_routines;
drop policy if exists "users can update own circle routines" on circle_member_routines;
drop policy if exists "users can delete own circle routines" on circle_member_routines;

create policy "group members can view circle routines"
on circle_member_routines for select
using (public.is_group_member(group_id, auth.uid()));

create policy "users can create own circle routines"
on circle_member_routines for insert
with check (user_id = auth.uid() and public.is_group_member(group_id, auth.uid()));

create policy "users can update own circle routines"
on circle_member_routines for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own circle routines"
on circle_member_routines for delete
using (user_id = auth.uid());

-- ============================================================
-- CIRCLE_SCHEDULED_BLOCKS
-- Per-member, per-circle one-off activity blocks.
-- Entirely separate from scheduled_blocks so main calendar is unaffected.
-- ============================================================
create table if not exists circle_scheduled_blocks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
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

alter table circle_scheduled_blocks enable row level security;

drop policy if exists "group members can view circle scheduled blocks" on circle_scheduled_blocks;
drop policy if exists "users can create own circle scheduled blocks" on circle_scheduled_blocks;
drop policy if exists "users can update own circle scheduled blocks" on circle_scheduled_blocks;
drop policy if exists "users can delete own circle scheduled blocks" on circle_scheduled_blocks;

create policy "group members can view circle scheduled blocks"
on circle_scheduled_blocks for select
using (public.is_group_member(group_id, auth.uid()));

create policy "users can create own circle scheduled blocks"
on circle_scheduled_blocks for insert
with check (user_id = auth.uid() and public.is_group_member(group_id, auth.uid()));

create policy "users can update own circle scheduled blocks"
on circle_scheduled_blocks for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own circle scheduled blocks"
on circle_scheduled_blocks for delete
using (user_id = auth.uid());

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'circle_member_routines'
    ) then
      execute 'alter publication supabase_realtime add table public.circle_member_routines';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'circle_scheduled_blocks'
    ) then
      execute 'alter publication supabase_realtime add table public.circle_scheduled_blocks';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'circle_routine_overrides'
    ) then
      execute 'alter publication supabase_realtime add table public.circle_routine_overrides';
    end if;
  end if;
end;
$$;

-- ============================================================
-- SCHEDULES TABLE (group meetings/manual blocks)
-- ============================================================
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  created_by_name text,
  day date not null,
  start_hour numeric not null,
  end_hour numeric not null,
  label text not null,
  sub text default '',
  description text default '',
  type text default 'meeting',
  last_edited_by_name text,
  created_at timestamptz default now()
);

alter table schedules enable row level security;

drop policy if exists "group members can view schedules" on schedules;
drop policy if exists "group members can insert schedules" on schedules;
drop policy if exists "group members can update schedules" on schedules;
drop policy if exists "creators can update schedules" on schedules;
drop policy if exists "creators can delete schedules" on schedules;

create policy "group members can view schedules"
on schedules for select
using (public.is_group_member(group_id, auth.uid()));

create policy "group members can insert schedules"
on schedules for insert
with check (
  auth.uid() is not null
  and member_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

create policy "group members can update schedules"
on schedules for update
using (public.is_group_member(group_id, auth.uid()))
with check (public.is_group_member(group_id, auth.uid()));

create policy "creators can delete schedules"
on schedules for delete
using (auth.uid() is not null and member_id = auth.uid());

-- ============================================================
-- SCHEDULE_INVITES TABLE
-- ============================================================
create table if not exists schedule_invites (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  status text default 'pending',
  read_at timestamptz,
  created_at timestamptz default now(),
  unique(schedule_id, member_id)
);

alter table schedule_invites enable row level security;

drop policy if exists "members can view own invites" on schedule_invites;
drop policy if exists "schedule creators can insert invites" on schedule_invites;
drop policy if exists "members can update own invites" on schedule_invites;
drop policy if exists "schedule creators can delete invites" on schedule_invites;

create policy "members can view own invites"
on schedule_invites for select
using (
  member_id = auth.uid()
  or exists (
    select 1 from schedules s
    where s.id = schedule_invites.schedule_id
      and s.member_id = auth.uid()
  )
);

create policy "schedule creators can insert invites"
on schedule_invites for insert
with check (
  exists (
    select 1 from schedules s
    where s.id = schedule_invites.schedule_id
      and s.member_id = auth.uid()
  )
);

create policy "members can update own invites"
on schedule_invites for update
using (member_id = auth.uid())
with check (member_id = auth.uid());

create policy "schedule creators can delete invites"
on schedule_invites for delete
using (
  exists (
    select 1 from schedules s
    where s.id = schedule_invites.schedule_id
      and s.member_id = auth.uid()
  )
);

-- Ensure description column exists for existing tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schedules' AND column_name='description') THEN
        ALTER TABLE schedules ADD COLUMN description text DEFAULT '';
    END IF;
END $$;
