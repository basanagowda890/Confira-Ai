import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ variant = "topbar" }) {
  const { theme, setTheme } = useTheme();

  if (variant === "cards") {
    return (
      <div className="theme-options-grid">
        <button
          type="button"
          className={`theme-card-option ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
        >
          <div className="theme-icon light">
            <Sun size={20} />
          </div>
          <div>
            <b>Light Glass Theme</b>
            <p>Clean sky-blue & gold translucent surfaces</p>
          </div>
          {theme === "light" && <span className="theme-active-dot" />}
        </button>

        <button
          type="button"
          className={`theme-card-option ${theme === "dark" ? "active" : ""}`}
          onClick={() => setTheme("dark")}
        >
          <div className="theme-icon dark">
            <Moon size={20} />
          </div>
          <div>
            <b>Dark Theme</b>
            <p>Obsidian night mode for low-glare focus</p>
          </div>
          {theme === "dark" && <span className="theme-active-dot" />}
        </button>
      </div>
    );
  }

  // Topbar segmented button
  return (
    <div className="theme-topbar-switcher" role="group" aria-label="Theme mode selector">
      <button
        type="button"
        className={`theme-btn ${theme === "light" ? "active" : ""}`}
        onClick={() => setTheme("light")}
        title="Switch to Light Theme"
        aria-label="Light mode"
      >
        <Sun size={15} />
      </button>
      <button
        type="button"
        className={`theme-btn ${theme === "dark" ? "active" : ""}`}
        onClick={() => setTheme("dark")}
        title="Switch to Dark Theme"
        aria-label="Dark mode"
      >
        <Moon size={15} />
      </button>
    </div>
  );
}

