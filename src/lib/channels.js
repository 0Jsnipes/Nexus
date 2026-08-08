import { supabase } from "./supabase";

export const createRoom = ({ workspaceId, name, topic, isPrivate }) =>
  supabase.rpc("create_room", {
    _workspace_id: workspaceId,
    _name: name,
    _topic: topic || null,
    _is_private: Boolean(isPrivate),
  });

export const createDirectMessage = ({ workspaceId, userIds, name }) =>
  supabase.rpc("create_dm", {
    _workspace_id: workspaceId,
    _user_ids: userIds,
    _name: name || null,
  });
