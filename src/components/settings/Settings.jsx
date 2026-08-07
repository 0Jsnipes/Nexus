import { useState } from "react";
import "./settings.css";
import ProfileSettings from "./ProfileSettings";
import WorkspaceSettings from "./WorkspaceSettings";
import RolesSettings from "./RolesSettings";
import AppearanceSettings from "./AppearanceSettings";
import SecuritySettings from "./SecuritySettings";
import IntegrationsSettings from "./IntegrationsSettings";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "workspace", label: "Workspace" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "appearance", label: "Appearance" },
  { id: "integrations", label: "Integrations" },
  { id: "security", label: "Security" },
];

const Settings = ({ route }) => {
  const [tab, setTab] = useState(route.params?.tab || "profile");

  return (
    <div className="nx-page settings-page">
      <div className="nx-page-header" style={{ marginBottom: 24 }}>
        <h2>Settings</h2>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`settings-nav-item ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "profile" && <ProfileSettings />}
          {tab === "workspace" && <WorkspaceSettings />}
          {tab === "roles" && <RolesSettings />}
          {tab === "appearance" && <AppearanceSettings />}
          {tab === "integrations" && <IntegrationsSettings />}
          {tab === "security" && <SecuritySettings />}
        </div>
      </div>
    </div>
  );
};

export default Settings;
