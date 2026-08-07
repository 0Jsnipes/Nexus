-- Nexus workspace platform schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
-- Requires: pgcrypto (for gen_random_uuid) — enabled by default on Supabase.

-- =========================================================================
-- PROFILES
-- =========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  avatar_url text,
  job_title text,
  bio text,
  status text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by any signed-in user"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "users manage their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- WORKSPACES + MEMBERSHIP + PERMISSIONS
-- =========================================================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  logo_url text,
  owner_id uuid not null references public.profiles (id),
  join_code text not null unique,
  join_code_enabled boolean not null default true,
  require_approval boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'guest')),
  status text not null default 'active' check (status in ('active', 'pending', 'suspended')),
  custom_permissions text[] not null default '{}',
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);
create index workspace_members_workspace_idx on public.workspace_members (workspace_id);

create table public.role_permissions (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'guest')),
  permission text not null,
  primary key (workspace_id, role, permission)
);

-- Security-definer helpers (bypass RLS internally to avoid recursive policy checks).

create or replace function public.is_workspace_member(_workspace_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.workspace_role(_workspace_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from public.workspace_members
  where workspace_id = _workspace_id and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.has_permission(_workspace_id uuid, _permission text)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when public.workspace_role(_workspace_id) = 'owner' then true
    else exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = _workspace_id and wm.user_id = auth.uid() and wm.status = 'active'
        and (
          _permission = any (wm.custom_permissions)
          or exists (
            select 1 from public.role_permissions rp
            where rp.workspace_id = wm.workspace_id and rp.role = wm.role and rp.permission = _permission
          )
        )
    )
  end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.role_permissions enable row level security;

-- Any signed-in user can read a workspace's public profile (needed to look up
-- a workspace by join code before becoming a member, and for invite previews).
create policy "workspaces readable by signed-in users"
  on public.workspaces for select
  using (auth.uid() is not null);

create policy "owner or permitted admin updates workspace"
  on public.workspaces for update
  using (owner_id = auth.uid() or public.has_permission(id, 'manage_workspace_settings'));

create policy "owner deletes workspace"
  on public.workspaces for delete
  using (owner_id = auth.uid());

-- Workspace creation happens through the create_workspace() RPC below, not
-- direct inserts, so no insert policy is needed for authenticated clients.

create policy "members read workspace roster"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id) or user_id = auth.uid());

create policy "members update own row or admins manage roster"
  on public.workspace_members for update
  using (
    (user_id = auth.uid() and role <> 'owner')
    or public.has_permission(workspace_id, 'manage_roles')
  );

create policy "members leave or admins remove members"
  on public.workspace_members for delete
  using (
    (user_id = auth.uid() and role <> 'owner')
    or public.has_permission(workspace_id, 'remove_members')
  );

create policy "members read role permission map"
  on public.role_permissions for select
  using (public.is_workspace_member(workspace_id));

create policy "permitted admins manage role permissions"
  on public.role_permissions for all
  using (public.has_permission(workspace_id, 'manage_roles'))
  with check (public.has_permission(workspace_id, 'manage_roles'));

-- Workspace lifecycle RPCs -------------------------------------------------

create or replace function public.create_workspace(_name text, _slug text default null, _description text default null, _logo_url text default null)
returns public.workspaces
language plpgsql security definer set search_path = public as $$
declare
  _workspace public.workspaces;
  _code text;
begin
  _code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into public.workspaces (name, slug, description, logo_url, owner_id, join_code)
  values (_name, nullif(_slug, ''), nullif(_description, ''), nullif(_logo_url, ''), auth.uid(), _code)
  returning * into _workspace;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (_workspace.id, auth.uid(), 'owner', 'active');

  insert into public.rooms (workspace_id, name, topic, is_private, created_by)
  values (_workspace.id, 'General', 'General discussion', false, auth.uid());

  insert into public.role_permissions (workspace_id, role, permission)
  select _workspace.id, 'admin', p from unnest(array[
    'create_rooms','manage_rooms','delete_rooms','create_projects','manage_projects',
    'create_tasks','manage_tasks','invite_members','remove_members','manage_roles',
    'upload_files','delete_files','create_meetings','manage_meetings',
    'create_calendar_events','manage_messages','view_private_rooms','manage_workspace_settings'
  ]) as p;

  insert into public.role_permissions (workspace_id, role, permission)
  select _workspace.id, 'member', p from unnest(array[
    'create_rooms','create_projects','create_tasks','upload_files',
    'create_meetings','create_calendar_events','manage_messages'
  ]) as p;

  insert into public.role_permissions (workspace_id, role, permission)
  select _workspace.id, 'guest', p from unnest(array['manage_messages']) as p;

  return _workspace;
end;
$$;

