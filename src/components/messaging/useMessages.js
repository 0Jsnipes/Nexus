import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { notifyNewMessage } from "../../lib/notify";
import { resolveStorageUrl } from "../../lib/storage";

// Shared message subsystem for both Rooms and Direct Messages.
// Pass exactly one of { roomId } or { dmId }.
export const useMessages = ({ workspaceId, roomId, dmId, roomName, isPrivateRoom }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const profile = useAuthStore((s) => s.profile);
  const channelKey = roomId || dmId;

  const fetchMessages = useCallback(async () => {
    if (!channelKey) return;
    setLoading(true);
    setError(null);
    let query = supabase
      .from("messages")
      .select(
        "*, sender:profiles!messages_sender_id_fkey(id, username, avatar_url), attachments:message_attachments(*), reactions:message_reactions(*)"
      )
      .order("created_at", { ascending: true })
      .limit(200);

    query = roomId ? query.eq("room_id", roomId) : query.eq("dm_id", dmId);

    const { data, error: err } = await query;
    if (err) {
      console.error("Failed to load messages", err);
      setError(err.message);
    } else {
      const resolved = await Promise.all(
        (data || []).map(async (message) => ({
          ...message,
          attachments: await Promise.all(
            (message.attachments || []).map(async (attachment) => ({
              ...attachment,
              url: await resolveStorageUrl(attachment.url),
            }))
          ),
        }))
      );
      setMessages(resolved);
    }
    setLoading(false);
  }, [roomId, dmId, channelKey]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!channelKey) return undefined;

    const filter = roomId ? `room_id=eq.${roomId}` : `dm_id=eq.${dmId}`;
    const channel = supabase
      .channel(`messages:${channelKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter }, () => {
        fetchMessages();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [channelKey, roomId, dmId, fetchMessages]);

  const sendMessage = useCallback(
    async ({ body, replyToId, attachments = [] }) => {
      if (!profile) return;
      const { data, error: err } = await supabase
        .from("messages")
        .insert({
          workspace_id: workspaceId,
          room_id: roomId || null,
          dm_id: dmId || null,
          sender_id: profile.id,
          body,
          reply_to_id: replyToId || null,
        })
        .select()
        .single();

      if (err) throw err;

      if (attachments.length) {
        await supabase.from("message_attachments").insert(
          attachments.map((a) => ({ message_id: data.id, url: a.url, name: a.name, type: a.type, size: a.size }))
        );
        if (roomId) {
          await supabase.from("files").insert(
            attachments.map((a) => ({
              workspace_id: workspaceId,
              uploaded_by: profile.id,
              room_id: roomId,
              message_id: data.id,
              name: a.name,
              url: a.url,
              type: a.type,
              size: a.size,
            }))
          );
        }
      }

      // Re-fetch directly so the sender sees the message even if Realtime is
      // disconnected or the table is not currently in the publication.
      await fetchMessages();

      notifyNewMessage({
        messageId: data.id,
        workspaceId,
        body,
        senderId: profile.id,
        senderName: profile.username,
        roomId,
        dmId,
        roomName,
        isPrivateRoom,
      });

      return data;
    },
    [workspaceId, roomId, dmId, roomName, isPrivateRoom, profile, fetchMessages]
  );

  const editMessage = useCallback(async (messageId, body) => {
    const { error: err } = await supabase
      .from("messages")
      .update({ body, edited_at: new Date().toISOString() })
      .eq("id", messageId);
    if (err) throw err;
  }, []);

  const deleteMessage = useCallback(async (messageId) => {
    const { error: err } = await supabase.from("messages").delete().eq("id", messageId);
    if (err) throw err;
  }, []);

  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      if (!profile) return;
      const existing = messages
        .find((m) => m.id === messageId)
        ?.reactions?.find((r) => r.user_id === profile.id && r.emoji === emoji);

      if (existing) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", profile.id)
          .eq("emoji", emoji);
      } else {
        await supabase.from("message_reactions").insert({ message_id: messageId, user_id: profile.id, emoji });
      }
      fetchMessages();
    },
    [messages, profile, fetchMessages]
  );

  return { messages, loading, error, sendMessage, editMessage, deleteMessage, toggleReaction, refetch: fetchMessages };
};
