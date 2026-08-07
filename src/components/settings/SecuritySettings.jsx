import { useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { useWorkspaceMembers } from "../../lib/useWorkspaceMembers";

const SecuritySettings = () => {
  const active = useWorkspaceStore(selectActiveMembership);
  const can = useWorkspaceStore((s) => s.can);
  const fetchMemberships = useWorkspaceStore((s) => s.fetchMemberships);
  const leaveWorkspace = useWorkspaceStore((s) => s.leaveWorkspace);
  const profile = useAuthStore((s) => s.profile);
  const { members } = useWorkspaceMembers(active?.workspace_id);
  const isOwner = active?.workspace.owner_id === profile?.id;
  const editable = can("manage_workspace_settings");
  const [transferTo, setTransferTo] = useState("");

  const regenerateCode = async () => {
    const { error } = await supabase.rpc("regenerate_join_code", { _workspace_id: active.workspace_id });
    if (error) return toast.error(error.message);
    toast.success("Join code regenerated.");
    fetchMemberships();
  };

  const toggleCodeEnabled = async () => {
    await supabase.from("workspaces").update({ join_code_enabled: !active.workspace.join_code_enabled }).eq("id", active.workspace_id);
    fetchMemberships();
  };

  const toggleRequireApproval = async () => {
    await supabase.from("workspaces").update({ require_approval: !active.workspace.require_approval }).eq("id", active.workspace_id);
    fetchMemberships();
  };

  const transferOwnership = async () => {
    if (!transferTo) return;
    if (!window.confirm("Transfer ownership? You will become an admin.")) return;
    const { error } = await supabase.rpc("transfer_workspace_ownership", { _workspace_id: active.workspace_id, _new_owner_id: transferTo });
    if (error) return toast.error(error.message);
    toast.success("Ownership transferred.");
    fetchMemberships();
  };

  const deleteWorkspace = async () => {
    if (!window.confirm(`Delete "${active.workspace.name}" permanently? This cannot be undone.`)) return;
    const { error } = await supabase.from("workspaces").delete().eq("id", active.workspace_id);
    if (error) return toast.error(error.message);
    toast.success("Workspace deleted.");
    fetchMemberships();
  };

  if (!active) return null;

  return (
    <div className="settings-form">
      <div className="nx-field">
        <label>Join code</label>
        <div className="nx-row">
          <input className="nx-input" readOnly value={active.workspace.join_code} style={{ maxWidth: 200 }} />
          {editable && <button type="button" className="nx-btn nx-btn-sm" onClick={regenerateCode}>Regenerate</button>}
        </div>
      </div>

      <label className="nx-row" style={{ fontSize: 13, marginBottom: 10 }}>
        <input type="checkbox" checked={active.workspace.join_code_enabled} onChange={toggleCodeEnabled} disabled={!editable} />
        Join code is active
      </label>

      <label className="nx-row" style={{ fontSize: 13, marginBottom: 16 }}>
        <input type="checkbox" checked={active.workspace.require_approval} onChange={toggleRequireApproval} disabled={!editable} />
        Require approval to join
      </label>

      {isOwner && (
        <>
          <hr className="nx-divider" />
          <div className="nx-field">
            <label>Transfer ownership</label>
            <div className="nx-row">
              <select className="nx-select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                <option value="">Select a member</option>
                {members.filter((m) => m.user_id !== profile?.id && m.status === "active").map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.profile?.username}</option>
                ))}
              </select>
              <button type="button" className="nx-btn nx-btn-sm" disabled={!transferTo} onClick={transferOwnership}>Transfer</button>
            </div>
          </div>

          <hr className="nx-divider" />
          <button type="button" className="nx-btn nx-btn-danger" onClick={deleteWorkspace}>Delete workspace</button>
        </>
      )}

      {!isOwner && (
        <>
          <hr className="nx-divider" />
          <button type="button" className="nx-btn nx-btn-danger" onClick={() => leaveWorkspace(active.workspace_id)}>Leave workspace</button>
        </>
      )}
    </div>
  );
};

export default SecuritySettings;
