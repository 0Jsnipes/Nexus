import { useState } from "react";
import { FiChevronDown, FiPlus, FiLogIn } from "react-icons/fi";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import Avatar from "../shared/Avatar";

const WorkspaceSwitcher = ({ onCreateWorkspace, onJoinWorkspace }) => {
  const [open, setOpen] = useState(false);
  const memberships = useWorkspaceStore((s) => s.memberships);
  const active = useWorkspaceStore(selectActiveMembership);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  if (!active) return null;

  return (
    <div className="ws-switcher">
      <button type="button" className="ws-switcher-trigger" onClick={() => setOpen((v) => !v)}>
        <Avatar src={active.workspace.logo_url} name={active.workspace.name} size={26} />
        <span className="ws-switcher-name">{active.workspace.name}</span>
        <FiChevronDown size={14} />
      </button>

      {open && (
        <>
          <div className="ws-switcher-scrim" onClick={() => setOpen(false)} />
          <div className="ws-switcher-menu">
            {memberships.map((m) => (
              <button
                type="button"
                key={m.workspace_id}
                className={`ws-switcher-item ${m.workspace_id === active.workspace_id ? "is-active" : ""}`}
                onClick={() => {
                  switchWorkspace(m.workspace_id);
                  setOpen(false);
                }}
              >
                <Avatar src={m.workspace.logo_url} name={m.workspace.name} size={22} />
                <span>{m.workspace.name}</span>
              </button>
            ))}
            <hr className="nx-divider" />
            <button
              type="button"
              className="ws-switcher-item"
              onClick={() => {
                setOpen(false);
                onCreateWorkspace();
              }}
            >
              <FiPlus size={16} /> <span>Create workspace</span>
            </button>
            <button
              type="button"
              className="ws-switcher-item"
              onClick={() => {
                setOpen(false);
                onJoinWorkspace();
              }}
            >
              <FiLogIn size={16} /> <span>Join workspace</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
