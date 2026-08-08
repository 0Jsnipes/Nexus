import { useEffect, useState } from "react";
import { FiArrowLeft, FiPlus, FiEye, FiCheckSquare, FiColumns, FiFlag, FiFolder, FiActivity } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import { useWorkspaceMembers } from "../../lib/useWorkspaceMembers";
import { useTasks } from "../tasks/useTasks";
import TaskBoard from "../tasks/TaskBoard";
import TaskList from "../tasks/TaskList";
import TaskModal from "../tasks/TaskModal";
import EmptyState from "../shared/EmptyState";
import { resolveStorageUrl } from "../../lib/storage";

const TABS = ["Overview", "Tasks", "Board", "Milestones", "Files", "Activity"];
const TAB_ICONS = {
  Overview: FiEye,
  Tasks: FiCheckSquare,
  Board: FiColumns,
  Milestones: FiFlag,
  Files: FiFolder,
  Activity: FiActivity,
};

const ProjectDetail = ({ workspaceId, projectId, project, onBack, onProjectChanged }) => {
  const [tab, setTab] = useState("Overview");
  const { members } = useWorkspaceMembers(workspaceId);
  const { tasks, createTask, updateTask, deleteTask, setStatus } = useTasks({ workspaceId, projectId });
  const [taskModal, setTaskModal] = useState(null); // "new" | task object
  const [milestones, setMilestones] = useState([]);
  const [files, setFiles] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (tab === "Milestones") {
      supabase.from("milestones").select("*").eq("project_id", projectId).order("due_date").then(({ data }) => setMilestones(data || []));
    }
    if (tab === "Files") {
      supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .then(async ({ data }) => {
          const resolved = await Promise.all(
            (data || []).map(async (file) => ({ ...file, url: await resolveStorageUrl(file.url) }))
          );
          setFiles(resolved);
        });
    }
    if (tab === "Activity") {
      supabase
        .from("activity_events")
        .select("*, actor:profiles(username)")
        .eq("workspace_id", workspaceId)
        .eq("target_id", projectId)
        .order("created_at", { ascending: false })
        .limit(30)
        .then(({ data }) => setActivity(data || []));
    }
  }, [tab, projectId, workspaceId]);

  if (!project) return <EmptyState title="Project not found" action={<button className="nx-btn" onClick={onBack}>Back to projects</button>} />;

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "complete").length;
  const progress = total ? Math.round((done / total) * 100) : 0;

  const addMilestone = async (e) => {
    e.preventDefault();
    const { name, due_date } = Object.fromEntries(new FormData(e.target));
    if (!name?.trim()) return;
    const { data } = await supabase.from("milestones").insert({ project_id: projectId, name: name.trim(), due_date: due_date || null }).select().single();
    setMilestones((prev) => [...prev, data]);
    e.target.reset();
  };

  const toggleMilestone = async (m) => {
    const completed_at = m.completed_at ? null : new Date().toISOString();
    await supabase.from("milestones").update({ completed_at }).eq("id", m.id);
    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, completed_at } : x)));
  };

  return (
    <div className="nx-page">
      <button type="button" className="nx-btn nx-btn-ghost nx-btn-sm" onClick={onBack} style={{ marginBottom: 10 }}>
        <FiArrowLeft size={13} /> Back to projects
      </button>

      <div className="nx-page-header">
        <div>
          <h2>{project.name}</h2>
          {project.description && <p className="nx-muted" style={{ fontSize: 13, marginTop: 4 }}>{project.description}</p>}
        </div>
        <button type="button" className="nx-btn nx-btn-primary" onClick={() => setTaskModal("new")}>
          <FiPlus size={14} /> Add task
        </button>
      </div>

      <div className="project-tabs">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t];
          return (
            <button
              type="button"
              key={t}
              className={`project-tab ${tab === t ? "is-active" : ""}`}
              onClick={() => setTab(t)}
              title={t}
              aria-label={t}
            >
              <Icon size={14} className="project-tab-icon" />
              <span className="project-tab-label">{t}</span>
            </button>
          );
        })}
      </div>

      {tab === "Overview" && (
        <div className="project-overview">
          <div className="nx-card">
            <span className="nx-muted" style={{ fontSize: 12 }}>Progress</span>
            <div className="project-progress"><div className="project-progress-bar"><div style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
          </div>
          <div className="nx-card"><span className="nx-muted" style={{ fontSize: 12 }}>Tasks</span><p style={{ fontSize: 20, fontWeight: 700 }}>{total}</p></div>
          <div className="nx-card"><span className="nx-muted" style={{ fontSize: 12 }}>Milestones</span><p style={{ fontSize: 20, fontWeight: 700 }}>{milestones.filter((m) => m.completed_at).length}/{milestones.length}</p></div>
          <div className="nx-card"><span className="nx-muted" style={{ fontSize: 12 }}>Status</span><p style={{ fontSize: 20, fontWeight: 700, textTransform: "capitalize" }}>{project.status.replace("_", " ")}</p></div>
        </div>
      )}

      {tab === "Tasks" && <TaskList tasks={tasks} onOpenTask={setTaskModal} />}
      {tab === "Board" && <TaskBoard tasks={tasks} onOpenTask={setTaskModal} onStatusChange={setStatus} />}

      {tab === "Milestones" && (
        <div>
          <form onSubmit={addMilestone} className="nx-row" style={{ marginBottom: 12 }}>
            <input className="nx-input" name="name" placeholder="Milestone name" required />
            <input className="nx-input" type="date" name="due_date" style={{ maxWidth: 160 }} />
            <button type="submit" className="nx-btn">Add</button>
          </form>
          {milestones.length === 0 && <EmptyState title="No milestones" />}
          {milestones.map((m) => (
            <label key={m.id} className="nx-row" style={{ padding: "6px 0" }}>
              <input type="checkbox" checked={!!m.completed_at} onChange={() => toggleMilestone(m)} />
              <span style={m.completed_at ? { textDecoration: "line-through", color: "var(--nx-text-faint)" } : undefined}>{m.name}</span>
              {m.due_date && <span className="nx-muted" style={{ fontSize: 12, marginLeft: "auto" }}>{new Date(m.due_date).toLocaleDateString()}</span>}
            </label>
          ))}
        </div>
      )}

      {tab === "Files" && (
        files.length === 0 ? <EmptyState title="No files" description="Files shared in this project's messages will appear here." /> : (
          <div className="project-grid">
            {files.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="nx-card">{f.name}</a>
            ))}
          </div>
        )
      )}

      {tab === "Activity" && (
        activity.length === 0 ? <EmptyState title="No activity yet" /> : (
          <ul>
            {activity.map((a) => (
              <li key={a.id} className="nx-muted" style={{ fontSize: 13, padding: "4px 0" }}>
                <strong>{a.actor?.username}</strong> {a.type} — {new Date(a.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )
      )}

      {taskModal && (
        <TaskModal
          workspaceId={workspaceId}
          projectId={projectId}
          task={taskModal === "new" ? null : taskModal}
          members={members}
          onClose={() => setTaskModal(null)}
          onSave={async (id, payload) => {
            if (id) await updateTask(id, payload);
            else await createTask(payload);
            onProjectChanged?.();
          }}
          onDelete={async (id) => {
            await deleteTask(id);
            setTaskModal(null);
            onProjectChanged?.();
          }}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
