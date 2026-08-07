import { useState } from "react";
import { applyTheme, getStoredTheme } from "../../lib/theme";

const OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const AppearanceSettings = () => {
  const [theme, setTheme] = useState(getStoredTheme());

  const choose = (id) => {
    setTheme(id);
    applyTheme(id);
  };

  return (
    <div>
      <p className="nx-hint" style={{ marginBottom: 12 }}>Choose how Nexus looks on this device.</p>
      <div className="nx-row" style={{ gap: 8 }}>
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`nx-btn ${theme === o.id ? "nx-btn-primary" : ""}`}
            onClick={() => choose(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AppearanceSettings;
