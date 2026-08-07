const INTEGRATIONS = [
  "Google Calendar",
  "Microsoft Outlook",
  "GitHub",
  "Google Drive",
  "Slack import",
  "Video conferencing (LiveKit / Daily)",
];

const IntegrationsSettings = () => (
  <div>
    <p className="nx-hint" style={{ marginBottom: 12 }}>
      Not connected yet — these are prepared for future implementation.
    </p>
    <div className="team-table">
      {INTEGRATIONS.map((name) => (
        <div key={name} className="team-row">
          <div className="team-row-name">
            <strong>{name}</strong>
            <span className="nx-muted">Not connected</span>
          </div>
          <button type="button" className="nx-btn nx-btn-sm" disabled>
            Connect
          </button>
        </div>
      ))}
    </div>
  </div>
);

export default IntegrationsSettings;
