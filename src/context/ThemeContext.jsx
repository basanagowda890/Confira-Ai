import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "light", // 'light' | 'dark'
  resolvedTheme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem("confira_theme") || localStorage.getItem("theme");
      return saved === "dark" || saved === "light" ? saved : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("confira_theme", theme);
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  const setTheme = (newTheme) => {
    const validTheme = newTheme === "dark" ? "dark" : "light";
    setThemeState(validTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

