import { useState } from "react";
import "./settings.css";
import { FiUser, FiBriefcase, FiShield, FiDroplet, FiBell, FiGrid, FiLock } from "react-icons/fi";
import ProfileSettings from "./ProfileSettings";
import WorkspaceSettings from "./WorkspaceSettings";
import RolesSettings from "./RolesSettings";
import AppearanceSettings from "./AppearanceSettings";
import NotificationSettings from "./NotificationSettings";
import SecuritySettings from "./SecuritySettings";
import IntegrationsSettings from "./IntegrationsSettings";

const TABS = [
  { id: "profile", label: "Profile", icon: FiUser },
  { id: "workspace", label: "Workspace", icon: FiBriefcase },
  { id: "roles", label: "Roles & Permissions", icon: FiShield },
  { id: "appearance", label: "Appearance", icon: FiDroplet },
  { id: "notifications", label: "Notifications", icon: FiBell },
  { id: "integrations", label: "Integrations", icon: FiGrid },
  { id: "security", label: "Security", icon: FiLock },
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
            <button
              key={t.id}
              type="button"
              className={`settings-nav-item ${tab === t.id ? "is-active" : ""}`}
              onClick={() => setTab(t.id)}
              title={t.label}
              aria-label={t.label}
            >
              <t.icon size={15} className="settings-nav-icon" />
              <span className="settings-nav-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "profile" && <ProfileSettings />}
          {tab === "workspace" && <WorkspaceSettings />}
          {tab === "roles" && <RolesSettings />}
          {tab === "appearance" && <AppearanceSettings />}
          {tab === "notifications" && <NotificationSettings />}
          {tab === "integrations" && <IntegrationsSettings />}
          {tab === "security" && <SecuritySettings />}
        </div>
      </div>
    </div>
  );
};

export default Settings;
