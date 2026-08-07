import { useState } from "react";
import { FiMenu, FiSearch, FiWifiOff } from "react-icons/fi";
import { NAV_ITEMS } from "./navItems";
import Avatar from "../shared/Avatar";
import { useAuthStore } from "../../lib/authStore";

const TopBar = ({ route, navigate, onOpenMobileNav, onOpenSearch, isOffline }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const label = NAV_ITEMS.find((n) => n.section === route.section)?.label || "";

  return (
    <header className="nx-topbar">
      <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-topbar-menu" onClick={onOpenMobileNav}>
        <FiMenu size={18} />
      </button>

      <h1 className="nx-topbar-title">{label}</h1>

      {isOffline && (
        <span className="nx-badge nx-badge-warning nx-topbar-offline">
          <FiWifiOff size={12} /> Reconnecting...
        </span>
      )}

      <button type="button" className="nx-topbar-search" onClick={onOpenSearch}>
        <FiSearch size={14} />
        <span>Search Nexus...</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="nx-topbar-user">
        <button type="button" className="nx-topbar-avatar-btn" onClick={() => setMenuOpen((v) => !v)}>
          <Avatar src={profile?.avatar_url} name={profile?.username} size={28} />
        </button>
        {menuOpen && (
          <>
            <div className="ws-switcher-scrim" onClick={() => setMenuOpen(false)} />
            <div className="ws-switcher-menu nx-topbar-menu-panel">
              <div className="nx-topbar-menu-name">{profile?.username}</div>
              <button
                type="button"
                className="ws-switcher-item"
                onClick={() => {
                  navigate("settings", { tab: "profile" });
                  setMenuOpen(false);
                }}
              >
                Profile settings
              </button>
              <hr className="nx-divider" />
              <button type="button" className="ws-switcher-item" onClick={logout}>
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default TopBar;
