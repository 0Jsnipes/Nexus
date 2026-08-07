import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export const useWorkspaceMembers = (workspaceId) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    supabase
      .from("workspace_members")
      .select("*, profile:profiles(id, username, avatar_url, job_title, status)")
      .eq("workspace_id", workspaceId)
      .then(({ data, error }) => {
        if (!error) setMembers(data || []);
        setLoading(false);
      });
  }, [workspaceId]);

  return { members, loading };
};
