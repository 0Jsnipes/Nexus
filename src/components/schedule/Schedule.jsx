import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "./schedule.css";
import { supabase } from "../../lib/supabase";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import Modal from "../shared/Modal";
import EmptyState from "../shared/EmptyState";
import { FiChevronLeft, FiChevronRight, FiPlus } from "react-icons/fi";

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfGrid = (d) => {
  const start = startOfMonth(d);
  const day = start.getDay();
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() - day);
};

const Schedule = () => {
  const [view, setView] = useState("month"); // "month" | "agenda"
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [tasksDue, setTasksDue] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [modalDate, setModalDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const active = useWorkspaceStore(selectActiveMembership);
  const can = useWorkspaceStore((s) => s.can);

  const rangeStart = useMemo(() => startOfGrid(cursor), [cursor]);
  const rangeEnd = useMemo(() => new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + 42), [rangeStart]);

  const fetchAll = async () => {
    if (!active) return;
    const [eventsRes, tasksRes, meetingsRes] = await Promise.all([
      supabase
        .from("calendar_events")
        .select("*")
        .eq("workspace_id", active.workspace_id)
        .gte("starts_at", rangeStart.toISOString())
        .lte("starts_at", rangeEnd.toISOString()),
      supabase
        .from("tasks")
        .select("id, title, due_date")
        .eq("workspace_id", active.workspace_id)
        .not("due_date", "is", null)
        .gte("due_date", rangeStart.toISOString().slice(0, 10))
        .lte("due_date", rangeEnd.toISOString().slice(0, 10)),
      supabase
        .from("meetings")
        .select("id, title, starts_at")
        .eq("workspace_id", active.workspace_id)
        .gte("starts_at", rangeStart.toISOString())
        .lte("starts_at", rangeEnd.toISOString()),
    ]);
    if (eventsRes.error) toast.error(eventsRes.error.message);
    setEvents(eventsRes.data || []);
    setTasksDue(tasksRes.data || []);
    setMeetings(meetingsRes.data || []);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.workspace_id, rangeStart.getTime()]);

  const itemsForDay = (day) => {
    const key = day.toDateString();
    return [
      ...events.filter((e) => new Date(e.starts_at).toDateString() === key).map((e) => ({ kind: "event", id: e.id, title: e.title, data: e })),
      ...tasksDue.filter((t) => new Date(t.due_date).toDateString() === key).map((t) => ({ kind: "task", id: t.id, title: `Due: ${t.title}` })),
      ...meetings.filter((m) => new Date(m.starts_at).toDateString() === key).map((m) => ({ kind: "meeting", id: m.id, title: `Meeting: ${m.title}` })),
    ];
  };

  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + i)), [rangeStart]);

  const agendaItems = useMemo(() => {
    const all = [
      ...events.map((e) => ({ kind: "event", date: new Date(e.starts_at), title: e.title, data: e })),
      ...tasksDue.map((t) => ({ kind: "task", date: new Date(t.due_date), title: `Due: ${t.title}` })),
      ...meetings.map((m) => ({ kind: "meeting", date: new Date(m.starts_at), title: `Meeting: ${m.title}` })),
    ];
    return all.filter((i) => i.date >= new Date(new Date().toDateString())).sort((a, b) => a.date - b.date).slice(0, 30);
  }, [events, tasksDue, meetings]);

  if (!active) return null;

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <h2>Schedule</h2>
        {can("create_calendar_events") && (
          <button type="button" className="nx-btn nx-btn-primary" onClick={() => setModalDate(new Date())}>
            <FiPlus size={14} /> New event
          </button>
        )}
      </div>

      <div className="nx-row" style={{ marginBottom: 12, gap: 8 }}>
        <div className="nx-row">
          <button type="button" className="nx-btn nx-btn-icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><FiChevronLeft /></button>
          <span style={{ fontWeight: 700, fontSize: 13, minWidth: 130, textAlign: "center" }}>
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <button type="button" className="nx-btn nx-btn-icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><FiChevronRight /></button>
        </div>
        <div className="onboarding-tabs" style={{ marginBottom: 0, width: 200 }}>
          <button type="button" className={`onboarding-tab ${view === "month" ? "is-active" : ""}`} onClick={() => setView("month")}>Month</button>
          <button type="button" className={`onboarding-tab ${view === "agenda" ? "is-active" : ""}`} onClick={() => setView("agenda")}>Agenda</button>
        </div>
      </div>

      {view === "month" ? (
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="calendar-weekday">{d}</div>
          ))}
          {days.map((day) => {
            const items = itemsForDay(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <button
                type="button"
                key={day.toISOString()}
                className={`calendar-day ${inMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""}`}
                onClick={() => setModalDate(day)}
              >
                <span className="calendar-day-num">{day.getDate()}</span>
                {items.slice(0, 3).map((item) => (
                  <span key={`${item.kind}-${item.id}`} className={`calendar-chip calendar-chip-${item.kind}`}>{item.title}</span>
                ))}
                {items.length > 3 && <span className="nx-muted" style={{ fontSize: 10 }}>+{items.length - 3} more</span>}
              </button>
            );
          })}
        </div>
      ) : agendaItems.length === 0 ? (
        <EmptyState title="Nothing scheduled" description="Upcoming events, meetings, and task due dates will appear here." />
      ) : (
        <div className="agenda-list">
          {agendaItems.map((item, i) => (
            <div
              key={i}
              className="agenda-item"
              onClick={() => item.kind === "event" && setEditingEvent(item.data)}
              style={{ cursor: item.kind === "event" ? "pointer" : "default" }}
            >
              <span className="nx-muted" style={{ width: 90, fontSize: 12 }}>{item.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span className={`calendar-chip calendar-chip-${item.kind}`}>{item.title}</span>
            </div>
          ))}
        </div>
      )}

      {(modalDate || editingEvent) && (
        <EventModal
          workspaceId={active.workspace_id}
          date={modalDate}
          event={editingEvent}
          onClose={() => {
            setModalDate(null);
            setEditingEvent(null);
          }}
          onSaved={() => {
            setModalDate(null);
            setEditingEvent(null);
            fetchAll();
          }}
        />
      )}
    </div>
  );
};

