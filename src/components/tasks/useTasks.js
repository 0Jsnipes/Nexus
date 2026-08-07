import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { notifyTaskAssigned } from "../../lib/notify";

const TASK_SELECT = "*, assignee:profiles!tasks_assignee_id_fkey(id, username, avatar_url), project:projects(id, name)";

export const useTasks = ({ workspaceId, projectId, assigneeId, mineOnly, currentUserId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const profile = useAuthStore((s) => s.profile);

  const fetchTasks = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    let query = supabase.from("tasks").select(TASK_SELECT).eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    if (assigneeId) query = query.eq("assignee_id", assigneeId);
    if (mineOnly && currentUserId) query = query.eq("assignee_id", currentUserId);

    const { data, error } = await query;
    if (!error) setTasks(data || []);
    setLoading(false);
  }, [workspaceId, projectId, assigneeId, mineOnly, currentUserId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!workspaceId) return undefined;
    const channel = supabase
      .channel(`tasks:${workspaceId}:${projectId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` }, () => {
        fetchTasks();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [workspaceId, projectId, fetchTasks]);

  const createTask = useCallback(
    async (payload) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ workspace_id: workspaceId, project_id: projectId || null, ...payload })
        .select(TASK_SELECT)
        .single();
      if (error) throw error;
      if (data.assignee_id) {
        notifyTaskAssigned({ workspaceId, task: data, assigneeId: data.assignee_id, actorName: profile?.username });
      }
      fetchTasks();
      return data;
    },
    [workspaceId, projectId, fetchTasks, profile]
  );

  const updateTask = useCallback(
    async (taskId, patch) => {
      const previous = tasks.find((t) => t.id === taskId);
      const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
      if (error) throw error;
      if (patch.assignee_id && patch.assignee_id !== previous?.assignee_id) {
        notifyTaskAssigned({ workspaceId, task: { ...previous, ...patch }, assigneeId: patch.assignee_id, actorName: profile?.username });
      }
      fetchTasks();
    },
    [fetchTasks, tasks, workspaceId, profile]
  );

  const deleteTask = useCallback(
    async (taskId) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      fetchTasks();
    },
    [fetchTasks]
  );

  const setStatus = useCallback(
    async (taskId, status) => {
      const patch = { status };
      if (status === "complete") patch.completed_at = new Date().toISOString();
      await updateTask(taskId, patch);
    },
    [updateTask]
  );

  return { tasks, loading, createTask, updateTask, deleteTask, setStatus, refetch: fetchTasks };
};
