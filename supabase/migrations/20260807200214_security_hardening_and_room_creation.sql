-- Security hardening and atomic room/DM creation.
-- This migration intentionally rotates all join codes because the previous
-- workspace SELECT policy exposed them to every authenticated account.

-- -------------------------------------------------------------------------
-- Secure workspace lifecycle functions
-- -------------------------------------------------------------------------

create or replace function public.create_workspace(
  _name text,
  _slug text default null,
  _description text default null,
  _logo_url text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  _workspace public.workspaces;
  _code text;
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'authentication_required';
  end if;
  if nullif(btrim(_name), '') is null or char_length(_name) > 100 then
    raise exception 'invalid_workspace_name';
  end if;

  _code := upper(encode(extensions.gen_random_bytes(16), 'hex'));

  insert into public.workspaces (name, slug, description, logo_url, owner_id, join_code)
  values (btrim(_name), nullif(btrim(_slug), ''), nullif(btrim(_description), ''), nullif(_logo_url, ''), _uid, _code)
  returning * into _workspace;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (_workspace.id, _uid, 'owner', 'active');

  insert into public.rooms (workspace_id, name, topic, is_private, created_by)
  values (_workspace.id, 'General', 'General discussion', false, _uid);

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  _workspace public.workspaces;
  _existing public.workspace_members;
  _status text;
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'authentication_required';
  end if;
  if _code is null or char_length(_code) > 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into _workspace
  from public.workspaces
  where join_code = upper(btrim(_code));

  if _workspace.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if not _workspace.join_code_enabled then
    return jsonb_build_object('ok', false, 'error', 'code_disabled');
  end if;

  select * into _existing
  from public.workspace_members
  where workspace_id = _workspace.id and user_id = _uid;

  if _existing.user_id is not null then
    return jsonb_build_object(
      'ok', false,
      'error', 'already_member',
      'workspace_id', _workspace.id,
      'status', _existing.status
    );
  end if;

  _status := case when _workspace.require_approval then 'pending' else 'active' end;
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (_workspace.id, _uid, 'member', _status);

  return jsonb_build_object(
    'ok', true,
    'workspace_id', _workspace.id,
    'status', _status,
    'name', _workspace.name
  );
end;
$$;

create or replace function public.regenerate_join_code(_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _code text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if not public.has_permission(_workspace_id, 'manage_workspace_settings') then
    raise exception 'not_permitted';
  end if;

  _code := upper(encode(extensions.gen_random_bytes(16), 'hex'));
  update public.workspaces set join_code = _code where id = _workspace_id;
  return _code;
end;
$$;

create or replace function public.transfer_workspace_ownership(_workspace_id uuid, _new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'authentication_required';
  end if;
  if (select owner_id from public.workspaces where id = _workspace_id) <> _uid then
    raise exception 'not_owner';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = _new_owner_id and status = 'active'
  ) then
    raise exception 'not_a_member';
  end if;

  update public.workspace_members set role = 'admin'
  where workspace_id = _workspace_id and user_id = _uid;
  update public.workspace_members set role = 'owner'
  where workspace_id = _workspace_id and user_id = _new_owner_id;
  update public.workspaces set owner_id = _new_owner_id where id = _workspace_id;
end;
$$;

-- Atomic creation avoids INSERT ... RETURNING being rejected by the room/DM
-- SELECT policy before the creator membership row exists.
create or replace function public.create_room(
  _workspace_id uuid,
  _name text,
  _topic text default null,
  _is_private boolean default false
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  _room public.rooms;
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'authentication_required';
  end if;
  if not public.has_permission(_workspace_id, 'create_rooms') then
    raise exception 'not_permitted';
  end if;
  if nullif(btrim(_name), '') is null or char_length(_name) > 80 then
    raise exception 'invalid_room_name';
  end if;
  if char_length(coalesce(_topic, '')) > 250 then
    raise exception 'invalid_room_topic';
  end if;

  insert into public.rooms (workspace_id, name, topic, is_private, created_by)
  values (_workspace_id, btrim(_name), nullif(btrim(_topic), ''), coalesce(_is_private, false), _uid)
  returning * into _room;

  if _room.is_private then
    insert into public.room_members (room_id, user_id) values (_room.id, _uid);
  end if;

  return _room;
end;
$$;

create or replace function public.create_dm(
  _workspace_id uuid,
  _user_ids uuid[],
  _name text default null
)
returns public.dm_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  _conversation public.dm_conversations;
  _member_ids uuid[];
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'authentication_required';
  end if;
  if not public.is_workspace_member(_workspace_id) then
    raise exception 'not_permitted';
  end if;
  if char_length(coalesce(_name, '')) > 100 then
    raise exception 'invalid_conversation_name';
  end if;

  select array_agg(distinct member_id)
  into _member_ids
  from unnest(coalesce(_user_ids, '{}'::uuid[]) || array[_uid]) as member_id;

  if cardinality(_member_ids) < 2 or cardinality(_member_ids) > 50 then
    raise exception 'invalid_conversation_members';
  end if;
  if (
    select count(*)
    from public.workspace_members
    where workspace_id = _workspace_id
      and status = 'active'
      and user_id = any(_member_ids)
  ) <> cardinality(_member_ids) then
    raise exception 'invalid_conversation_members';
  end if;

  insert into public.dm_conversations (workspace_id, is_group, name, created_by)
  values (_workspace_id, cardinality(_member_ids) > 2, nullif(btrim(_name), ''), _uid)
  returning * into _conversation;

  insert into public.dm_members (dm_id, user_id)
  select _conversation.id, member_id from unnest(_member_ids) as member_id;

  return _conversation;
end;
$$;

-- Previously exposed 8-character join codes must not remain valid.
update public.workspaces
set join_code = upper(encode(extensions.gen_random_bytes(16), 'hex'));

-- -------------------------------------------------------------------------
-- Tenant and membership policy hardening
-- -------------------------------------------------------------------------

drop policy if exists "workspaces readable by signed-in users" on public.workspaces;
create policy "workspace members read workspace"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

drop policy if exists "owner or permitted admin updates workspace" on public.workspaces;
create policy "owner or permitted admin updates workspace"
  on public.workspaces for update to authenticated
  using (owner_id = auth.uid() or public.has_permission(id, 'manage_workspace_settings'))
  with check (owner_id = auth.uid() or public.has_permission(id, 'manage_workspace_settings'));

drop policy if exists "members update own row or admins manage roster" on public.workspace_members;
create policy "role managers update non-owner members"
  on public.workspace_members for update to authenticated
  using (
    role <> 'owner'
    and public.has_permission(workspace_id, 'manage_roles')
  )
  with check (
    role <> 'owner'
    and public.has_permission(workspace_id, 'manage_roles')
    and custom_permissions <@ array[
      'create_rooms','manage_rooms','delete_rooms','create_projects','manage_projects',
      'create_tasks','manage_tasks','invite_members','remove_members','manage_roles',
      'upload_files','delete_files','create_meetings','manage_meetings',
      'create_calendar_events','manage_messages','view_private_rooms','manage_workspace_settings'
    ]::text[]
  );

drop policy if exists "permitted admins manage role permissions" on public.role_permissions;
create policy "permitted admins manage known role permissions"
  on public.role_permissions for all to authenticated
  using (public.has_permission(workspace_id, 'manage_roles'))
  with check (
    public.has_permission(workspace_id, 'manage_roles')
    and permission = any(array[
      'create_rooms','manage_rooms','delete_rooms','create_projects','manage_projects',
      'create_tasks','manage_tasks','invite_members','remove_members','manage_roles',
      'upload_files','delete_files','create_meetings','manage_meetings',
      'create_calendar_events','manage_messages','view_private_rooms','manage_workspace_settings'
    ]::text[])
  );

-- Room and DM creation now goes through the atomic RPCs above.
drop policy if exists "permitted members create rooms" on public.rooms;
drop policy if exists "room managers add members" on public.room_members;
create policy "room managers add active workspace members"
  on public.room_members for insert to authenticated
  with check (
    public.has_permission(
      (select workspace_id from public.rooms where id = room_id),
      'manage_rooms'
    )
    and exists (
      select 1
      from public.workspace_members wm
      join public.rooms r on r.workspace_id = wm.workspace_id
      where r.id = room_id
        and wm.user_id = user_id
        and wm.status = 'active'
    )
  );

drop policy if exists "permitted members update rooms" on public.rooms;
create policy "permitted members update rooms"
  on public.rooms for update to authenticated
  using (created_by = auth.uid() or public.has_permission(workspace_id, 'manage_rooms'))
  with check (created_by = auth.uid() or public.has_permission(workspace_id, 'manage_rooms'));

drop policy if exists "workspace members start dms" on public.dm_conversations;
drop policy if exists "dm participants managed by members" on public.dm_members;

drop policy if exists "dm members update conversation" on public.dm_conversations;
create policy "dm members update conversation"
  on public.dm_conversations for update to authenticated
  using (public.can_access_dm(id))
  with check (public.can_access_dm(id));

drop policy if exists "dm members leave or mute" on public.dm_members;
create policy "dm members mute themselves"
  on public.dm_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "authors or moderators edit messages" on public.messages;
create policy "authors or moderators edit messages"
  on public.messages for update to authenticated
  using (sender_id = auth.uid() or public.has_permission(workspace_id, 'manage_messages'))
  with check (sender_id = auth.uid() or public.has_permission(workspace_id, 'manage_messages'));

drop policy if exists "members react to messages" on public.message_reactions;
create policy "members react to accessible messages"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and (
          (m.room_id is not null and public.can_access_room(m.room_id))
          or (m.dm_id is not null and public.can_access_dm(m.dm_id))
        )
    )
  );

drop policy if exists "workspace members create notifications for others" on public.notifications;
create policy "workspace members notify active workspace members"
  on public.notifications for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = notifications.workspace_id
        and wm.user_id = notifications.user_id
        and wm.status = 'active'
    )
  );

