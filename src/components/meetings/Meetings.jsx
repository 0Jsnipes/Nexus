import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "./meetings.css";
import { supabase } from "../../lib/supabase";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { useWorkspaceMembers } from "../../lib/useWorkspaceMembers";
import { getVideoProvider } from "../../lib/video/provider";
import Modal from "../shared/Modal";
import EmptyState from "../shared/EmptyState";
import Avatar from "../shared/Avatar";
import { FiPlus, FiVideo, FiClock } from "react-icons/fi";

const Meetings = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState(null);

  const active = useWorkspaceStore(selectActiveMembership);
  const can = useWorkspaceStore((s) => s.can);
  const { members } = useWorkspaceMembers(active?.workspace_id);

  const fetchMeetings = async () => {
    if (!active) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("meetings")
      .select("*, host:profiles!meetings_host_id_fkey(username, avatar_url)")
      .eq("workspace_id", active.workspace_id)
      .order("starts_at", { ascending: true });
    if (error) toast.error(error.message);
    else setMeetings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.workspace_id]);

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.starts_at) >= now);
  const past = meetings.filter((m) => new Date(m.starts_at) < now);

  const joinMeeting = async (meeting) => {
    const provider = getVideoProvider(meeting.provider);
    const url = await provider.getJoinUrl(meeting);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast.info("No meeting link configured yet. Add one from Edit meeting.");
  };

  const startInstant = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        workspace_id: active.workspace_id,
        title: "Instant meeting",
        host_id: sessionData.session.user.id,
        created_by: sessionData.session.user.id,
        starts_at: new Date().toISOString(),
        duration_minutes: 30,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    fetchMeetings();
    setDetail(data);
  };

  if (!active) return null;

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <h2>Meetings</h2>
        <div className="nx-row">
          <button type="button" className="nx-btn" onClick={startInstant}>
            <FiVideo size={14} /> Start instant meeting
          </button>
          {can("create_meetings") && (
            <button type="button" className="nx-btn nx-btn-primary" onClick={() => setShowCreate(true)}>
              <FiPlus size={14} /> Schedule meeting
            </button>
          )}
        </div>
      </div>

      {loading && <div className="nx-skeleton" style={{ height: 100 }} />}

      <h3 className="meetings-section-title">Upcoming</h3>
      {upcoming.length === 0 ? <EmptyState title="No upcoming meetings" /> : (
        <div className="meetings-list">
          {upcoming.map((m) => (
            <div key={m.id} className="meeting-card">
              <div>
                <strong>{m.title}</strong>
                <div className="nx-muted meeting-meta"><FiClock size={12} /> {new Date(m.starts_at).toLocaleString()} · {m.duration_minutes}m</div>
              </div>
              <div className="nx-row">
                <Avatar src={m.host?.avatar_url} name={m.host?.username} size={22} />
                <button type="button" className="nx-btn nx-btn-sm" onClick={() => setDetail(m)}>Details</button>
                <button type="button" className="nx-btn nx-btn-sm nx-btn-primary" onClick={() => joinMeeting(m)}>Join</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="meetings-section-title">Past</h3>
      {past.length === 0 ? <EmptyState title="No past meetings" /> : (
        <div className="meetings-list">
          {past.map((m) => (
            <div key={m.id} className="meeting-card">
              <div>
                <strong>{m.title}</strong>
                <div className="nx-muted meeting-meta">{new Date(m.starts_at).toLocaleString()}</div>
              </div>
              <button type="button" className="nx-btn nx-btn-sm" onClick={() => setDetail(m)}>Notes</button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <MeetingModal
          workspaceId={active.workspace_id}
          members={members}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            fetchMeetings();
          }}
        />
      )}

      {detail && (
        <MeetingModal
          workspaceId={active.workspace_id}
          members={members}
          meeting={detail}
          onClose={() => setDetail(null)}
          onSaved={() => {
            setDetail(null);
            fetchMeetings();
          }}
        />
      )}
    </div>
  );
};

const MeetingModal = ({ workspaceId, members, meeting, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const isEdit = !!meeting;
  const defaultDate = meeting ? new Date(meeting.starts_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const defaultTime = meeting ? new Date(meeting.starts_at).toISOString().slice(11, 16) : "10:00";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { title, description, date, time, duration, meeting_url, notes, action_items } = Object.fromEntries(new FormData(e.target));
    if (!title?.trim()) {
      setLoading(false);
      return toast.warn("Meeting title is required.");
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const payload = {
      title: title.trim(),
      description: description?.trim() || null,
      starts_at: new Date(`${date}T${time}`).toISOString(),
      duration_minutes: Number(duration) || 30,
      meeting_url: meeting_url?.trim() || null,
      notes: notes?.trim() || null,
      action_items: action_items?.trim() || null,
    };

    const { error } = isEdit
      ? await supabase.from("meetings").update(payload).eq("id", meeting.id)
      : await supabase.from("meetings").insert({ ...payload, workspace_id: workspaceId, host_id: sessionData.session.user.id, created_by: sessionData.session.user.id });

    if (error) toast.error(error.message);
    else {
      toast.success(isEdit ? "Meeting updated." : "Meeting scheduled.");
      onSaved();
    }
    setLoading(false);
  };

  return (
    <Modal title={isEdit ? meeting.title : "Schedule meeting"} onClose={onClose} width="520px">
      <form onSubmit={handleSubmit}>
        <div className="nx-field">
          <label>Title</label>
          <input className="nx-input" name="title" defaultValue={meeting?.title} required />
        </div>
        <div className="nx-field">
          <label>Description</label>
          <textarea className="nx-textarea" name="description" rows={2} defaultValue={meeting?.description} />
        </div>
        <div className="task-modal-grid">
          <div className="nx-field">
            <label>Date</label>
            <input className="nx-input" type="date" name="date" defaultValue={defaultDate} required />
          </div>
          <div className="nx-field">
            <label>Time</label>
            <input className="nx-input" type="time" name="time" defaultValue={defaultTime} required />
          </div>
          <div className="nx-field">
            <label>Duration (min)</label>
            <input className="nx-input" type="number" name="duration" defaultValue={meeting?.duration_minutes || 30} />
          </div>
        </div>
        <div className="nx-field">
          <label>Meeting link (external)</label>
          <input className="nx-input" name="meeting_url" placeholder="https://meet.google.com/..." defaultValue={meeting?.meeting_url} />
        </div>
        {members?.length > 0 && (
          <p className="nx-hint" style={{ marginBottom: 10 }}>{members.length} workspace members can be invited from Team once attendee tracking UI ships.</p>
        )}
        {isEdit && (
          <>
            <div className="nx-field">
              <label>Notes</label>
              <textarea className="nx-textarea" name="notes" rows={2} defaultValue={meeting?.notes} />
            </div>
            <div className="nx-field">
              <label>Action items</label>
              <textarea className="nx-textarea" name="action_items" rows={2} defaultValue={meeting?.action_items} />
            </div>
          </>
        )}
        <div className="nx-modal-actions">
          <button type="button" className="nx-btn" onClick={onClose}>Close</button>
          <button type="submit" className="nx-btn nx-btn-primary" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
};

export default Meetings;
