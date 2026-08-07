import { useEffect, useState } from "react";
import Home from "./components/home/Home";
import Auth from "./components/auth/Auth";
import Onboarding from "./components/onboarding/Onboarding";
import AppShell from "./components/shell/AppShell";
import Notification from "./components/notifications/Notification";
import { NavProvider } from "./lib/NavContext";
import { useAuthStore } from "./lib/authStore";
import { useWorkspaceStore } from "./lib/workspaceStore";
import { applyTheme, getStoredTheme, watchSystemTheme } from "./lib/theme";

// Installed PWA launches carry ?src=pwa (see public/manifest.json start_url)
// so returning users skip the marketing homepage and land straight on sign-in.
const isPwaLaunch = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("src") === "pwa";

const App = () => {
  const [showHome, setShowHome] = useState(() => !isPwaLaunch());
  const session = useAuthStore((s) => s.session);
  const authLoading = useAuthStore((s) => s.isLoading);
  const initAuth = useAuthStore((s) => s.init);
  const memberships = useWorkspaceStore((s) => s.memberships);
  const workspaceLoading = useWorkspaceStore((s) => s.isLoading);
  const fetchMemberships = useWorkspaceStore((s) => s.fetchMemberships);

  useEffect(() => {
    applyTheme(getStoredTheme());
    const unwatch = watchSystemTheme();
    initAuth();
    return unwatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session) fetchMemberships();
  }, [session, fetchMemberships]);

  if (authLoading) return <div className="loading">Loading...</div>;

  if (!session) {
    if (showHome) {
      return (
        <>
          <Home onEnter={() => setShowHome(false)} />
          <Notification />
        </>
      );
    }
    return (
      <>
        <Auth />
        <Notification />
      </>
    );
  }

  if (workspaceLoading) return <div className="loading">Loading...</div>;

  if (memberships.length === 0) {
    return (
      <>
        <Onboarding />
        <Notification />
      </>
    );
  }

  return (
    <NavProvider>
      <AppShell />
      <Notification />
    </NavProvider>
  );
};

export default App;
