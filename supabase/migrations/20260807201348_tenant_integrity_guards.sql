-- Prevent cross-tenant profile discovery and mismatched foreign identifiers.

create function private.shares_workspace(_other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select auth.uid() = _other_user_id
    or exists (
      select 1
      from public.workspace_members self_membership
      join public.workspace_members other_membership
        on other_membership.workspace_id = self_membership.workspace_id
      where self_membership.user_id = auth.uid()
        and self_membership.status = 'active'
        and other_membership.user_id = _other_user_id
        and other_membership.status = 'active'
    );
$$;

revoke execute on function private.shares_workspace(uuid) from public, anon;
grant execute on function private.shares_workspace(uuid) to authenticated;

drop policy if exists "profiles are readable by any signed-in user" on public.profiles;
create policy "profiles readable within shared workspaces"
  on public.profiles for select to authenticated
  using (private.shares_workspace(id));

drop policy if exists "members send messages" on public.messages;
create policy "members send messages in matching workspace channels"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (
        room_id is not null
        and exists (
          select 1 from public.rooms r
          where r.id = messages.room_id
            and r.workspace_id = messages.workspace_id
            and public.can_access_room(r.id)
        )
      )
      or (
        dm_id is not null
        and exists (
          select 1 from public.dm_conversations d
          where d.id = messages.dm_id
            and d.workspace_id = messages.workspace_id
            and public.can_access_dm(d.id)
        )
      )
    )
  );

drop policy if exists "permitted members create projects" on public.projects;
create policy "permitted members create projects"
  on public.projects for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_permission(workspace_id, 'create_projects')
    and (
      owner_id is null
      or exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = projects.workspace_id
          and wm.user_id = projects.owner_id
          and wm.status = 'active'
      )
    )
  );

drop policy if exists "permitted members create tasks" on public.tasks;
create policy "permitted members create tasks"
  on public.tasks for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_permission(workspace_id, 'create_tasks')
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = tasks.project_id and p.workspace_id = tasks.workspace_id
      )
    )
    and (
      assignee_id is null
      or exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = tasks.workspace_id
          and wm.user_id = tasks.assignee_id
          and wm.status = 'active'
      )
    )
  );

drop policy if exists "permitted members create meetings" on public.meetings;
create policy "permitted members create meetings"
  on public.meetings for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_permission(workspace_id, 'create_meetings')
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meetings.workspace_id
        and wm.user_id = meetings.host_id
        and wm.status = 'active'
    )
  );

drop policy if exists "permitted members create calendar events" on public.calendar_events;
create policy "permitted members create calendar events"
  on public.calendar_events for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_permission(workspace_id, 'create_calendar_events')
  );

drop policy if exists "permitted members upload files" on public.files;
create policy "permitted members upload matching workspace files"
  on public.files for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.has_permission(workspace_id, 'upload_files')
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = files.project_id and p.workspace_id = files.workspace_id
      )
    )
    and (
      room_id is null
      or exists (
        select 1 from public.rooms r
        where r.id = files.room_id and r.workspace_id = files.workspace_id
      )
    )
    and (
      message_id is null
      or exists (
        select 1 from public.messages m
        where m.id = files.message_id and m.workspace_id = files.workspace_id
      )
    )
  );

drop policy if exists "members manage meeting attendees" on public.meeting_attendees;
create policy "workspace attendees or meeting managers manage attendance"
  on public.meeting_attendees for all to authenticated
  using (
    (
      user_id = auth.uid()
      and public.is_workspace_member(
        (select workspace_id from public.meetings where id = meeting_id)
      )
    )
    or public.has_permission(
      (select workspace_id from public.meetings where id = meeting_id),
      'manage_meetings'
    )
  )
  with check (
    (
      user_id = auth.uid()
      and public.is_workspace_member(
        (select workspace_id from public.meetings where id = meeting_id)
      )
    )
    or public.has_permission(
      (select workspace_id from public.meetings where id = meeting_id),
      'manage_meetings'
    )
  );
