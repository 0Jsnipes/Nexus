import { useEffect, useState } from "react";
import "./shell.css";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import CommandPalette from "./CommandPalette";
import { CreateWorkspaceModal, JoinWorkspaceModal } from "./WorkspaceModals";
import { useNav } from "../../lib/NavContext";

import Dashboard from "../dashboard/Dashboard";
import Rooms from "../rooms/Rooms";
import DirectMessages from "../dm/DirectMessages";
import Projects from "../projects/Projects";
import MyTasks from "../tasks/MyTasks";
import Schedule from "../schedule/Schedule";
import Meetings from "../meetings/Meetings";
import Files from "../files/Files";
import Team from "../team/Team";
import NotificationCenter from "../notifications/NotificationCenter";
import Settings from "../settings/Settings";

const SECTION_COMPONENTS = {
  home: Dashboard,
  rooms: Rooms,
  dms: DirectMessages,
  projects: Projects,
  tasks: MyTasks,
  schedule: Schedule,
  meetings: Meetings,
  files: Files,
  team: Team,
  notifications: NotificationCenter,
  settings: Settings,
};

const AppShell = () => {
  const { route, navigate } = useNav();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("nexus:sidebarCollapsed") === "1");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [modal, setModal] = useState(null); // "create" | "join" | null
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem("nexus:sidebarCollapsed", !v ? "1" : "0");
      return !v;
    });
  };

  const ActiveSection = SECTION_COMPONENTS[route.section] || Dashboard;

  return (
    <div className="nx nx-shell">
      <div className="nx-sidebar-desktop">
        <Sidebar
          route={route}
          navigate={navigate}
          collapsed={collapsed}
          onCreateWorkspace={() => setModal("create")}
          onJoinWorkspace={() => setModal("join")}
        />
        <button type="button" className="nx-sidebar-collapse-btn" onClick={toggleCollapsed}>
          {collapsed ? "»" : "« Collapse"}
        </button>
      </div>

      {mobileNavOpen && (
        <div className="nx-mobile-drawer">
          <div className="nx-mobile-drawer-scrim" onClick={() => setMobileNavOpen(false)} />
          <div className="nx-mobile-drawer-panel">
            <Sidebar
              route={route}
              navigate={navigate}
              collapsed={false}
              onNavigate={() => setMobileNavOpen(false)}
              onCreateWorkspace={() => {
                setMobileNavOpen(false);
                setModal("create");
              }}
              onJoinWorkspace={() => {
                setMobileNavOpen(false);
                setModal("join");
              }}
            />
          </div>
        </div>
      )}

      <div className="nx-shell-main">
        <TopBar
          route={route}
          navigate={navigate}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
          isOffline={isOffline}
        />
        <main className="nx-shell-content">
          <ActiveSection route={route} navigate={navigate} />
        </main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} navigate={navigate} />}
      {modal === "create" && <CreateWorkspaceModal onClose={() => setModal(null)} />}
      {modal === "join" && <JoinWorkspaceModal onClose={() => setModal(null)} />}
    </div>
  );
};

export default AppShell;
