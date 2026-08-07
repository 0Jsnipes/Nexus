import { TASK_STATUSES, priorityBadgeClass } from "./constants";
import Avatar from "../shared/Avatar";
import EmptyState from "../shared/EmptyState";

const statusLabel = (value) => TASK_STATUSES.find((s) => s.value === value)?.label || value;

const isOverdue = (task) => task.due_date && task.status !== "complete" && new Date(task.due_date) < new Date(new Date().toDateString());

const TaskList = ({ tasks, onOpenTask }) => {
  if (!tasks.length) return <EmptyState title="No tasks" description="Nothing here yet." />;

  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Assignee</th>
          <th>Due</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id} onClick={() => onOpenTask(task)}>
            <td>{task.title}</td>
            <td><span className="nx-badge">{statusLabel(task.status)}</span></td>
            <td><span className={`nx-badge ${priorityBadgeClass(task.priority)}`}>{task.priority}</span></td>
            <td>
              {task.assignee ? (
                <span className="nx-row"><Avatar src={task.assignee.avatar_url} name={task.assignee.username} size={20} /> {task.assignee.username}</span>
              ) : (
                <span className="nx-muted">Unassigned</span>
              )}
            </td>
            <td className={isOverdue(task) ? "task-overdue" : ""}>
              {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default TaskList;
