import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../shared/Modal";
import { useWorkspaceStore } from "../../lib/workspaceStore";
import { useAuthStore } from "../../lib/authStore";
import { uploadFile } from "../../lib/storage";

export const CreateWorkspaceModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const session = useAuthStore((s) => s.session);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { name, slug, description, logo } = Object.fromEntries(new FormData(e.target));

    if (!name?.trim()) {
      setLoading(false);
      return toast.warn("Workspace name is required.");
    }

    try {
      let logoUrl = "";
      if (logo?.size) logoUrl = await uploadFile(`profile/${session.user.id}`, logo);
      await createWorkspace({ name: name.trim(), slug: slug?.trim(), description: description?.trim(), logoUrl });
      toast.success(`${name} created.`);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Create workspace" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="nx-field">
          <label>Workspace name</label>
          <input className="nx-input" name="name" placeholder="Acme Inc." required />
        </div>
        <div className="nx-field">
          <label>Slug (optional)</label>
          <input className="nx-input" name="slug" placeholder="acme" />
        </div>
        <div className="nx-field">
          <label>Description (optional)</label>
          <textarea className="nx-textarea" name="description" rows={2} />
        </div>
        <div className="nx-field">
          <label>Logo (optional)</label>
          <input className="nx-input" type="file" name="logo" accept="image/*" />
        </div>
        <div className="nx-modal-actions">
          <button type="button" className="nx-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="nx-btn nx-btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const JoinWorkspaceModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const joinWorkspace = useWorkspaceStore((s) => s.joinWorkspace);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { code } = Object.fromEntries(new FormData(e.target));

    try {
      const result = await joinWorkspace(code.trim());
      if (!result.ok) {
        const messages = {
          invalid_code: "That join code doesn't match any workspace.",
          code_disabled: "This workspace isn't accepting new members right now.",
          already_member: "You're already a member of this workspace.",
        };
        toast.warn(messages[result.error] || "Couldn't join that workspace.");
      } else {
        toast.success(result.status === "pending" ? `Request sent to join ${result.name}.` : `Welcome to ${result.name}!`);
        onClose();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Join workspace" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="nx-field">
          <label>Join code</label>
          <input className="nx-input" name="code" placeholder="e.g. 8F3KQ2LM" required />
        </div>
        <div className="nx-modal-actions">
          <button type="button" className="nx-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="nx-btn nx-btn-primary" disabled={loading}>
            {loading ? "Joining..." : "Join"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
