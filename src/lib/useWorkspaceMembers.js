import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export const useWorkspaceMembers = (workspaceId) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from("workspace_members")
      .select("*, profile:profiles!workspace_members_user_id_fkey(id, username, avatar_url, job_title, status)")
      .eq("workspace_id", workspaceId)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;

        if (queryError) {
          console.error("Failed to load workspace members", queryError);
          setMembers([]);
          setError(queryError);
        } else {
          setMembers(data || []);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { members, loading, error };
};
