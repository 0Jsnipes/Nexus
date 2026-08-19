(() => {
  try {
    let theme = localStorage.getItem("nexus:theme") || "system";
    if (theme === "system") {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    // Theme initialization should never block the application from loading.
  }
})();
