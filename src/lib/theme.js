const THEME_KEY = "nexus:theme"; // "light" | "dark" | "system"

export const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
  localStorage.setItem(THEME_KEY, theme);
};

export const getStoredTheme = () => localStorage.getItem(THEME_KEY) || "system";
