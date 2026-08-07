import { NAV_ITEMS } from "./navItems";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

const Sidebar = ({ route, navigate, collapsed, onNavigate, onCreateWorkspace, onJoinWorkspace, badges }) => {
  return (
    <nav className={`nx-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="nx-sidebar-header">
        <span className="nx-sidebar-wordmark">{collapsed ? "N" : "Nexus"}</span>
      </div>

      {!collapsed && (
        <WorkspaceSwitcher onCreateWorkspace={onCreateWorkspace} onJoinWorkspace={onJoinWorkspace} />
      )}

      <ul className="nx-sidebar-nav">
        {NAV_ITEMS.map(({ section, label, icon: Icon }) => {
          const badge = badges?.[section];
          return (
            <li key={section}>
              <button
                type="button"
                className={`nx-sidebar-item ${route.section === section ? "is-active" : ""}`}
                onClick={() => {
                  navigate(section);
                  onNavigate?.();
                }}
                title={collapsed ? label : undefined}
              >
                <Icon size={17} />
                {!collapsed && <span>{label}</span>}
                {!!badge && <span className="nx-sidebar-badge">{badge > 99 ? "99+" : badge}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default Sidebar;
