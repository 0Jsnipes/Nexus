-- Productivity upgrade: task help workflow and external calendar connections.

create table public.task_help_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  helper_id uuid not null references public.profiles (id) on delete cascade,
  dm_id uuid references public.dm_conversations (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (requester_id <> helper_id)
);

create unique index task_help_requests_one_pending_idx
  on public.task_help_requests (task_id, helper_id)
  where status = 'pending';
create index task_help_requests_helper_status_idx
  on public.task_help_requests (helper_id, status, created_at desc);
create index task_help_requests_requester_idx
  on public.task_help_requests (requester_id, created_at desc);

alter table public.task_help_requests enable row level security;

create policy "participants read task help requests"
  on public.task_help_requests for select to authenticated
  using (requester_id = (select auth.uid()) or helper_id = (select auth.uid()));

create policy "workspace members request task help"
  on public.task_help_requests for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.tasks t
      where t.id = task_help_requests.task_id
        and t.workspace_id = task_help_requests.workspace_id
        and (t.created_by = (select auth.uid()) or t.assignee_id = (select auth.uid()))
    )
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = task_help_requests.workspace_id
        and wm.user_id = task_help_requests.helper_id
        and wm.status = 'active'
    )
  );

create policy "participants respond to task help requests"
  on public.task_help_requests for update to authenticated
  using (requester_id = (select auth.uid()) or helper_id = (select auth.uid()))
  with check (
    requester_id = (select auth.uid())
    or helper_id = (select auth.uid())
  );

create function public.guard_task_help_request_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.workspace_id <> old.workspace_id
    or new.task_id <> old.task_id
    or new.requester_id <> old.requester_id
    or new.helper_id <> old.helper_id
    or new.dm_id is distinct from old.dm_id then
    raise exception 'Task help request participants and targets are immutable';
  end if;

  if old.status <> 'pending' then
    raise exception 'Task help request has already been resolved';
  end if;

  if auth.uid() = old.helper_id and new.status not in ('accepted', 'declined') then
    raise exception 'Helper response must accept or decline';
  elsif auth.uid() = old.requester_id and new.status <> 'cancelled' then
    raise exception 'Requester may only cancel a help request';
  end if;
  return new;
end;
$$;

create trigger guard_task_help_request_update
before update on public.task_help_requests
for each row execute function public.guard_task_help_request_update();

-- Accepting a help request adds the helper as a collaborator without granting
-- broad task-management permission.
create policy "accepted helpers join task"
  on public.task_collaborators for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.task_help_requests thr
      where thr.task_id = task_collaborators.task_id
        and thr.helper_id = (select auth.uid())
        and thr.status = 'accepted'
    )
  );

create policy "collaborators remove themselves"
  on public.task_collaborators for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "assignee or managers update tasks" on public.tasks;
create policy "assignee collaborators or managers update tasks"
  on public.tasks for update to authenticated
  using (
    assignee_id = (select auth.uid())
    or created_by = (select auth.uid())
    or exists (
      select 1 from public.task_collaborators tc
      where tc.task_id = tasks.id and tc.user_id = (select auth.uid())
    )
    or public.has_permission(workspace_id, 'manage_tasks')
  )
  with check (
    public.is_workspace_member(workspace_id)
    and (
      project_id is null
      or exists (select 1 from public.projects p where p.id = tasks.project_id and p.workspace_id = tasks.workspace_id)
    )
    and (
      assignee_id is null
      or exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = tasks.workspace_id and wm.user_id = tasks.assignee_id and wm.status = 'active'
      )
    )
  );

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  account_email text,
  external_account_id text,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.calendar_connections enable row level security;
create policy "users read their calendar connections"
  on public.calendar_connections for select to authenticated
  using (user_id = (select auth.uid()));

-- These tables contain short-lived OAuth state and encrypted tokens. No user
-- policies are intentionally defined; only service-role Edge Functions access them.
create table public.calendar_oauth_states (
  state text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  redirect_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.calendar_oauth_states enable row level security;
create index calendar_oauth_states_expiry_idx on public.calendar_oauth_states (expires_at);

create table public.calendar_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.calendar_tokens enable row level security;

alter table public.meetings
  add column external_event_id text,
  add column external_calendar_url text;

alter publication supabase_realtime add table public.task_help_requests;
