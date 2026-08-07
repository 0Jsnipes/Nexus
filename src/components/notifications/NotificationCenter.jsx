import { useEffect, useState } from "react";
import "./notificationCenter.css";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import EmptyState from "../shared/EmptyState";
import { format } from "../../lib/dateFormat";

const NotificationCenter = ({ navigate }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const profile = useAuthStore((s) => s.profile);
  const active = useWorkspaceStore(selectActiveMembership);

  const fetchNotifications = async () => {
    if (!profile || !active) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .eq("workspace_id", active.workspace_id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, active?.workspace_id]);

  useEffect(() => {
    if (!profile?.id) return undefined;

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        ({ new: row }) => {
          if (row.workspace_id === active?.workspace_id) setItems((prev) => [row, ...prev]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [profile?.id, active?.workspace_id]);

  const markRead = async (item) => {
    if (!item.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)));
    }
    if (item.link) {
      try {
        const { section, params } = JSON.parse(item.link);
        navigate(section, params);
      } catch {
        // ignore malformed link
      }
    }
  };

  const markAllRead = async () => {
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at || new Date().toISOString() })));
  };

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <h2>Notifications</h2>
        <button type="button" className="nx-btn" onClick={markAllRead}>Mark all read</button>
      </div>

      {loading && <div className="nx-skeleton" style={{ height: 80 }} />}
      {!loading && items.length === 0 && <EmptyState title="You're all caught up" description="New mentions and task assignments will show up here." />}

      <div className="notif-list">
        {items.map((item) => (
          <button type="button" key={item.id} className={`notif-item ${item.read_at ? "" : "is-unread"}`} onClick={() => markRead(item)}>
            <div>
              <strong>{item.title}</strong>
              {item.body && <p className="nx-muted">{item.body}</p>}
            </div>
            <span className="nx-muted" style={{ fontSize: 11 }}>{format(new Date(item.created_at))}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default NotificationCenter;
