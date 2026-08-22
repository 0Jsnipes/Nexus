import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { connectGoogleCalendar, disconnectGoogleCalendar, getCalendarConnections } from "../../lib/calendarIntegrations";

const IntegrationsSettings = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const google = connections.find((item) => item.provider === "google");

  const load = async () => {
    try {
      setConnections(await getCalendarConnections());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const disconnect = async () => {
    try {
      await disconnectGoogleCalendar();
      await load();
      toast.success("Google Calendar disconnected.");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const planned = ["Microsoft Outlook & Teams", "Zoom", "GitHub", "Google Drive", "Slack import"];
  return (
    <div>
      <p className="nx-hint" style={{ marginBottom: 12 }}>Connect a calendar to create meeting invitations and video links from Nexus.</p>
      <div className="team-table">
        <div className="team-row">
          <div className="team-row-name">
            <strong>Google Calendar & Meet</strong>
            <span className="nx-muted">{google ? `Connected as ${google.account_email}` : "Create calendar events and instant Google Meet links"}</span>
          </div>
          <button type="button" className={`nx-btn nx-btn-sm ${google ? "nx-btn-danger" : "nx-btn-primary"}`} disabled={loading} onClick={google ? disconnect : connectGoogleCalendar}>
            {google ? "Disconnect" : "Connect Google"}
          </button>
        </div>
        {planned.map((name) => (
          <div key={name} className="team-row">
            <div className="team-row-name"><strong>{name}</strong><span className="nx-muted">Coming next</span></div>
            <button type="button" className="nx-btn nx-btn-sm" disabled>Connect</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrationsSettings;
