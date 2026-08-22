import { supabase } from "./supabase";
import { createDirectMessage } from "./channels";
import { notifyHelpRequest, notifyNewMessage } from "./notify";

export const requestTaskHelp = async ({ workspaceId, task, requester, helperId }) => {
  const { data: dm, error: dmError } = await createDirectMessage({
    workspaceId,
    userIds: [requester.id, helperId],
  });
  if (dmError) throw dmError;

  const { data: request, error } = await supabase
    .from("task_help_requests")
    .insert({
      workspace_id: workspaceId,
      task_id: task.id,
      requester_id: requester.id,
      helper_id: helperId,
      dm_id: dm.id,
    })
    .select()
    .single();
  if (error) throw error;

  const { data: message } = await supabase.from("messages").insert({
    workspace_id: workspaceId,
    dm_id: dm.id,
    sender_id: requester.id,
    body: `${requester.username} asked for help with “${task.title}”. Open My Tasks to accept or decline.`,
  }).select().single();
  if (message) {
    await notifyNewMessage({ messageId: message.id, workspaceId, body: message.body, senderId: requester.id, senderName: requester.username, dmId: dm.id });
  }
  await notifyHelpRequest({ workspaceId, task, helperId, requesterName: requester.username, requestId: request.id });
  return { ...request, dm_id: dm.id };
};

export const respondToHelpRequest = async ({ request, accepted, helperName }) => {
  const status = accepted ? "accepted" : "declined";
  const { error } = await supabase
    .from("task_help_requests")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("helper_id", request.helper_id);
  if (error) throw error;

  if (accepted) {
    const { error: collaboratorError } = await supabase
      .from("task_collaborators")
      .upsert({ task_id: request.task_id, user_id: request.helper_id });
    if (collaboratorError) throw collaboratorError;
  }

  if (request.dm_id) {
    const body = `${helperName} ${accepted ? "accepted" : "declined"} the request to help with “${request.task?.title || "this task"}”.`;
    const { data: message } = await supabase.from("messages").insert({
      workspace_id: request.workspace_id,
      dm_id: request.dm_id,
      sender_id: request.helper_id,
      body,
    }).select().single();
    if (message) {
      await notifyNewMessage({ messageId: message.id, workspaceId: request.workspace_id, body, senderId: request.helper_id, senderName: helperName, dmId: request.dm_id });
    }
  }
};
