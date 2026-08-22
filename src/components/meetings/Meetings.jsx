import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "./meetings.css";
import { supabase } from "../../lib/supabase";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { useAuthStore } from "../../lib/authStore";
import { notifyMeetingScheduled } from "../../lib/notify";
import { createGoogleMeeting, getCalendarConnections } from "../../lib/calendarIntegrations";
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
  const [googleConnected, setGoogleConnected] = useState(false);

  const active = useWorkspaceStore(selectActiveMembership);
  const profile = useAuthStore((s) => s.profile);
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
    getCalendarConnections().then((items) => setGoogleConnected(items.some((item) => item.provider === "google" && item.status === "active"))).catch(() => setGoogleConnected(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.workspace_id]);

  const now = new Date();
  const isLive = (m) => {
    const start = new Date(m.starts_at);
    const end = new Date(start.getTime() + (m.duration_minutes || 30) * 60000);
    return now >= start && now <= end;
  };
  const upcoming = meetings.filter((m) => new Date(m.starts_at) >= now || isLive(m));
  const past = meetings.filter((m) => new Date(m.starts_at) < now && !isLive(m));

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
    if (googleConnected) {
      try {
        const google = await createGoogleMeeting({ meeting: data });
        await supabase.from("meetings").update({ provider: "google", meeting_url: google.joinUrl, external_event_id: google.eventId, external_calendar_url: google.calendarUrl }).eq("id", data.id);
        data.provider = "google";
        data.meeting_url = google.joinUrl;
      } catch (googleError) {
        toast.error(googleError.message);
      }
    }
    notifyMeetingScheduled({ workspaceId: active.workspace_id, meeting: data, actorId: profile?.id, actorName: profile?.username });
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
            <div key={m.id} className={`meeting-card ${isLive(m) ? "is-live" : ""}`}>
              <div>
                <div className="nx-row" style={{ gap: 6 }}>
                  {isLive(m) && <span className="nx-status-dot nx-status-dot-danger nx-status-dot-live" />}
                  <strong>{m.title}</strong>
                  {isLive(m) && <span className="nx-badge nx-badge-danger">Live</span>}
                </div>
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
          googleConnected={googleConnected}
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
          googleConnected={googleConnected}
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

const MeetingModal = ({ workspaceId, members, meeting, googleConnected, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const isEdit = !!meeting;
  const defaultDate = meeting ? new Date(meeting.starts_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const defaultTime = meeting ? new Date(meeting.starts_at).toISOString().slice(11, 16) : "10:00";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { title, description, date, time, duration, provider, meeting_url, attendee_emails, notes, action_items } = Object.fromEntries(new FormData(e.target));
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
      provider: provider || "external",
    };

    const { data: savedMeeting, error } = isEdit
      ? await supabase.from("meetings").update(payload).eq("id", meeting.id)
      : await supabase.from("meetings").insert({ ...payload, workspace_id: workspaceId, host_id: sessionData.session.user.id, created_by: sessionData.session.user.id }).select().single();

    if (error) toast.error(error.message);
    else {
      if (!isEdit && savedMeeting && provider === "google") {
        try {
          const attendeeEmails = String(attendee_emails || "").split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean);
          const google = await createGoogleMeeting({ meeting: savedMeeting, attendeeEmails });
          await supabase.from("meetings").update({ meeting_url: google.joinUrl, external_event_id: google.eventId, external_calendar_url: google.calendarUrl }).eq("id", savedMeeting.id);
          savedMeeting.meeting_url = google.joinUrl;
        } catch (googleError) {
          toast.error(`Meeting saved, but Google sync failed: ${googleError.message}`);
        }
      }
      if (!isEdit && savedMeeting) {
        const actorName = sessionData.session.user.user_metadata?.username || sessionData.session.user.email;
        notifyMeetingScheduled({ workspaceId, meeting: savedMeeting, actorId: sessionData.session.user.id, actorName });
      }
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
          <label>Meeting provider</label>
          <select className="nx-select" name="provider" defaultValue={meeting?.provider || (googleConnected ? "google" : "external")}>
            {googleConnected && <option value="google">Google Calendar + Meet</option>}
            <option value="external">External link (Teams, Zoom, or other)</option>
          </select>
        </div>
        <div className="nx-field">
          <label>External meeting link</label>
          <input className="nx-input" name="meeting_url" placeholder="https://teams.microsoft.com/..." defaultValue={meeting?.meeting_url} />
        </div>
        {googleConnected && !isEdit && (
          <div className="nx-field">
            <label>Guest emails (optional)</label>
            <textarea className="nx-textarea" name="attendee_emails" rows={2} placeholder="person@example.com, teammate@example.com" />
          </div>
        )}
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
