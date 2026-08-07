import { useEffect, useState } from "react";
import { FiHash, FiUser } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";

const CommandPalette = ({ onClose, navigate }) => {
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState([]);
  const [members, setMembers] = useState([]);
  const active = useWorkspaceStore(selectActiveMembership);

  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!active || query.trim().length < 1) {
      setRooms([]);
      setMembers([]);
      return;
    }

    const run = async () => {
      const [roomsRes, membersRes] = await Promise.all([
        supabase
          .from("rooms")
          .select("id, name, topic")
          .eq("workspace_id", active.workspace_id)
          .ilike("name", `%${query}%`)
          .limit(6),
        supabase
          .from("workspace_members")
          .select("user_id, profile:profiles(username, avatar_url)")
          .eq("workspace_id", active.workspace_id)
          .eq("status", "active")
          .limit(30),
      ]);
      setRooms(roomsRes.data || []);
      setMembers((membersRes.data || []).filter((m) => m.profile?.username?.toLowerCase().includes(query.toLowerCase())));
    };
    run();
  }, [query, active]);

  return (
    <div className="nx-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nx-command-palette">
        <input
          autoFocus
          className="nx-command-input"
          placeholder="Search rooms, people..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="nx-command-results">
          {query.trim().length < 1 && <p className="nx-command-hint">Start typing to search this workspace.</p>}

          {rooms.length > 0 && (
            <div className="nx-command-group">
              <span className="nx-command-group-label">Rooms</span>
              {rooms.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="nx-command-result"
                  onClick={() => {
                    navigate("rooms", { roomId: r.id });
                    onClose();
                  }}
                >
                  <FiHash size={14} /> <span>{r.name}</span>
                </button>
              ))}
            </div>
          )}

          {members.length > 0 && (
            <div className="nx-command-group">
              <span className="nx-command-group-label">People</span>
              {members.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  className="nx-command-result"
                  onClick={() => {
                    navigate("dms", { newDmWith: m.user_id });
                    onClose();
                  }}
                >
                  <FiUser size={14} /> <span>{m.profile?.username}</span>
                </button>
              ))}
            </div>
          )}

          {query.trim().length > 0 && rooms.length === 0 && members.length === 0 && (
            <p className="nx-command-hint">No matches.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
