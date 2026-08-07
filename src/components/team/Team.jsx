import { useState } from "react";
import { toast } from "react-toastify";
import "./team.css";
import { supabase } from "../../lib/supabase";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { useWorkspaceMembers } from "../../lib/useWorkspaceMembers";
import { useAuthStore } from "../../lib/authStore";
import Avatar from "../shared/Avatar";
import { ROLES } from "../../lib/permissions";
import { FiCopy } from "react-icons/fi";

const Team = () => {
  const [search, setSearch] = useState("");
  const active = useWorkspaceStore(selectActiveMembership);
  const can = useWorkspaceStore((s) => s.can);
  const fetchMemberships = useWorkspaceStore((s) => s.fetchMemberships);
  const profile = useAuthStore((s) => s.profile);
  const { members, loading } = useWorkspaceMembers(active?.workspace_id);
  const [localMembers, setLocalMembers] = useState(null);

  const list = localMembers || members;
  const activeMembers = list.filter((m) => m.status === "active" && m.profile?.username?.toLowerCase().includes(search.toLowerCase()));
  const pendingMembers = list.filter((m) => m.status === "pending");

  const copyCode = () => {
    navigator.clipboard.writeText(active.workspace.join_code);
    toast.success("Join code copied.");
  };

  const changeRole = async (memberId, role) => {
    const { error } = await supabase.from("workspace_members").update({ role }).eq("id", memberId);
    if (error) return toast.error(error.message);
    setLocalMembers(list.map((m) => (m.id === memberId ? { ...m, role } : m)));
    toast.success("Role updated.");
  };

  const approveMember = async (memberId) => {
    const { error } = await supabase.from("workspace_members").update({ status: "active" }).eq("id", memberId);
    if (error) return toast.error(error.message);
    setLocalMembers(list.map((m) => (m.id === memberId ? { ...m, status: "active" } : m)));
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.profile?.username} from this workspace?`)) return;
    const { error } = await supabase.from("workspace_members").delete().eq("id", member.id);
    if (error) return toast.error(error.message);
    setLocalMembers(list.filter((m) => m.id !== member.id));
    if (member.user_id === profile?.id) fetchMemberships();
  };

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <h2>Team</h2>
        <button type="button" className="nx-btn" onClick={copyCode}>
          <FiCopy size={13} /> Copy join code: {active?.workspace.join_code}
        </button>
      </div>

      <input className="nx-input" placeholder="Filter members" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 260, marginBottom: 14 }} />

      {pendingMembers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--nx-text-muted)", marginBottom: 8 }}>PENDING APPROVAL</h3>
          {pendingMembers.map((m) => (
            <div key={m.id} className="team-row">
              <Avatar src={m.profile?.avatar_url} name={m.profile?.username} size={30} />
              <div className="team-row-name">
                <strong>{m.profile?.username}</strong>
                <span className="nx-muted">{m.profile?.job_title || "No title"}</span>
              </div>
              {can("invite_members") && (
                <button type="button" className="nx-btn nx-btn-sm nx-btn-primary" onClick={() => approveMember(m.id)}>Approve</button>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && <div className="nx-skeleton" style={{ height: 100 }} />}

      <div className="team-table">
        {activeMembers.map((m) => (
          <div key={m.id} className="team-row">
            <Avatar src={m.profile?.avatar_url} name={m.profile?.username} size={30} />
            <div className="team-row-name">
              <strong>{m.profile?.username}</strong>
              <span className="nx-muted">{m.profile?.job_title || m.profile?.status || "—"}</span>
            </div>
            {can("manage_roles") && m.role !== "owner" ? (
              <select className="nx-select" style={{ width: 110 }} value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                {ROLES.filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <span className="nx-badge nx-badge-accent" style={{ textTransform: "capitalize" }}>{m.role}</span>
            )}
            {can("remove_members") && m.role !== "owner" && (
              <button type="button" className="nx-btn nx-btn-sm nx-btn-danger" onClick={() => removeMember(m)}>Remove</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Team;
