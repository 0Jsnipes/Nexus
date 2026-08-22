import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiPlus } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import { respondToHelpRequest } from "../../lib/taskHelp";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { useWorkspaceMembers } from "../../lib/useWorkspaceMembers";
import { useTasks } from "./useTasks";
import TaskList from "./TaskList";
import TaskBoard from "./TaskBoard";
import TaskModal from "./TaskModal";
import EmptyState from "../shared/EmptyState";

const VIEWS = ["List", "Board"];

const MyTasks = ({ route }) => {
  const [view, setView] = useState("List");
  const [taskModal, setTaskModal] = useState(null);
  const [helpRequests, setHelpRequests] = useState([]);
  const profile = useAuthStore((s) => s.profile);
  const active = useWorkspaceStore(selectActiveMembership);
  const { members } = useWorkspaceMembers(active?.workspace_id);
  const { tasks, loading, createTask, updateTask, deleteTask, setStatus, refetch } = useTasks({
    workspaceId: active?.workspace_id,
    includeOwnedOrCollaborating: true,
    currentUserId: profile?.id,
  });

  const fetchHelpRequests = async () => {
    if (!active?.workspace_id || !profile?.id) return;
    const { data } = await supabase
      .from("task_help_requests")
      .select("*, task:tasks(id, title, project_id), requester:profiles!task_help_requests_requester_id_fkey(username, avatar_url)")
      .eq("workspace_id", active.workspace_id)
      .eq("helper_id", profile.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setHelpRequests(data || []);
  };

  useEffect(() => {
    fetchHelpRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.workspace_id, profile?.id]);

  const respond = async (request, accepted) => {
    try {
      await respondToHelpRequest({ request, accepted, helperName: profile.username });
      toast.success(accepted ? "Task added to My Tasks." : "Help request declined.");
      setHelpRequests((current) => current.filter((item) => item.id !== request.id));
      if (accepted) refetch();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!active) return null;

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <h2>My Tasks</h2>
          <p className="nx-page-subtitle">Everything assigned to you across projects.</p>
        </div>
        <button type="button" className="nx-btn nx-btn-primary" onClick={() => setTaskModal("new")}>
          <FiPlus size={14} /> New task
        </button>
      </div>

      <div className="nx-tabs" style={{ marginBottom: 16 }}>
        {VIEWS.map((v) => (
          <button type="button" key={v} className={`nx-tab ${view === v ? "is-active" : ""}`} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {helpRequests.length > 0 && (
        <section className="nx-panel" style={{ padding: 14, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Help requests</h3>
          {helpRequests.map((request) => (
            <div
              className={`nx-between ${route?.params?.helpRequestId === request.id ? "nx-highlight" : ""}`}
              key={request.id}
              style={{ gap: 12, padding: "8px 0" }}
            >
              <span><strong>{request.requester?.username}</strong> needs help with “{request.task?.title}”</span>
              <span className="nx-row">
                <button type="button" className="nx-btn nx-btn-sm" onClick={() => respond(request, false)}>Decline</button>
                <button type="button" className="nx-btn nx-btn-sm nx-btn-primary" onClick={() => respond(request, true)}>Accept</button>
              </span>
            </div>
          ))}
        </section>
      )}

      {loading && <div className="nx-skeleton" style={{ height: 120 }} />}

      {!loading && tasks.length === 0 && (
        <EmptyState
          title="No tasks assigned"
          description="Tasks assigned to you, created by you, or accepted through a help request will show up here."
          action={<button type="button" className="nx-btn nx-btn-primary" onClick={() => setTaskModal("new")}>New task</button>}
        />
      )}

      {!loading && tasks.length > 0 && view === "List" && <TaskList tasks={tasks} onOpenTask={setTaskModal} />}
      {!loading && tasks.length > 0 && view === "Board" && (
        <TaskBoard tasks={tasks} onOpenTask={setTaskModal} onStatusChange={setStatus} />
      )}

      {taskModal && (
        <TaskModal
          workspaceId={active.workspace_id}
          projectId={null}
          task={taskModal === "new" ? null : taskModal}
          members={members}
          onClose={() => setTaskModal(null)}
          onSave={async (id, payload) => {
            if (id) await updateTask(id, payload);
            else await createTask({ ...payload, assignee_id: payload.assignee_id || profile?.id });
          }}
          onDelete={async (id) => {
            await deleteTask(id);
            setTaskModal(null);
          }}
        />
      )}
    </div>
  );
};

export default MyTasks;
