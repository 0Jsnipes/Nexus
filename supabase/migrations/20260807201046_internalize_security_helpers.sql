-- Keep SECURITY DEFINER authorization helpers out of the Data API schema.
-- Public wrappers remain SECURITY INVOKER so existing policy/function bodies
-- continue to resolve without exposing the elevated implementations as RPCs.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_workspace_member(uuid) set schema private;
alter function public.workspace_role(uuid) set schema private;
alter function public.has_permission(uuid, text) set schema private;
alter function public.can_access_room(uuid) set schema private;
alter function public.can_access_dm(uuid) set schema private;

revoke execute on function private.is_workspace_member(uuid) from public, anon;
revoke execute on function private.workspace_role(uuid) from public, anon;
revoke execute on function private.has_permission(uuid, text) from public, anon;
revoke execute on function private.can_access_room(uuid) from public, anon;
revoke execute on function private.can_access_dm(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.workspace_role(uuid) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_access_room(uuid) to authenticated;
grant execute on function private.can_access_dm(uuid) to authenticated;

create function public.is_workspace_member(_workspace_id uuid)
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select private.is_workspace_member(_workspace_id);
$$;

create function public.workspace_role(_workspace_id uuid)
returns text
language sql
security invoker
stable
set search_path = ''
as $$
  select private.workspace_role(_workspace_id);
$$;

create function public.has_permission(_workspace_id uuid, _permission text)
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select private.has_permission(_workspace_id, _permission);
$$;

create function public.can_access_room(_room_id uuid)
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select private.can_access_room(_room_id);
$$;

create function public.can_access_dm(_dm_id uuid)
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select private.can_access_dm(_dm_id);
$$;

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
