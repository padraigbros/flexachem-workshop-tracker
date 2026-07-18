import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { THEME_KEY, THEMES } from "../lib/constants";
import { supabase } from "../lib/supabase";

const ThemeContext = createContext(null);
const THEME_COLORS = { light: "#f5f8fc", dark: "#050d1c" };

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolve(theme) {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

function readStored() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return THEMES.includes(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }) {
  // Light is the default identity; an explicit choice (light/dark/system) persists,
  // and for signed-in users is mirrored to their account (see setTheme persist path).
  const [theme, setThemeState] = useState(readStored);
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

  // persist: also mirror to the signed-in account (fire-and-forget). Pass false when
  // applying a value that CAME from the account, to avoid an echo write.
  const setTheme = useCallback((next, { persist = true } = {}) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    if (persist && supabase) {
      supabase.auth.getSession()
        .then(({ data }) => { if (data?.session) supabase.rpc("set_my_theme", { new_theme: next }).catch(() => {}); })
        .catch(() => {});
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolve(theme) === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
