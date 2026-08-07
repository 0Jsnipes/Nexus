import { NAV_GROUPS, NAV_BOTTOM_ITEMS } from "./navItems";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import Logo from "../shared/Logo";

const NavButton = ({ label, icon: Icon, active, collapsed, badge, onClick }) => (
  <li>
    <button
      type="button"
      className={`nx-sidebar-item ${active ? "is-active" : ""}`}
      onClick={onClick}
      data-tooltip={collapsed ? label : undefined}
    >
      <Icon size={16} />
      {!collapsed && <span>{label}</span>}
      {!!badge && <span className="nx-sidebar-badge">{badge > 99 ? "99+" : badge}</span>}
    </button>
  </li>
);

const Sidebar = ({ route, navigate, collapsed, onNavigate, onCreateWorkspace, onJoinWorkspace, badges }) => {
  const go = (section) => {
    navigate(section);
    onNavigate?.();
  };

  return (
    <nav className={`nx-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="nx-sidebar-header">
        <Logo size={18} className="nx-sidebar-logo" />
        {!collapsed && <span className="nx-sidebar-wordmark">NEXUS</span>}
      </div>

      {!collapsed && (
        <WorkspaceSwitcher onCreateWorkspace={onCreateWorkspace} onJoinWorkspace={onJoinWorkspace} />
      )}

      <div className="nx-sidebar-scroll">
        {NAV_GROUPS.map((group) => (
          <div className="nx-sidebar-group" key={group.label}>
            {!collapsed && <div className="nx-sidebar-group-label">{group.label}</div>}
            <ul className="nx-sidebar-nav">
              {group.items.map(({ section, label, icon }) => (
                <NavButton
                  key={section}
                  section={section}
                  label={label}
                  icon={icon}
                  collapsed={collapsed}
                  active={route.section === section}
                  badge={badges?.[section]}
                  onClick={() => go(section)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <ul className="nx-sidebar-nav nx-sidebar-bottom">
        {NAV_BOTTOM_ITEMS.map(({ section, label, icon }) => (
          <NavButton
            key={section}
            section={section}
            label={label}
            icon={icon}
            collapsed={collapsed}
            active={route.section === section}
            badge={badges?.[section]}
            onClick={() => go(section)}
          />
        ))}
      </ul>
    </nav>
  );
};

export default Sidebar;
