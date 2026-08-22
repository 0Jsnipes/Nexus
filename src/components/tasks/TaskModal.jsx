import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Modal from "../shared/Modal";
import Avatar from "../shared/Avatar";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { TASK_STATUSES, TASK_PRIORITIES } from "./constants";
import { requestTaskHelp } from "../../lib/taskHelp";

const TaskModal = ({ workspaceId, projectId, task, members, onClose, onSave, onDelete }) => {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    assignee_id: task?.assignee_id || "",
    status: task?.status || "backlog",
    priority: task?.priority || "medium",
    start_date: task?.start_date || "",
    due_date: task?.due_date || "",
  });
  const [checklist, setChecklist] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [helperId, setHelperId] = useState("");
  const [requestingHelp, setRequestingHelp] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const canRequestHelp = isEdit && (task.created_by === profile?.id || task.assignee_id === profile?.id);

  useEffect(() => {
    if (!task) return;
    supabase.from("task_checklist_items").select("*").eq("task_id", task.id).order("position").then(({ data }) => setChecklist(data || []));
    supabase
      .from("task_comments")
      .select("*, user:profiles(username, avatar_url)")
      .eq("task_id", task.id)
      .order("created_at")
      .then(({ data }) => setComments(data || []));
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.warn("Task title is required.");

    const payload = {
      ...form,
      assignee_id: form.assignee_id || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    };

    try {
      if (isEdit) {
        await onSave(task.id, payload);
      } else {
        await onSave(null, { ...payload, workspace_id: workspaceId, project_id: projectId || null, created_by: profile?.id });
      }
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addChecklistItem = async () => {
    if (!newItem.trim() || !task) return;
    const { data } = await supabase
      .from("task_checklist_items")
      .insert({ task_id: task.id, title: newItem.trim(), position: checklist.length })
      .select()
      .single();
    setChecklist((prev) => [...prev, data]);
    setNewItem("");
  };

  const toggleChecklistItem = async (item) => {
    await supabase.from("task_checklist_items").update({ done: !item.done }).eq("id", item.id);
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
  };

  const addComment = async () => {
    if (!newComment.trim() || !task) return;
    const { data } = await supabase
      .from("task_comments")
      .insert({ task_id: task.id, user_id: profile.id, body: newComment.trim() })
      .select("*, user:profiles(username, avatar_url)")
      .single();
    setComments((prev) => [...prev, data]);
    setNewComment("");
  };

  const askForHelp = async () => {
    if (!helperId) return;
    setRequestingHelp(true);
    try {
      await requestTaskHelp({ workspaceId, task, requester: profile, helperId });
      toast.success("Help request sent by direct message.");
      setShowHelp(false);
      setHelperId("");
    } catch (error) {
      toast.error(error.code === "23505" ? "That teammate already has a pending request." : error.message);
    } finally {
      setRequestingHelp(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit task" : "New task"} onClose={onClose} width="560px">
      <form onSubmit={handleSubmit}>
        <div className="nx-field">
          <label>Title</label>
          <input className="nx-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="nx-field">
          <label>Description</label>
          <textarea className="nx-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="task-modal-grid">
          <div className="nx-field">
            <label>Status</label>
            <select className="nx-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="nx-field">
            <label>Priority</label>
            <select className="nx-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="nx-field">
            <label>Assignee</label>
            <select className="nx-select" value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
              <option value="">Unassigned</option>
              {members?.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.username}</option>)}
            </select>
          </div>
          <div className="nx-field">
            <label>Start date</label>
            <input type="date" className="nx-input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="nx-field">
            <label>Due date</label>
            <input type="date" className="nx-input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </div>

        {isEdit && (
          <>
            <hr className="nx-divider" />
            <div className="nx-field">
              <label>Checklist</label>
              {checklist.map((item) => (
                <label key={item.id} className="nx-row task-checklist-item">
                  <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item)} />
                  <span className={item.done ? "is-done" : ""}>{item.title}</span>
                </label>
              ))}
              <div className="nx-row">
                <input className="nx-input" placeholder="Add item" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
                <button type="button" className="nx-btn nx-btn-sm" onClick={addChecklistItem}>Add</button>
              </div>
            </div>

            <hr className="nx-divider" />
            <div className="nx-field">
              <label>Comments</label>
              {comments.map((c) => (
                <div key={c.id} className="task-comment">
                  <Avatar src={c.user?.avatar_url} name={c.user?.username} size={20} />
                  <div>
                    <strong>{c.user?.username}</strong>
                    <p>{c.body}</p>
                  </div>
                </div>
              ))}
              <div className="nx-row">
                <input className="nx-input" placeholder="Write a comment" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                <button type="button" className="nx-btn nx-btn-sm" onClick={addComment}>Post</button>
              </div>
            </div>
          </>
        )}

        {canRequestHelp && (
          <>
            <hr className="nx-divider" />
            {!showHelp ? (
              <button type="button" className="nx-btn" onClick={() => setShowHelp(true)}>Ask a teammate for help</button>
            ) : (
              <div className="nx-field">
                <label>Select a teammate</label>
                <div className="nx-row">
                  <select className="nx-select" value={helperId} onChange={(e) => setHelperId(e.target.value)}>
                    <option value="">Choose teammate</option>
                    {members?.filter((member) => member.user_id !== profile?.id && member.status === "active").map((member) => (
                      <option key={member.user_id} value={member.user_id}>{member.profile?.username}</option>
                    ))}
                  </select>
                  <button type="button" className="nx-btn nx-btn-primary" disabled={!helperId || requestingHelp} onClick={askForHelp}>
                    {requestingHelp ? "Sending..." : "Send request"}
                  </button>
                  <button type="button" className="nx-btn" onClick={() => setShowHelp(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="nx-modal-actions">
          {isEdit && (
            <button type="button" className="nx-btn nx-btn-danger" style={{ marginRight: "auto" }} onClick={() => onDelete(task.id)}>
              Delete
            </button>
          )}
          <button type="button" className="nx-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="nx-btn nx-btn-primary">{isEdit ? "Save" : "Create task"}</button>
        </div>
      </form>
    </Modal>
  );
};

export default TaskModal;
