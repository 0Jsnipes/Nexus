import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "./dm.css";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { useMessages } from "../messaging/useMessages";
import MessageList from "../messaging/MessageList";
import MessageComposer from "../messaging/MessageComposer";
import EmptyState from "../shared/EmptyState";
import Modal from "../shared/Modal";
import Avatar from "../shared/Avatar";
import { FiPlus, FiUsers } from "react-icons/fi";

const conversationLabel = (conversation, currentUserId) => {
  if (conversation.is_group) return conversation.name || "Group";
  const other = conversation.members?.find((m) => m.user_id !== currentUserId);
  return other?.profile?.username || "Direct message";
};

const DirectMessages = ({ route, navigate }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  const profile = useAuthStore((s) => s.profile);
  const active = useWorkspaceStore(selectActiveMembership);
  const dmId = route.params?.dmId;
  const newDmWith = route.params?.newDmWith;
  const activeConversation = conversations.find((c) => c.id === dmId);

  const fetchConversations = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("dm_conversations")
      .select("*, members:dm_members(user_id, profile:profiles(id, username, avatar_url))")
      .eq("workspace_id", active.workspace_id)
      .order("updated_at", { ascending: false });

    if (error) toast.error(error.message);
    else setConversations((data || []).filter((c) => c.members.some((m) => m.user_id === profile.id)));
    setLoading(false);
  };

  useEffect(() => {
    if (active) fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.workspace_id, profile?.id]);

  useEffect(() => {
    if (newDmWith && profile && active) startConversation([newDmWith]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newDmWith, active?.workspace_id]);

  const startConversation = async (userIds, groupName) => {
    if (!profile) return;
    const allIds = Array.from(new Set([profile.id, ...userIds]));

    if (allIds.length === 2) {
      const existing = conversations.find(
        (c) => !c.is_group && c.members.length === 2 && c.members.every((m) => allIds.includes(m.user_id))
      );
      if (existing) {
        navigate("dms", { dmId: existing.id });
        return;
      }
    }

    const { data: conv, error } = await supabase
      .from("dm_conversations")
      .insert({ workspace_id: active.workspace_id, is_group: allIds.length > 2, name: groupName || null, created_by: profile.id })
      .select()
      .single();

    if (error) return toast.error(error.message);

    await supabase.from("dm_members").insert(allIds.map((user_id) => ({ dm_id: conv.id, user_id })));
    await fetchConversations();
    navigate("dms", { dmId: conv.id });
  };

  const { messages, sendMessage, editMessage, deleteMessage, toggleReaction } = useMessages({
    workspaceId: active?.workspace_id,
    dmId,
  });

  const handleSend = async (payload) => {
    if (editingMessage) {
      await editMessage(editingMessage.id, payload.body);
      setEditingMessage(null);
      return;
    }
    await sendMessage(payload);
    await supabase.from("dm_conversations").update({ updated_at: new Date().toISOString() }).eq("id", dmId);
  };

  if (!active) return null;

  return (
    <div className="rooms-layout">
      <aside className="rooms-sidebar">
        <div className="rooms-sidebar-header">
          <h3>Direct Messages</h3>
          <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-btn-sm" onClick={() => setShowNew(true)}>
            <FiPlus size={15} />
          </button>
        </div>
        <div className="rooms-list nx-scroll">
          {loading && <div className="nx-skeleton" style={{ height: 32, margin: "4px 8px" }} />}
          {!loading && conversations.length === 0 && (
            <p className="nx-muted" style={{ padding: "8px 12px", fontSize: 12 }}>No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`rooms-list-item ${c.id === dmId ? "is-active" : ""}`}
              onClick={() => navigate("dms", { dmId: c.id })}
            >
              {c.is_group ? <FiUsers size={13} /> : <Avatar size={18} name={conversationLabel(c, profile?.id)} src={c.members?.find((m) => m.user_id !== profile?.id)?.profile?.avatar_url} />}
              <span>{conversationLabel(c, profile?.id)}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="rooms-main">
        {!activeConversation ? (
          <EmptyState title="No conversation selected" description="Start a new direct message or pick one from the left." />
        ) : (
          <>
            <div className="rooms-header">
              <h2>{conversationLabel(activeConversation, profile?.id)}</h2>
            </div>
            <div className="rooms-messages nx-scroll">
              <MessageList
                messages={messages}
                currentUserId={profile?.id}
                onReply={setReplyTo}
                onEdit={(m) => setEditingMessage(m)}
                onDelete={async (m) => {
                  if (window.confirm("Delete this message?")) await deleteMessage(m.id);
                }}
                onReact={toggleReaction}
                emptyLabel="Send the first message."
              />
            </div>
            <MessageComposer
              workspaceId={active.workspace_id}
              placeholder="Message..."
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSend={handleSend}
            />
          </>
        )}
      </section>

      {showNew && (
        <NewDmModal
          workspaceId={active.workspace_id}
          currentUserId={profile?.id}
          onClose={() => setShowNew(false)}
          onStart={(ids, name) => {
            setShowNew(false);
            startConversation(ids, name);
          }}
        />
      )}
    </div>
  );
};

const NewDmModal = ({ workspaceId, currentUserId, onClose, onStart }) => {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id, profile:profiles(id, username, avatar_url)")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .neq("user_id", currentUserId);
      setMembers(data || []);
    };
    run();
  }, [workspaceId, currentUserId]);

  const filtered = members.filter((m) => m.profile?.username?.toLowerCase().includes(query.toLowerCase()));

  return (
    <Modal title="New direct message" onClose={onClose}>
      <input
        className="nx-input"
        placeholder="Search people..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <div className="dm-member-picker nx-scroll">
        {filtered.map((m) => (
          <label className="dm-member-row" key={m.user_id}>
            <input
              type="checkbox"
              checked={selected.includes(m.user_id)}
              onChange={(e) =>
                setSelected((prev) => (e.target.checked ? [...prev, m.user_id] : prev.filter((id) => id !== m.user_id)))
              }
            />
            <Avatar src={m.profile?.avatar_url} name={m.profile?.username} size={24} />
            <span>{m.profile?.username}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="nx-muted" style={{ fontSize: 12 }}>No matches.</p>}
      </div>
      <div className="nx-modal-actions">
        <button type="button" className="nx-btn" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="nx-btn nx-btn-primary"
          disabled={!selected.length}
          onClick={() => onStart(selected)}
        >
          Start conversation
        </button>
      </div>
    </Modal>
  );
};

export default DirectMessages;
