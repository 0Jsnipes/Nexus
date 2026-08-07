const THEME_KEY = "nexus:theme"; // "light" | "dark" | "system"

const resolveSystemTheme = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

export const applyTheme = (theme) => {
  const root = document.documentElement;
  const resolved = theme === "system" ? resolveSystemTheme() : theme;
  root.setAttribute("data-theme", resolved);
  localStorage.setItem(THEME_KEY, theme);
};

export const getStoredTheme = () => localStorage.getItem(THEME_KEY) || "system";

export const watchSystemTheme = () => {
  if (!window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => {
    if (getStoredTheme() === "system") applyTheme("system");
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
};
