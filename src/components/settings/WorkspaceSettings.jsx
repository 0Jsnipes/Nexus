import { useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../lib/supabase";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { uploadFile } from "../../lib/storage";
import { useAuthStore } from "../../lib/authStore";
import Avatar from "../shared/Avatar";

const WorkspaceSettings = () => {
  const active = useWorkspaceStore(selectActiveMembership);
  const can = useWorkspaceStore((s) => s.can);
  const fetchMemberships = useWorkspaceStore((s) => s.fetchMemberships);
  const session = useAuthStore((s) => s.session);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(active?.workspace.logo_url);
  const editable = can("manage_workspace_settings");

  const handleLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadFile(`profile/${session.user.id}`, file);
    setLogoUrl(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { name, slug, description } = Object.fromEntries(new FormData(e.target));

    const { error } = await supabase
      .from("workspaces")
      .update({ name, slug: slug || null, description: description || null, logo_url: logoUrl })
      .eq("id", active.workspace_id);

    if (error) toast.error(error.message);
    else {
      toast.success("Workspace updated.");
      fetchMemberships();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="settings-form">
      <label className="onboarding-logo-picker" htmlFor="wlogo" style={editable ? undefined : { pointerEvents: "none", opacity: 0.6 }}>
        <Avatar src={logoUrl} name={active?.workspace.name} size={56} />
        <span>Change logo</span>
      </label>
      <input type="file" id="wlogo" accept="image/*" style={{ display: "none" }} onChange={handleLogo} disabled={!editable} />

      <div className="nx-field">
        <label>Workspace name</label>
        <input className="nx-input" name="name" defaultValue={active?.workspace.name} required disabled={!editable} />
      </div>
      <div className="nx-field">
        <label>Slug</label>
        <input className="nx-input" name="slug" defaultValue={active?.workspace.slug} disabled={!editable} />
      </div>
      <div className="nx-field">
        <label>Description</label>
        <textarea className="nx-textarea" name="description" rows={3} defaultValue={active?.workspace.description} disabled={!editable} />
      </div>
      {editable && <button type="submit" className="nx-btn nx-btn-primary" disabled={loading}>{loading ? "Saving..." : "Save changes"}</button>}
      {!editable && <p className="nx-hint">Only workspace owners/admins with the manage settings permission can edit this.</p>}
    </form>
  );
};

export default WorkspaceSettings;
