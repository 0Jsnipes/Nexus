import { useEffect, useState } from "react";
import "./dashboard.css";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import EmptyState from "../shared/EmptyState";
import { priorityBadgeClass } from "../tasks/constants";
import { FiPlus, FiHash, FiFolder, FiCalendar, FiVideo, FiUserPlus } from "react-icons/fi";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

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
        supabase.from("projects").select("id, name, status, priority, due_date, tasks(id, status)").eq("workspace_id", workspaceId).in("status", ["active", "planned"]).limit(5),
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
  if (!data) return <div className="nx-page"><div className="nx-skeleton" style={{ height: 220 }} /></div>;

  const quickActions = [
    { label: "Send message", icon: FiHash, action: () => navigate("rooms") },
    { label: "Create room", icon: FiPlus, action: () => navigate("rooms") },
    { label: "Create project", icon: FiFolder, action: () => navigate("projects") },
    { label: "Schedule event", icon: FiCalendar, action: () => navigate("schedule") },
    { label: "Start meeting", icon: FiVideo, action: () => navigate("meetings") },
    { label: "Invite teammate", icon: FiUserPlus, action: () => navigate("team") },
  ];

  const upcoming = [
    ...data.events.map((e) => ({ id: `e-${e.id}`, title: e.title, when: e.starts_at, kind: "Event", go: () => navigate("schedule") })),
    ...data.meetings.map((m) => ({ id: `m-${m.id}`, title: m.title, when: m.starts_at, kind: "Meeting", go: () => navigate("meetings") })),
  ].sort((a, b) => new Date(a.when) - new Date(b.when)).slice(0, 6);

  const stats = [
    { label: "Tasks due", value: data.myTasks.length },
    { label: "Overdue", value: data.overdue.length, danger: data.overdue.length > 0 },
    { label: "Meetings", value: data.meetings.length },
    { label: "Mentions", value: data.notifs.length },
  ];

  return (
    <div className="nx-page dashboard-page">
      <div className="dashboard-header">
        <div>
          <h2>{greeting()}, {profile?.username}</h2>
          <p className="nx-page-subtitle">{active.workspace.name} · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      <div className="dashboard-stats">
        {stats.map((s) => (
          <div className="dashboard-stat" key={s.label}>
            <span className={`dashboard-stat-value ${s.danger ? "is-danger" : ""}`}>{s.value}</span>
            <span className="dashboard-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-col dashboard-col-primary">
          <section className="nx-panel dashboard-card">
            <div className="dashboard-card-head">
              <h3>My work</h3>
              <button type="button" className="nx-btn nx-btn-ghost nx-btn-sm" onClick={() => navigate("tasks")}>View all</button>
            </div>
            {data.myTasks.length === 0 && data.overdue.length === 0 ? <EmptyState title="Nothing assigned to you" /> : (
              <ul className="dashboard-list">
                {data.overdue.map((t) => (
                  <li key={`o-${t.id}`} onClick={() => navigate("tasks")}>
                    <span className="dashboard-row-title task-overdue">{t.title}</span>
                    <span className="nx-badge nx-badge-danger">Overdue</span>
                  </li>
                ))}
                {data.myTasks.map((t) => (
                  <li key={t.id} onClick={() => navigate("tasks")}>
                    <span className="dashboard-row-title">{t.title}</span>
                    <span className="nx-row" style={{ gap: 6 }}>
                      {t.due_date && <span className="nx-faint" style={{ fontSize: 11 }}>{new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                      <span className={`nx-badge ${priorityBadgeClass(t.priority)}`}>{t.priority}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="nx-panel dashboard-card">
            <div className="dashboard-card-head">
              <h3>Projects</h3>
              <button type="button" className="nx-btn nx-btn-ghost nx-btn-sm" onClick={() => navigate("projects")}>View all</button>
            </div>
            {data.projects.length === 0 ? <EmptyState title="No active projects" /> : (
              <ul className="dashboard-list">
                {data.projects.map((p) => {
                  const total = p.tasks?.length || 0;
                  const done = p.tasks?.filter((t) => t.status === "complete").length || 0;
                  const progress = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <li key={p.id} onClick={() => navigate("projects", { projectId: p.id })} className="dashboard-project-row">
                      <span className="dashboard-row-title">{p.name}</span>
                      <div className="nx-progress dashboard-project-bar"><div className="nx-progress-fill" style={{ width: `${progress}%` }} /></div>
                      <span className="nx-faint" style={{ fontSize: 12, width: 34, textAlign: "right" }}>{progress}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="dashboard-col dashboard-col-secondary">
          <section className="nx-panel dashboard-card">
            <div className="dashboard-card-head">
              <h3>Up next</h3>
            </div>
            {upcoming.length === 0 ? <EmptyState title="Nothing scheduled" /> : (
              <ul className="dashboard-list">
                {upcoming.map((u) => (
                  <li key={u.id} onClick={u.go}>
                    <span className="dashboard-row-title">{u.title}</span>
                    <span className="nx-faint" style={{ fontSize: 11 }}>{new Date(u.when).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="nx-panel dashboard-card">
            <div className="dashboard-card-head">
              <h3>Recent activity</h3>
            </div>
            {data.notifs.length === 0 ? <EmptyState title="You're all caught up" /> : (
              <ul className="dashboard-list">
                {data.notifs.map((n) => (
                  <li key={n.id} onClick={() => navigate("notifications")}>
                    <span className="dashboard-row-title">{n.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="nx-panel dashboard-card">
            <div className="dashboard-card-head">
              <h3>Quick actions</h3>
            </div>
            <div className="dashboard-quick-actions">
              {quickActions.map((qa) => (
                <button type="button" key={qa.label} className="nx-btn nx-btn-sm" onClick={qa.action}>
                  <qa.icon size={13} /> {qa.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
