import { useState } from "react";
import { TASK_STATUSES, priorityBadgeClass } from "./constants";
import Avatar from "../shared/Avatar";

const isOverdue = (task) => task.due_date && task.status !== "complete" && new Date(task.due_date) < new Date(new Date().toDateString());

const TaskBoard = ({ tasks, onOpenTask, onStatusChange }) => {
  const [dragId, setDragId] = useState(null);

  return (
    <div className="task-board">
      {TASK_STATUSES.map((col) => (
        <div
          key={col.value}
          className="task-board-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragId) onStatusChange(dragId, col.value);
            setDragId(null);
          }}
        >
          <div className="task-board-col-header">
            <span>{col.label}</span>
            <span className="nx-muted">{tasks.filter((t) => t.status === col.value).length}</span>
          </div>
          <div className="task-board-col-body">
            {tasks
              .filter((t) => t.status === col.value)
              .map((task) => (
                <div
                  key={task.id}
                  className={`task-card ${col.value === "blocked" ? "is-blocked" : ""} ${task.priority === "urgent" && col.value !== "blocked" ? "is-urgent" : ""}`}
                  draggable
                  onDragStart={() => setDragId(task.id)}
                  onClick={() => onOpenTask(task)}
                >
                  <p className="task-card-title">{task.title}</p>
                  <div className="task-card-meta">
                    <span className={`nx-badge ${priorityBadgeClass(task.priority)}`}>{task.priority}</span>
                    {task.due_date && (
                      <span className={`nx-badge ${isOverdue(task) ? "nx-badge-danger" : ""}`}>
                        {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {task.assignee && <Avatar src={task.assignee.avatar_url} name={task.assignee.username} size={20} />}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskBoard;
