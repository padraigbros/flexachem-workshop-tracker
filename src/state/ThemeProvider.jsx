import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { THEME_KEY } from "../lib/constants";

const ThemeContext = createContext(null);
const THEME_COLORS = { light: "#f5f8fc", dark: "#050d1c" };

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolve(theme) {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

export function ThemeProvider({ children }) {
  // Dark-first identity: new visitors get the control-room dark theme; an explicit
  // choice (or "system") persists once made.
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; }
  });
  const [resolved, setResolved] = useState(() => resolve(theme));

  useEffect(() => {
    const applied = resolve(theme);
    setResolved(applied);
    const root = document.documentElement;
    root.classList.toggle("dark", applied === "dark");
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLORS[applied];
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  // Follow the OS when in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const applied = mq.matches ? "dark" : "light";
      setResolved(applied);
      document.documentElement.classList.toggle("dark", applied === "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next) => setThemeState(next), []);
  const toggle = useCallback(() => setThemeState((prev) => {
    const current = resolve(prev);
    return current === "dark" ? "light" : "dark";
  }), []);

  const value = useMemo(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
