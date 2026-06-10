// ThemeContext — manages dark/light mode across the app

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

/* ---------------- HELPERS ---------------- */

const THEME_KEY = "skill-theme";

const getSystemTheme = () =>
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const getSavedTheme = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return null;
};

/* Get initial theme from DOM or localStorage */
const getInitialTheme = () => {
  // Check DOM first (set by index.html script)
  const domTheme = document.documentElement.getAttribute("data-theme");
  if (domTheme === "dark") return true;
  if (domTheme === "light") return false;

  // Fall back to localStorage
  const saved = getSavedTheme();
  if (saved !== null) return saved;

  // Fall back to system preference
  return getSystemTheme();
};

/* ---------------- PROVIDER ---------------- */

export function ThemeProvider({ children }) {
  // true = dark, false = light
  // Initialize from DOM (index.html sets this before React loads)
  const [isDark, setIsDark] = useState(() => getInitialTheme());

  // apply theme to DOM (DaisyUI uses this)
  useEffect(() => {
    const themeName = isDark ? "skilldark" : "skilllight";
    document.documentElement.setAttribute("data-theme", themeName);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  /* Optional: auto-update if system theme changes (only if user never manually set) */
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e) => {
      const saved = localStorage.getItem(THEME_KEY);
      if (!saved) setIsDark(e.matches);
    };

    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  /* ---------------- ACTIONS ---------------- */

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const setTheme = (mode) => {
    if (mode === "dark") setIsDark(true);
    else if (mode === "light") setIsDark(false);
  };

  /* ---------------- CONTEXT VALUE ---------------- */

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        toggleTheme,
        setTheme,
        theme: isDark ? "dark" : "light",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/* ---------------- HOOK ---------------- */

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
};
