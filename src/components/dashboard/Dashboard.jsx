import { useEffect, useState } from "react";
import "./dashboard.css";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import EmptyState from "../shared/EmptyState";
import { priorityBadgeClass } from "../tasks/constants";
import { FiPlus, FiHash, FiFolder, FiCalendar, FiVideo, FiUserPlus } from "react-icons/fi";

const Dashboard = ({ navigate }) => {
  const [data, setData] = useState(null);
  const profile = useAuthStore((s) => s.profile);
  const active = useWorkspaceStore(selectActiveMembership);

  useEffect(() => {
    if (!active || !profile) return;
    const load = async () => {
      const workspaceId = active.workspace_id;
      const nowIso = new Date().toISOString();
      const soonIso = new Date(Date.now() + 7 * 86400000).toISOString();

      const [projects, myTasks, dueSoon, overdue, events, meetings, notifs] = await Promise.all([
        supabase.from("projects").select("id, name, status, tasks(id, status)").eq("workspace_id", workspaceId).in("status", ["active", "planned"]).limit(5),
        supabase.from("tasks").select("id, title, due_date, priority, status").eq("workspace_id", workspaceId).eq("assignee_id", profile.id).neq("status", "complete").order("due_date").limit(6),
        supabase.from("tasks").select("id, title, due_date").eq("workspace_id", workspaceId).neq("status", "complete").gte("due_date", nowIso.slice(0, 10)).lte("due_date", soonIso.slice(0, 10)).limit(5),
        supabase.from("tasks").select("id, title, due_date").eq("workspace_id", workspaceId).neq("status", "complete").lt("due_date", nowIso.slice(0, 10)).limit(5),
        supabase.from("calendar_events").select("id, title, starts_at").eq("workspace_id", workspaceId).gte("starts_at", nowIso).order("starts_at").limit(5),
        supabase.from("meetings").select("id, title, starts_at").eq("workspace_id", workspaceId).gte("starts_at", nowIso).order("starts_at").limit(5),
        supabase.from("notifications").select("id, title, created_at").eq("workspace_id", workspaceId).eq("user_id", profile.id).is("read_at", null).order("created_at", { ascending: false }).limit(5),
      ]);

      setData({
        projects: projects.data || [],
        myTasks: myTasks.data || [],
        dueSoon: dueSoon.data || [],
        overdue: overdue.data || [],
        events: events.data || [],
        meetings: meetings.data || [],
        notifs: notifs.data || [],
      });
    };
    load();
  }, [active, profile]);

  if (!active) return null;
  if (!data) return <div className="nx-page"><div className="nx-skeleton" style={{ height: 200 }} /></div>;

  const quickActions = [
    { label: "Send message", icon: FiHash, action: () => navigate("rooms") },
    { label: "Create room", icon: FiPlus, action: () => navigate("rooms") },
    { label: "Create project", icon: FiFolder, action: () => navigate("projects") },
    { label: "Schedule event", icon: FiCalendar, action: () => navigate("schedule") },
    { label: "Start meeting", icon: FiVideo, action: () => navigate("meetings") },
    { label: "Invite teammate", icon: FiUserPlus, action: () => navigate("team") },
  ];

  return (
    <div className="nx-page dashboard-page">
      <h2 style={{ marginBottom: 4 }}>Welcome back, {profile?.username}</h2>
      <p className="nx-muted" style={{ marginBottom: 18 }}>{active.workspace.name}</p>

      <div className="dashboard-quick-actions">
        {quickActions.map((qa) => (
          <button type="button" key={qa.label} className="nx-btn" onClick={qa.action}>
            <qa.icon size={13} /> {qa.label}
          </button>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="nx-panel dashboard-card">
          <h3>My tasks</h3>
          {data.myTasks.length === 0 ? <EmptyState title="Nothing assigned to you" /> : (
            <ul className="dashboard-list">
              {data.myTasks.map((t) => (
                <li key={t.id} onClick={() => navigate("projects")}>
                  <span>{t.title}</span>
                  <span className={`nx-badge ${priorityBadgeClass(t.priority)}`}>{t.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="nx-panel dashboard-card">
          <h3>Due soon &amp; overdue</h3>
          {data.dueSoon.length === 0 && data.overdue.length === 0 ? <EmptyState title="Nothing due soon" /> : (
            <ul className="dashboard-list">
              {data.overdue.map((t) => <li key={t.id}><span className="task-overdue">{t.title}</span><span className="nx-muted">{new Date(t.due_date).toLocaleDateString()}</span></li>)}
              {data.dueSoon.map((t) => <li key={t.id}><span>{t.title}</span><span className="nx-muted">{new Date(t.due_date).toLocaleDateString()}</span></li>)}
            </ul>
          )}
        </div>

        <div className="nx-panel dashboard-card">
          <h3>Active projects</h3>
          {data.projects.length === 0 ? <EmptyState title="No active projects" /> : (
            <ul className="dashboard-list">
              {data.projects.map((p) => {
                const total = p.tasks?.length || 0;
                const done = p.tasks?.filter((t) => t.status === "complete").length || 0;
                const progress = total ? Math.round((done / total) * 100) : 0;
                return (
                  <li key={p.id} onClick={() => navigate("projects", { projectId: p.id })}>
                    <span>{p.name}</span>
                    <span className="nx-muted">{progress}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="nx-panel dashboard-card">
          <h3>Upcoming</h3>
          {data.events.length === 0 && data.meetings.length === 0 ? <EmptyState title="Nothing scheduled" /> : (
            <ul className="dashboard-list">
              {data.events.map((e) => <li key={e.id} onClick={() => navigate("schedule")}><span>{e.title}</span><span className="nx-muted">{new Date(e.starts_at).toLocaleDateString()}</span></li>)}
              {data.meetings.map((m) => <li key={m.id} onClick={() => navigate("meetings")}><span>{m.title}</span><span className="nx-muted">{new Date(m.starts_at).toLocaleString()}</span></li>)}
            </ul>
          )}
        </div>

        <div className="nx-panel dashboard-card">
          <h3>Mentions &amp; notifications</h3>
          {data.notifs.length === 0 ? <EmptyState title="You're all caught up" /> : (
            <ul className="dashboard-list">
              {data.notifs.map((n) => <li key={n.id} onClick={() => navigate("notifications")}><span>{n.title}</span></li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
