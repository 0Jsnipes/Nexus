import { supabase } from "./supabase";

const linkTo = (section, params) => JSON.stringify({ section, params });

export const notifyMentions = async ({ workspaceId, body, senderId, senderName, roomId, dmId, roomName }) => {
  if (!body) return;
  const handles = Array.from(new Set((body.match(/@([a-zA-Z0-9_]+)/g) || []).map((h) => h.slice(1).toLowerCase())));
  if (!handles.length) return;

  const { data: profiles } = await supabase.from("profiles").select("id, username").in("username", handles);
  const targets = (profiles || []).filter((p) => p.id !== senderId);
  if (!targets.length) return;

  await supabase.from("notifications").insert(
    targets.map((p) => ({
      workspace_id: workspaceId,
      user_id: p.id,
      type: "mention",
      title: `${senderName} mentioned you`,
      body: roomName ? `in #${roomName}` : "in a direct message",
      link: linkTo(roomId ? "rooms" : "dms", roomId ? { roomId } : { dmId }),
    }))
  );
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
