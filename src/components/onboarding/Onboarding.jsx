import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "./onboarding.css";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore } from "../../lib/workspaceStore";
import { uploadFile } from "../../lib/storage";
import { PENDING_JOIN_CODE_KEY, JOIN_ERROR_MESSAGES } from "../../lib/joinWorkspaceCode";
import Avatar from "../shared/Avatar";

const Onboarding = () => {
  const [tab, setTab] = useState("create"); // "create" | "join"
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState({ file: null, url: "" });
  const session = useAuthStore((s) => s.session);
  const { createWorkspace, joinWorkspace, logout } = useWorkspaceStoreActions();

  useEffect(() => {
    const pendingCode = localStorage.getItem(PENDING_JOIN_CODE_KEY);
    if (!pendingCode) return;
    localStorage.removeItem(PENDING_JOIN_CODE_KEY);
    setTab("join");
    setLoading(true);
    joinWorkspace(pendingCode)
      .then((result) => {
        if (!result.ok) {
          toast.warn(JOIN_ERROR_MESSAGES[result.error] || "Couldn't join that workspace.");
        } else if (result.status === "pending") {
          toast.info(`Request sent to join ${result.name}. Waiting on approval.`);
        } else {
          toast.success(`Welcome to ${result.name}!`);
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (file) setLogo({ file, url: URL.createObjectURL(file) });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { name, slug, description } = Object.fromEntries(new FormData(e.target));

    if (!name?.trim()) {
      setLoading(false);
      return toast.warn("Workspace name is required.");
    }

    try {
      let logoUrl = "";
      if (logo.file) {
        logoUrl = await uploadFile(`profile/${session.user.id}`, logo.file);
      }
      await createWorkspace({ name: name.trim(), slug: slug?.trim(), description: description?.trim(), logoUrl });
      toast.success(`${name} is ready.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { code } = Object.fromEntries(new FormData(e.target));

    try {
      const result = await joinWorkspace(code.trim());
      if (!result.ok) {
        toast.warn(JOIN_ERROR_MESSAGES[result.error] || "Couldn't join that workspace.");
      } else if (result.status === "pending") {
        toast.info(`Request sent to join ${result.name}. Waiting on approval.`);
      } else {
        toast.success(`Welcome to ${result.name}!`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nx onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <span className="onboarding-wordmark">Nexus</span>
          <p>Where teams, projects, and conversations connect.</p>
        </div>

        <div className="onboarding-tabs">
          <button
            type="button"
            className={`onboarding-tab ${tab === "create" ? "is-active" : ""}`}
            onClick={() => setTab("create")}
          >
            Create workspace
          </button>
          <button
            type="button"
            className={`onboarding-tab ${tab === "join" ? "is-active" : ""}`}
            onClick={() => setTab("join")}
          >
            Join workspace
          </button>
        </div>

        {tab === "create" ? (
          <form onSubmit={handleCreate} className="onboarding-form">
            <label className="onboarding-logo-picker" htmlFor="logo">
              <Avatar src={logo.url} name={undefined} size={56} />
              <span>Upload logo (optional)</span>
            </label>
            <input type="file" id="logo" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />

            <div className="nx-field">
              <label htmlFor="name">Workspace name</label>
              <input className="nx-input" id="name" name="name" placeholder="Acme Inc." required />
            </div>
            <div className="nx-field">
              <label htmlFor="slug">Slug (optional)</label>
              <input className="nx-input" id="slug" name="slug" placeholder="acme" />
            </div>
            <div className="nx-field">
              <label htmlFor="description">Description (optional)</label>
              <textarea className="nx-textarea" id="description" name="description" rows={2} />
            </div>
            <button className="nx-btn nx-btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create workspace"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="onboarding-form">
            <div className="nx-field">
              <label htmlFor="code">Join code</label>
              <input className="nx-input" id="code" name="code" placeholder="e.g. 8F3KQ2LM" required />
              <span className="nx-hint">Ask a workspace admin for the join code.</span>
            </div>
            <button className="nx-btn nx-btn-primary" disabled={loading}>
              {loading ? "Joining..." : "Join workspace"}
            </button>
          </form>
        )}

        <button type="button" className="nx-btn nx-btn-ghost onboarding-logout" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
};

const useWorkspaceStoreActions = () => {
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const joinWorkspace = useWorkspaceStore((s) => s.joinWorkspace);
  const logout = useAuthStore((s) => s.logout);
  return { createWorkspace, joinWorkspace, logout };
};

export default Onboarding;
