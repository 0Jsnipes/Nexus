-- Expose only SECURITY INVOKER RPC facades. The validated, elevated
-- implementations live in the non-Data-API `private` schema.

alter function public.create_workspace(text, text, text, text) set schema private;
alter function public.join_workspace(text) set schema private;
alter function public.regenerate_join_code(uuid) set schema private;
alter function public.transfer_workspace_ownership(uuid, uuid) set schema private;
alter function public.create_room(uuid, text, text, boolean) set schema private;
alter function public.create_dm(uuid, uuid[], text) set schema private;

revoke execute on function private.create_workspace(text, text, text, text) from public, anon;
revoke execute on function private.join_workspace(text) from public, anon;
revoke execute on function private.regenerate_join_code(uuid) from public, anon;
revoke execute on function private.transfer_workspace_ownership(uuid, uuid) from public, anon;
revoke execute on function private.create_room(uuid, text, text, boolean) from public, anon;
revoke execute on function private.create_dm(uuid, uuid[], text) from public, anon;
grant execute on function private.create_workspace(text, text, text, text) to authenticated;
grant execute on function private.join_workspace(text) to authenticated;
grant execute on function private.regenerate_join_code(uuid) to authenticated;
grant execute on function private.transfer_workspace_ownership(uuid, uuid) to authenticated;
grant execute on function private.create_room(uuid, text, text, boolean) to authenticated;
grant execute on function private.create_dm(uuid, uuid[], text) to authenticated;

create function public.create_workspace(
  _name text,
  _slug text default null,
  _description text default null,
  _logo_url text default null
)
returns public.workspaces
language sql
security invoker
set search_path = ''
as $$
  select private.create_workspace(_name, _slug, _description, _logo_url);
$$;

create function public.join_workspace(_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.join_workspace(_code);
$$;

create function public.regenerate_join_code(_workspace_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.regenerate_join_code(_workspace_id);
$$;

create function public.transfer_workspace_ownership(_workspace_id uuid, _new_owner_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.transfer_workspace_ownership(_workspace_id, _new_owner_id);
$$;

create function public.create_room(
  _workspace_id uuid,
  _name text,
  _topic text default null,
  _is_private boolean default false
)
returns public.rooms
language sql
security invoker
set search_path = ''
as $$
  select private.create_room(_workspace_id, _name, _topic, _is_private);
$$;

create function public.create_dm(
  _workspace_id uuid,
  _user_ids uuid[],
  _name text default null
)
returns public.dm_conversations
language sql
security invoker
set search_path = ''
as $$
  select private.create_dm(_workspace_id, _user_ids, _name);
$$;

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
