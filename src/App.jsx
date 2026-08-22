import { useEffect, useState } from "react";
import Home from "./components/home/Home";
import Auth from "./components/auth/Auth";
import Onboarding from "./components/onboarding/Onboarding";
import AppShell from "./components/shell/AppShell";
import LegalPage from "./components/legal/LegalPage";
import Notification from "./components/notifications/Notification";
import { NavProvider } from "./lib/NavContext";
import { useAuthStore } from "./lib/authStore";
import { useWorkspaceStore } from "./lib/workspaceStore";
import { applyTheme, getStoredTheme, watchSystemTheme } from "./lib/theme";

// Privacy/Terms are linked from pre-auth pages, so they're resolved from the
// URL hash rather than the in-app NavContext router (which only exists once
// a workspace is loaded).
const LEGAL_HASHES = { "#/privacy": "privacy", "#/terms": "terms" };
const getLegalPage = () => LEGAL_HASHES[window.location.hash] || null;

// Installed PWA launches carry ?src=pwa (see public/manifest.json start_url)
// so returning users skip the marketing homepage and land straight on sign-in.
const isPwaLaunch = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("src") === "pwa";

const App = () => {
  const [showHome, setShowHome] = useState(() => !isPwaLaunch());
  const [legalPage, setLegalPage] = useState(getLegalPage);
  const session = useAuthStore((s) => s.session);
  const authLoading = useAuthStore((s) => s.isLoading);
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery);
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

  useEffect(() => {
    const onHashChange = () => setLegalPage(getLegalPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (legalPage) {
    return (
      <>
        <LegalPage type={legalPage} onBack={() => { window.location.hash = ""; }} />
        <Notification />
      </>
    );
  }

  if (authLoading) return <div className="loading">Loading...</div>;

  if (isPasswordRecovery) {
    return (
      <>
        <Auth initialView="recovery" />
        <Notification />
      </>
    );
  }

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

  // Only block on the *first* membership fetch. workspaceLoading also
  // flips true on background refetches (e.g. after saving workspace/
  // security settings) — gating on it alone would unmount NavProvider on
  // every such refetch and reset the user back to the dashboard tab.
  if (workspaceLoading && memberships.length === 0) return <div className="loading">Loading...</div>;

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
