import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "system", // 'light' | 'dark' | 'system'
  resolvedTheme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem("confira_theme") || "system";
    } catch {
      return "system";
    }
  });

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = e => setSystemDark(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    try {
      localStorage.setItem("confira_theme", theme);
    } catch {}
  }, [theme, resolvedTheme]);

  const setTheme = newTheme => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