drop policy if exists "users update own notifications" on public.notifications;
create policy "users mark own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "owners or managers update projects" on public.projects;
create policy "owners or managers update projects"
  on public.projects for update to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_projects'))
  with check (owner_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_projects'));

drop policy if exists "assignee or managers update tasks" on public.tasks;
create policy "assignee or managers update tasks"
  on public.tasks for update to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_tasks'))
  with check (assignee_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_tasks'));

drop policy if exists "host or managers update meetings" on public.meetings;
create policy "host or managers update meetings"
  on public.meetings for update to authenticated
  using (host_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_meetings'))
  with check (host_id = auth.uid() or created_by = auth.uid() or public.has_permission(workspace_id, 'manage_meetings'));

drop policy if exists "authors or managers update calendar events" on public.calendar_events;
create policy "authors or managers update calendar events"
  on public.calendar_events for update to authenticated
  using (created_by = auth.uid() or public.has_permission(workspace_id, 'manage_workspace_settings'))
  with check (created_by = auth.uid() or public.has_permission(workspace_id, 'manage_workspace_settings'));

-- -------------------------------------------------------------------------
-- Explicit API grants and immutable security-sensitive columns
-- -------------------------------------------------------------------------

revoke all privileges on all tables in schema public from anon;

-- Existing RLS remains the final authorization boundary for these grants.
grant select, insert, delete on all tables in schema public to authenticated;
grant update on all tables in schema public to authenticated;

-- Restrict UPDATE to fields that the application is expected to mutate.
revoke update on public.profiles from authenticated;
grant update (username, avatar_url, job_title, bio, status) on public.profiles to authenticated;

revoke update on public.workspaces from authenticated;
grant update (name, slug, description, logo_url, join_code_enabled, require_approval)
  on public.workspaces to authenticated;

revoke update on public.workspace_members from authenticated;
grant update (role, status, custom_permissions) on public.workspace_members to authenticated;

revoke update on public.rooms from authenticated;
grant update (name, topic, description, is_private, archived_at) on public.rooms to authenticated;

revoke update on public.dm_conversations from authenticated;
grant update (name, updated_at) on public.dm_conversations to authenticated;

revoke update on public.dm_members from authenticated;
grant update (muted) on public.dm_members to authenticated;

revoke update on public.messages from authenticated;
grant update (body, edited_at, deleted_at) on public.messages to authenticated;

revoke update on public.projects from authenticated;
grant update (name, description, status, priority, owner_id, start_date, due_date)
  on public.projects to authenticated;

revoke update on public.milestones from authenticated;
grant update (name, due_date, completed_at) on public.milestones to authenticated;

revoke update on public.tasks from authenticated;
grant update (project_id, milestone_id, title, description, assignee_id, status, priority, start_date, due_date, completed_at)
  on public.tasks to authenticated;

revoke update on public.task_checklist_items from authenticated;
grant update (title, done, position) on public.task_checklist_items to authenticated;

revoke update on public.meetings from authenticated;
grant update (title, description, host_id, project_id, room_id, starts_at, duration_minutes, provider, meeting_url, notes, action_items, ended_at)
  on public.meetings to authenticated;

revoke update on public.meeting_attendees from authenticated;
grant update (status) on public.meeting_attendees to authenticated;

revoke update on public.calendar_events from authenticated;
grant update (title, description, starts_at, ends_at, all_day, location, video_url, category, project_id, room_id, task_id, meeting_id)
  on public.calendar_events to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- SECURITY DEFINER helpers are authenticated-only and use a fixed search path.
alter function public.handle_new_user() set search_path = '';
alter function public.is_workspace_member(uuid) set search_path = '';
alter function public.workspace_role(uuid) set search_path = '';
alter function public.has_permission(uuid, text) set search_path = '';
alter function public.can_access_room(uuid) set search_path = '';
alter function public.can_access_dm(uuid) set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.workspace_role(uuid) from public, anon;
revoke execute on function public.has_permission(uuid, text) from public, anon;
revoke execute on function public.can_access_room(uuid) from public, anon;
revoke execute on function public.can_access_dm(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.can_access_room(uuid) to authenticated;
grant execute on function public.can_access_dm(uuid) to authenticated;

revoke execute on function public.create_workspace(text, text, text, text) from public, anon;
revoke execute on function public.join_workspace(text) from public, anon;
revoke execute on function public.regenerate_join_code(uuid) from public, anon;
revoke execute on function public.transfer_workspace_ownership(uuid, uuid) from public, anon;
revoke execute on function public.create_room(uuid, text, text, boolean) from public, anon;
revoke execute on function public.create_dm(uuid, uuid[], text) from public, anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.join_workspace(text) to authenticated;
grant execute on function public.regenerate_join_code(uuid) to authenticated;
grant execute on function public.transfer_workspace_ownership(uuid, uuid) to authenticated;
grant execute on function public.create_room(uuid, text, text, boolean) to authenticated;
grant execute on function public.create_dm(uuid, uuid[], text) to authenticated;

-- -------------------------------------------------------------------------
-- Storage: public profile media is separated from private workspace files
-- -------------------------------------------------------------------------

update storage.buckets set public = false where id = 'nexus';
insert into storage.buckets (id, name, public)
values ('nexus-public', 'nexus-public', true)
on conflict (id) do update set public = true;

drop policy if exists "public read access to nexus bucket" on storage.objects;
drop policy if exists "signed-in users upload to their own profile folder" on storage.objects;
drop policy if exists "owners delete their own uploads" on storage.objects;

create policy "members read private workspace files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'nexus'
    and exists (
      select 1 from public.workspaces w
      where w.id::text = (storage.foldername(name))[1]
        and public.is_workspace_member(w.id)
    )
  );

create policy "permitted members upload private workspace files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'nexus'
    and exists (
      select 1 from public.workspaces w
      where w.id::text = (storage.foldername(name))[1]
        and public.has_permission(w.id, 'upload_files')
    )
  );

create policy "owners or file managers delete private workspace files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'nexus'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.workspaces w
        where w.id::text = (storage.foldername(name))[1]
          and public.has_permission(w.id, 'delete_files')
      )
    )
  );

create policy "public profile media is readable"
  on storage.objects for select
  using (bucket_id = 'nexus-public');

create policy "users upload their own public profile media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'nexus-public'
    and (storage.foldername(name))[1] = 'profile'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "users delete their own public profile media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'nexus-public' and owner = auth.uid());
