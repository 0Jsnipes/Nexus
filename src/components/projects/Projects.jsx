import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "./projects.css";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import EmptyState from "../shared/EmptyState";
import Modal from "../shared/Modal";
import ProjectDetail from "./ProjectDetail";
import { FiPlus } from "react-icons/fi";

const STATUS_OPTIONS = ["planned", "active", "on_hold", "completed", "archived"];

const Projects = ({ route, navigate }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due_date");
  const [showCreate, setShowCreate] = useState(false);

  const active = useWorkspaceStore(selectActiveMembership);
  const can = useWorkspaceStore((s) => s.can);
  const profile = useAuthStore((s) => s.profile);
  const projectId = route.params?.projectId;

  const fetchProjects = async () => {
    if (!active) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*, owner:profiles!projects_owner_id_fkey(username, avatar_url), tasks(id, status)")
      .eq("workspace_id", active.workspace_id);
    if (error) toast.error(error.message);
    else setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.workspace_id]);

  const visible = useMemo(() => {
    let list = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    list = [...list].sort((a, b) => {
      if (sortBy === "due_date") return (a.due_date || "9999") > (b.due_date || "9999") ? 1 : -1;
      if (sortBy === "priority") return a.priority.localeCompare(b.priority);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [projects, search, statusFilter, sortBy]);

  if (!active) return null;

  if (projectId) {
    const project = projects.find((p) => p.id === projectId);
    return (
      <ProjectDetail
        workspaceId={active.workspace_id}
        projectId={projectId}
        project={project}
        onBack={() => navigate("projects")}
        onProjectChanged={fetchProjects}
      />
    );
  }

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <h2>Projects</h2>
        {can("create_projects") && (
          <button type="button" className="nx-btn nx-btn-primary" onClick={() => setShowCreate(true)}>
            <FiPlus size={14} /> New project
          </button>
        )}
      </div>

      <div className="nx-row" style={{ marginBottom: 14, gap: 8 }}>
        <input className="nx-input" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <select className="nx-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select className="nx-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="due_date">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {loading && <div className="nx-skeleton" style={{ height: 120 }} />}

      {!loading && visible.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Create a project to start organizing work."
          action={can("create_projects") && (
            <button type="button" className="nx-btn nx-btn-primary" onClick={() => setShowCreate(true)}>New project</button>
          )}
        />
      )}

      <div className="project-grid">
        {visible.map((p) => {
          const total = p.tasks?.length || 0;
          const done = p.tasks?.filter((t) => t.status === "complete").length || 0;
          const progress = total ? Math.round((done / total) * 100) : 0;
          return (
            <button type="button" key={p.id} className="project-card" onClick={() => navigate("projects", { projectId: p.id })}>
              <div className="nx-between">
                <h3>{p.name}</h3>
                <span className="nx-badge">{p.status.replace("_", " ")}</span>
              </div>
              {p.description && <p className="nx-muted project-card-desc">{p.description}</p>}
              <div className="project-progress">
                <div className="project-progress-bar"><div style={{ width: `${progress}%` }} /></div>
                <span>{progress}%</span>
              </div>
              <div className="nx-between" style={{ marginTop: 8 }}>
                <span className="nx-muted" style={{ fontSize: 12 }}>{p.due_date ? `Due ${new Date(p.due_date).toLocaleDateString()}` : "No due date"}</span>
                <span className={`nx-badge ${p.priority === "urgent" || p.priority === "high" ? "nx-badge-warning" : ""}`}>{p.priority}</span>
              </div>
            </button>
          );
        })}
      </div>

      {showCreate && (
        <CreateProjectModal
          workspaceId={active.workspace_id}
          ownerId={profile?.id}
          onClose={() => setShowCreate(false)}
          onCreated={(project) => {
            setShowCreate(false);
            fetchProjects();
            navigate("projects", { projectId: project.id });
          }}
        />
      )}
    </div>
  );
};

const CreateProjectModal = ({ workspaceId, ownerId, onClose, onCreated }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { name, description, priority, due_date } = Object.fromEntries(new FormData(e.target));
    if (!name?.trim()) {
      setLoading(false);
      return toast.warn("Project name is required.");
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        priority: priority || "medium",
        due_date: due_date || null,
        owner_id: ownerId,
        created_by: ownerId,
      })
      .select()
      .single();

    if (error) toast.error(error.message);
    else onCreated(data);
    setLoading(false);
  };

  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="nx-field">
          <label>Name</label>
          <input className="nx-input" name="name" required />
        </div>
        <div className="nx-field">
          <label>Description</label>
          <textarea className="nx-textarea" name="description" rows={2} />
        </div>
        <div className="task-modal-grid">
          <div className="nx-field">
            <label>Priority</label>
            <select className="nx-select" name="priority" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="nx-field">
            <label>Due date</label>
            <input className="nx-input" type="date" name="due_date" />
          </div>
        </div>
        <div className="nx-modal-actions">
          <button type="button" className="nx-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="nx-btn nx-btn-primary" disabled={loading}>{loading ? "Creating..." : "Create"}</button>
        </div>
      </form>
    </Modal>
  );
};

export default Projects;