create or replace function public.join_workspace(_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  _workspace public.workspaces;
  _existing public.workspace_members;
  _status text;
begin
  select * into _workspace from public.workspaces where join_code = upper(_code);

  if _workspace.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if not _workspace.join_code_enabled then
    return jsonb_build_object('ok', false, 'error', 'code_disabled');
  end if;

  select * into _existing from public.workspace_members
    where workspace_id = _workspace.id and user_id = auth.uid();

  if _existing.user_id is not null then
    return jsonb_build_object('ok', false, 'error', 'already_member', 'workspace_id', _workspace.id, 'status', _existing.status);
  end if;

  _status := case when _workspace.require_approval then 'pending' else 'active' end;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (_workspace.id, auth.uid(), 'member', _status);

  return jsonb_build_object('ok', true, 'workspace_id', _workspace.id, 'status', _status, 'name', _workspace.name);
end;
$$;

create or replace function public.regenerate_join_code(_workspace_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare _code text;
begin
  if not public.has_permission(_workspace_id, 'manage_workspace_settings') then
    raise exception 'not_permitted';
  end if;
  _code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update public.workspaces set join_code = _code where id = _workspace_id;
  return _code;
end;
$$;

create or replace function public.transfer_workspace_ownership(_workspace_id uuid, _new_owner_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select owner_id from public.workspaces where id = _workspace_id) <> auth.uid() then
    raise exception 'not_owner';
  end if;
  if not exists (select 1 from public.workspace_members where workspace_id = _workspace_id and user_id = _new_owner_id and status = 'active') then
    raise exception 'not_a_member';
  end if;
  update public.workspace_members set role = 'admin' where workspace_id = _workspace_id and user_id = auth.uid();
  update public.workspace_members set role = 'owner' where workspace_id = _workspace_id and user_id = _new_owner_id;
  update public.workspaces set owner_id = _new_owner_id where id = _workspace_id;
end;
$$;

-- =========================================================================
-- ROOMS + MESSAGING
-- =========================================================================

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  topic text,
  description text,
  is_private boolean not null default false,
  created_by uuid references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index rooms_workspace_idx on public.rooms (workspace_id);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create or replace function public.can_access_room(_room_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when (select is_private from public.rooms where id = _room_id) is not true
      then public.is_workspace_member((select workspace_id from public.rooms where id = _room_id))
    else
      exists (select 1 from public.room_members where room_id = _room_id and user_id = auth.uid())
      or public.has_permission((select workspace_id from public.rooms where id = _room_id), 'view_private_rooms')
  end;
$$;

create table public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  is_group boolean not null default false,
  name text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dm_members (
  dm_id uuid not null references public.dm_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted boolean not null default false,
  primary key (dm_id, user_id)
);

create or replace function public.can_access_dm(_dm_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.dm_members where dm_id = _dm_id and user_id = auth.uid());
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete cascade,
  dm_id uuid references public.dm_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text,
  reply_to_id uuid references public.messages (id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_channel_check check (
    (room_id is not null and dm_id is null) or (room_id is null and dm_id is not null)
  )
);

create index messages_room_idx on public.messages (room_id, created_at);
create index messages_dm_idx on public.messages (dm_id, created_at);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  url text not null,
  name text,
  type text,
  size bigint,
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.dm_conversations enable row level security;
alter table public.dm_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_attachments enable row level security;

create policy "accessible rooms are readable" on public.rooms for select
  using (public.can_access_room(id));
create policy "permitted members create rooms" on public.rooms for insert
  with check (public.has_permission(workspace_id, 'create_rooms'));
create policy "permitted members update rooms" on public.rooms for update
  using (created_by = auth.uid() or public.has_permission(workspace_id, 'manage_rooms'));
create policy "permitted members delete rooms" on public.rooms for delete
  using (public.has_permission(workspace_id, 'delete_rooms'));

create policy "room roster readable by room members" on public.room_members for select
  using (public.can_access_room(room_id));
create policy "room managers add members" on public.room_members for insert
  with check (public.has_permission((select workspace_id from public.rooms where id = room_id), 'manage_rooms') or user_id = auth.uid());
create policy "room managers remove members" on public.room_members for delete
  using (public.has_permission((select workspace_id from public.rooms where id = room_id), 'manage_rooms') or user_id = auth.uid());

create policy "dm members read conversation" on public.dm_conversations for select
  using (public.can_access_dm(id));
create policy "workspace members start dms" on public.dm_conversations for insert
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "dm members update conversation" on public.dm_conversations for update
  using (public.can_access_dm(id));

create policy "dm members read roster" on public.dm_members for select
  using (public.can_access_dm(dm_id));
create policy "dm participants managed by members" on public.dm_members for insert
  with check (public.can_access_dm(dm_id) or user_id = auth.uid());
create policy "dm members leave or mute" on public.dm_members for update
  using (user_id = auth.uid());
create policy "dm members remove themselves" on public.dm_members for delete
  using (user_id = auth.uid());

create policy "accessible messages are readable" on public.messages for select
  using (
    (room_id is not null and public.can_access_room(room_id))
    or (dm_id is not null and public.can_access_dm(dm_id))
  );
create policy "members send messages" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (
      (room_id is not null and public.can_access_room(room_id))
      or (dm_id is not null and public.can_access_dm(dm_id))
    )
  );
create policy "authors or moderators edit messages" on public.messages for update
  using (sender_id = auth.uid() or public.has_permission(workspace_id, 'manage_messages'));
create policy "authors or moderators delete messages" on public.messages for delete
  using (sender_id = auth.uid() or public.has_permission(workspace_id, 'manage_messages'));

create policy "reactions readable with message" on public.message_reactions for select
  using (exists (
    select 1 from public.messages m where m.id = message_id and (
      (m.room_id is not null and public.can_access_room(m.room_id))
      or (m.dm_id is not null and public.can_access_dm(m.dm_id))
    )
  ));
create policy "members react to messages" on public.message_reactions for insert
  with check (user_id = auth.uid());
create policy "members remove own reaction" on public.message_reactions for delete
  using (user_id = auth.uid());

create policy "attachments readable with message" on public.message_attachments for select
  using (exists (
    select 1 from public.messages m where m.id = message_id and (
      (m.room_id is not null and public.can_access_room(m.room_id))
      or (m.dm_id is not null and public.can_access_dm(m.dm_id))
    )
  ));
create policy "message authors attach files" on public.message_attachments for insert
  with check (exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));
create policy "message authors remove attachments" on public.message_attachments for delete
  using (exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));

