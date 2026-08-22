create index if not exists calendar_oauth_states_user_id_idx
  on public.calendar_oauth_states (user_id);

create index if not exists task_help_requests_dm_id_idx
  on public.task_help_requests (dm_id);

create index if not exists task_help_requests_workspace_id_idx
  on public.task_help_requests (workspace_id);

create index if not exists task_collaborators_user_id_idx
  on public.task_collaborators (user_id);