const EventModal = ({ workspaceId, date, event, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const defaultDate = (event ? new Date(event.starts_at) : date).toISOString().slice(0, 10);
  const defaultTime = event ? new Date(event.starts_at).toISOString().slice(11, 16) : "09:00";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { title, description, date: d, time, all_day, location, video_url, category } = Object.fromEntries(new FormData(e.target));
    if (!title?.trim()) {
      setLoading(false);
      return toast.warn("Event title is required.");
    }

    const starts_at = new Date(`${d}T${all_day ? "00:00" : time || "00:00"}`).toISOString();
    const { data: sessionData } = await supabase.auth.getSession();

    const payload = {
      workspace_id: workspaceId,
      title: title.trim(),
      description: description?.trim() || null,
      starts_at,
      all_day: all_day === "on",
      location: location?.trim() || null,
      video_url: video_url?.trim() || null,
      category: category?.trim() || null,
      created_by: sessionData.session.user.id,
    };

    const { error } = event
      ? await supabase.from("calendar_events").update(payload).eq("id", event.id)
      : await supabase.from("calendar_events").insert(payload);

    if (error) toast.error(error.message);
    else {
      toast.success(event ? "Event updated." : "Event created.");
      onSaved();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!event) return;
    await supabase.from("calendar_events").delete().eq("id", event.id);
    onSaved();
  };

  return (
    <Modal title={event ? "Edit event" : "New event"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="nx-field">
          <label>Title</label>
          <input className="nx-input" name="title" defaultValue={event?.title} required />
        </div>
        <div className="task-modal-grid">
          <div className="nx-field">
            <label>Date</label>
            <input className="nx-input" type="date" name="date" defaultValue={defaultDate} required />
          </div>
          <div className="nx-field">
            <label>Time</label>
            <input className="nx-input" type="time" name="time" defaultValue={defaultTime} />
          </div>
        </div>
        <label className="nx-row" style={{ fontSize: 13, marginBottom: 10 }}>
          <input type="checkbox" name="all_day" defaultChecked={event?.all_day} /> All day
        </label>
        <div className="nx-field">
          <label>Description</label>
          <textarea className="nx-textarea" name="description" rows={2} defaultValue={event?.description} />
        </div>
        <div className="task-modal-grid">
          <div className="nx-field">
            <label>Location</label>
            <input className="nx-input" name="location" defaultValue={event?.location} />
          </div>
          <div className="nx-field">
            <label>Video link</label>
            <input className="nx-input" name="video_url" defaultValue={event?.video_url} />
          </div>
        </div>
        <div className="nx-field">
          <label>Category</label>
          <input className="nx-input" name="category" defaultValue={event?.category} placeholder="e.g. Company event" />
        </div>
        <div className="nx-modal-actions">
          {event && <button type="button" className="nx-btn nx-btn-danger" style={{ marginRight: "auto" }} onClick={handleDelete}>Delete</button>}
          <button type="button" className="nx-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="nx-btn nx-btn-primary" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
};

export default Schedule;