-- =========================================================================
-- PROJECTS, MILESTONES, TASKS
-- =========================================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'planned' check (status in ('planned', 'active', 'on_hold', 'completed', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  owner_id uuid references public.profiles (id),
  start_date date,
  due_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index projects_workspace_idx on public.projects (workspace_id);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (project_id, user_id)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  milestone_id uuid references public.milestones (id) on delete set null,
  title text not null,
  description text,
  assignee_id uuid references public.profiles (id),
  status text not null default 'backlog' check (status in ('backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'complete')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  start_date date,
  due_date date,
  created_by uuid references public.profiles (id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_workspace_idx on public.tasks (workspace_id);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assignee_idx on public.tasks (assignee_id);

create table public.task_collaborators (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_collaborators enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;

create policy "members read projects" on public.projects for select
  using (public.is_workspace_member(workspace_id));
create policy "permitted members create projects" on public.projects for insert
  with check (public.has_permission(workspace_id, 'create_projects'));
create policy "owners or managers update projects" on public.projects for update
  using (owner_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_projects'));
create policy "managers delete projects" on public.projects for delete
  using (public.has_permission(workspace_id, 'manage_projects'));

create policy "members read project rosters" on public.project_members for select
  using (public.is_workspace_member((select workspace_id from public.projects where id = project_id)));
create policy "managers edit project rosters" on public.project_members for all
  using (public.has_permission((select workspace_id from public.projects where id = project_id), 'manage_projects'))
  with check (public.has_permission((select workspace_id from public.projects where id = project_id), 'manage_projects'));

create policy "members read milestones" on public.milestones for select
  using (public.is_workspace_member((select workspace_id from public.projects where id = project_id)));
create policy "managers write milestones" on public.milestones for all
  using (public.has_permission((select workspace_id from public.projects where id = project_id), 'manage_projects'))
  with check (public.has_permission((select workspace_id from public.projects where id = project_id), 'manage_projects'));

create policy "members read tasks" on public.tasks for select
  using (public.is_workspace_member(workspace_id));
create policy "permitted members create tasks" on public.tasks for insert
  with check (public.has_permission(workspace_id, 'create_tasks'));
create policy "assignee or managers update tasks" on public.tasks for update
  using (assignee_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_tasks'));
create policy "managers delete tasks" on public.tasks for delete
  using (public.has_permission(workspace_id, 'manage_tasks'));

create policy "members read task collaborators" on public.task_collaborators for select
  using (public.is_workspace_member((select workspace_id from public.tasks where id = task_id)));
create policy "members manage task collaborators" on public.task_collaborators for all
  using (public.has_permission((select workspace_id from public.tasks where id = task_id), 'manage_tasks'))
  with check (public.has_permission((select workspace_id from public.tasks where id = task_id), 'manage_tasks'));

create policy "members read checklist items" on public.task_checklist_items for select
  using (public.is_workspace_member((select workspace_id from public.tasks where id = task_id)));
create policy "members manage checklist items" on public.task_checklist_items for all
  using (public.is_workspace_member((select workspace_id from public.tasks where id = task_id)))
  with check (public.is_workspace_member((select workspace_id from public.tasks where id = task_id)));

create policy "members read task comments" on public.task_comments for select
  using (public.is_workspace_member((select workspace_id from public.tasks where id = task_id)));
create policy "members write task comments" on public.task_comments for insert
  with check (user_id = auth.uid() and public.is_workspace_member((select workspace_id from public.tasks where id = task_id)));
create policy "authors delete own task comments" on public.task_comments for delete
  using (user_id = auth.uid());

-- =========================================================================
-- MEETINGS
-- =========================================================================

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  description text,
  host_id uuid references public.profiles (id),
  project_id uuid references public.projects (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes int not null default 30,
  provider text not null default 'external',
  meeting_url text,
  notes text,
  action_items text,
  created_by uuid references public.profiles (id),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index meetings_workspace_idx on public.meetings (workspace_id, starts_at);

create table public.meeting_attendees (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  primary key (meeting_id, user_id)
);

alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;

create policy "members read meetings" on public.meetings for select
  using (public.is_workspace_member(workspace_id));
create policy "permitted members create meetings" on public.meetings for insert
  with check (public.has_permission(workspace_id, 'create_meetings'));
create policy "host or managers update meetings" on public.meetings for update
  using (host_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_meetings'));
create policy "host or managers delete meetings" on public.meetings for delete
  using (host_id = auth.uid() or public.has_permission(workspace_id, 'manage_meetings'));

create policy "members read meeting attendees" on public.meeting_attendees for select
  using (public.is_workspace_member((select workspace_id from public.meetings where id = meeting_id)));
create policy "members manage meeting attendees" on public.meeting_attendees for all
  using (user_id = auth.uid() or public.has_permission((select workspace_id from public.meetings where id = meeting_id), 'manage_meetings'))
  with check (user_id = auth.uid() or public.has_permission((select workspace_id from public.meetings where id = meeting_id), 'manage_meetings'));

-- =========================================================================
-- CALENDAR
-- =========================================================================

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  video_url text,
  category text,
  project_id uuid references public.projects (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  meeting_id uuid references public.meetings (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index calendar_events_workspace_idx on public.calendar_events (workspace_id, starts_at);

alter table public.calendar_events enable row level security;

create policy "members read calendar events" on public.calendar_events for select
  using (public.is_workspace_member(workspace_id));
create policy "permitted members create calendar events" on public.calendar_events for insert
  with check (public.has_permission(workspace_id, 'create_calendar_events'));
create policy "authors or managers update calendar events" on public.calendar_events for update
  using (created_by = auth.uid() or public.has_permission(workspace_id, 'manage_workspace_settings'));
create policy "authors or managers delete calendar events" on public.calendar_events for delete
  using (created_by = auth.uid() or public.has_permission(workspace_id, 'manage_workspace_settings'));

-- =========================================================================
-- FILES
-- =========================================================================

create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  uploaded_by uuid references public.profiles (id),
  project_id uuid references public.projects (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  name text not null,
  url text not null,
  type text,
  size bigint,
  created_at timestamptz not null default now()
);

create index files_workspace_idx on public.files (workspace_id, created_at);

alter table public.files enable row level security;

create policy "members read files" on public.files for select
  using (public.is_workspace_member(workspace_id));
create policy "permitted members upload files" on public.files for insert
  with check (public.has_permission(workspace_id, 'upload_files') and uploaded_by = auth.uid());
create policy "uploader or managers delete files" on public.files for delete
  using (uploaded_by = auth.uid() or public.has_permission(workspace_id, 'delete_files'));

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at);

alter table public.notifications enable row level security;

create policy "users read own notifications" on public.notifications for select
  using (user_id = auth.uid());
create policy "workspace members create notifications for others" on public.notifications for insert
  with check (public.is_workspace_member(workspace_id));
create policy "users update own notifications" on public.notifications for update
  using (user_id = auth.uid());
create policy "users delete own notifications" on public.notifications for delete
  using (user_id = auth.uid());

-- =========================================================================
-- ACTIVITY
-- =========================================================================

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  type text not null,
  target_type text,
  target_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_events_workspace_idx on public.activity_events (workspace_id, created_at desc);

alter table public.activity_events enable row level security;

create policy "members read activity" on public.activity_events for select
  using (public.is_workspace_member(workspace_id));
create policy "members log activity" on public.activity_events for insert
  with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

-- =========================================================================
-- REALTIME
-- =========================================================================

alter publication supabase_realtime add table
  public.messages,
  public.message_reactions,
  public.notifications,
  public.workspace_members,
  public.tasks,
  public.rooms;
