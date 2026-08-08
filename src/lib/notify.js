import { supabase } from "./supabase";

const linkTo = (section, params) => JSON.stringify({ section, params });

// Recipients for a message: every other member of the DM, or of the room
// (room_members for private rooms, the whole workspace for public ones —
// rooms without explicit membership rows are open to the workspace).
const messageRecipientIds = async ({ workspaceId, roomId, dmId, isPrivateRoom, senderId }) => {
  let query;
  if (dmId) {
    query = supabase.from("dm_members").select("user_id").eq("dm_id", dmId);
  } else if (isPrivateRoom) {
    query = supabase.from("room_members").select("user_id").eq("room_id", roomId);
  } else {
    query = supabase.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("status", "active");
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => r.user_id).filter((id) => id !== senderId);
};

const truncate = (text, max = 80) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text);

export const notifyNewMessage = async ({ messageId, workspaceId, body, senderId, senderName, roomId, dmId, roomName, isPrivateRoom }) => {
  if (!body) return;

  const recipientIds = await messageRecipientIds({ workspaceId, roomId, dmId, isPrivateRoom, senderId });
  if (!recipientIds.length) return;

  const handles = Array.from(new Set((body.match(/@([a-zA-Z0-9_]+)/g) || []).map((h) => h.slice(1).toLowerCase())));
  let mentionedIds = new Set();
  if (handles.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, username").in("username", handles);
    mentionedIds = new Set((profiles || []).map((p) => p.id));
  }

  const link = linkTo(roomId ? "rooms" : "dms", roomId ? { roomId } : { dmId });
  const context = roomName ? `#${roomName}` : "a direct message";

  await supabase.from("notifications").insert(
    recipientIds.map((userId) => {
      const isMention = mentionedIds.has(userId);
      return {
        workspace_id: workspaceId,
        user_id: userId,
        type: isMention ? "mention" : "message",
        title: isMention ? `${senderName} mentioned you` : `${senderName} sent a message`,
        body: isMention ? `in ${context}` : truncate(body),
        link,
      };
    })
  );

  // Best-effort: also push to any subscribed devices for these recipients.
  // Silently no-ops until the send-push edge function is deployed.
  supabase.functions
    .invoke("send-push", {
      body: { messageId },
    })
    .catch(() => {});
};

export const notifyTaskAssigned = async ({ workspaceId, task, assigneeId, actorName }) => {
  if (!assigneeId) return;
  await supabase.from("notifications").insert({
    workspace_id: workspaceId,
    user_id: assigneeId,
    type: "task_assigned",
    title: `${actorName} assigned you a task`,
    body: task.title,
    link: linkTo("projects", task.project_id ? { projectId: task.project_id } : {}),
  });
};
