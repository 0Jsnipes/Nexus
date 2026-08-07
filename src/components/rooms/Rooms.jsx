import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "./rooms.css";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { useMessages } from "../messaging/useMessages";
import MessageList from "../messaging/MessageList";
import MessageComposer from "../messaging/MessageComposer";
import EmptyState from "../shared/EmptyState";
import Modal from "../shared/Modal";
import { FiArrowLeft, FiHash, FiLock, FiPlus, FiSearch } from "react-icons/fi";

const Rooms = ({ route, navigate }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  const profile = useAuthStore((s) => s.profile);
  const active = useWorkspaceStore(selectActiveMembership);
  const can = useWorkspaceStore((s) => s.can);
  const roomId = route.params?.roomId;
  const activeRoom = rooms.find((r) => r.id === roomId);

  const fetchRooms = async () => {
    if (!active) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("workspace_id", active.workspace_id)
      .is("archived_at", null)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else {
      setRooms(data || []);
      if (!roomId && data?.length) navigate("rooms", { roomId: data[0].id });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.workspace_id]);

  const { messages, sendMessage, editMessage, deleteMessage, toggleReaction } = useMessages({
    workspaceId: active?.workspace_id,
    roomId,
    roomName: activeRoom?.name,
    isPrivateRoom: activeRoom?.is_private,
  });

  const filteredRooms = rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  const handleSend = async (payload) => {
    if (editingMessage) {
      await editMessage(editingMessage.id, payload.body);
      setEditingMessage(null);
      return;
    }
    await sendMessage(payload);
  };

  if (!active) return null;

  return (
    <div className={`rooms-layout ${activeRoom ? "has-active" : ""}`}>
      <aside className="rooms-sidebar">
        <div className="rooms-sidebar-header">
          <h3>Rooms</h3>
          {can("create_rooms") && (
            <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-btn-sm" onClick={() => setShowCreate(true)}>
              <FiPlus size={15} />
            </button>
          )}
        </div>
        <div className="rooms-search">
          <FiSearch size={13} />
          <input placeholder="Search rooms" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="rooms-list nx-scroll">
          {loading && <div className="nx-skeleton" style={{ height: 32, margin: "4px 8px" }} />}
          {!loading && filteredRooms.length === 0 && (
            <p className="nx-muted" style={{ padding: "8px 12px", fontSize: 12 }}>No rooms found.</p>
          )}
          {filteredRooms.map((room) => (
            <button
              type="button"
              key={room.id}
              className={`rooms-list-item ${room.id === roomId ? "is-active" : ""}`}
              onClick={() => navigate("rooms", { roomId: room.id })}
            >
              {room.is_private ? <FiLock size={13} /> : <FiHash size={13} />}
              <span>{room.name}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="rooms-main">
        {!activeRoom ? (
          <EmptyState
            title="No room selected"
            description={rooms.length ? "Choose a room from the left." : "Create the first room for this workspace."}
            action={
              can("create_rooms") && !rooms.length ? (
                <button type="button" className="nx-btn nx-btn-primary" onClick={() => setShowCreate(true)}>
                  Create room
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="rooms-header">
              <button
                type="button"
                className="nx-icon-btn rooms-back"
                onClick={() => navigate("rooms", {})}
                aria-label="Back to rooms"
              >
                <FiArrowLeft size={16} />
              </button>
              <div>
                <h2>{activeRoom.is_private ? <FiLock size={14} /> : <FiHash size={14} />} {activeRoom.name}</h2>
                {activeRoom.topic && <p className="nx-muted">{activeRoom.topic}</p>}
              </div>
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
                emptyLabel={`Say hello in #${activeRoom.name}.`}
              />
            </div>
            <MessageComposer
              workspaceId={active.workspace_id}
              placeholder={`Message #${activeRoom.name}`}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSend={handleSend}
            />
          </>
        )}
      </section>

      {showCreate && (
        <CreateRoomModal
          workspaceId={active.workspace_id}
          onClose={() => setShowCreate(false)}
          onCreated={(room) => {
            setShowCreate(false);
            fetchRooms();
            navigate("rooms", { roomId: room.id });
          }}
        />
      )}
    </div>
  );
};

const CreateRoomModal = ({ workspaceId, onClose, onCreated }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { name, topic, isPrivate } = Object.fromEntries(new FormData(e.target));

    if (!name?.trim()) {
      setLoading(false);
      return toast.warn("Room name is required.");
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        topic: topic?.trim() || null,
        is_private: isPrivate === "on",
        created_by: sessionData.session.user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.is_private) {
      await supabase.from("room_members").insert({ room_id: data.id, user_id: sessionData.session.user.id });
    }

    toast.success(`#${data.name} created.`);
    onCreated(data);
  };

  return (
    <Modal title="Create room" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="nx-field">
          <label>Room name</label>
          <input className="nx-input" name="name" placeholder="marketing" required />
        </div>
        <div className="nx-field">
          <label>Topic (optional)</label>
          <input className="nx-input" name="topic" placeholder="What's this room about?" />
        </div>
        <label className="nx-row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="isPrivate" /> Private room
        </label>
        <div className="nx-modal-actions">
          <button type="button" className="nx-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="nx-btn nx-btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create room"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default Rooms;
