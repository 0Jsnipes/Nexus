import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { useWorkspaceMembers } from "../../lib/useWorkspaceMembers";
import { useTasks } from "./useTasks";
import TaskList from "./TaskList";
import TaskBoard from "./TaskBoard";
import TaskModal from "./TaskModal";
import EmptyState from "../shared/EmptyState";

const VIEWS = ["List", "Board"];

const MyTasks = () => {
  const [view, setView] = useState("List");
  const [taskModal, setTaskModal] = useState(null);
  const profile = useAuthStore((s) => s.profile);
  const active = useWorkspaceStore(selectActiveMembership);
  const { members } = useWorkspaceMembers(active?.workspace_id);
  const { tasks, loading, createTask, updateTask, deleteTask, setStatus } = useTasks({
    workspaceId: active?.workspace_id,
    mineOnly: true,
    currentUserId: profile?.id,
  });

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

      {loading && <div className="nx-skeleton" style={{ height: 120 }} />}

      {!loading && tasks.length === 0 && (
        <EmptyState
          title="No tasks assigned"
          description="Tasks assigned to you across every project will show up here."
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
