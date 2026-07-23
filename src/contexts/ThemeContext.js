"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "growvest-theme";

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(preference) {
  if (typeof document === "undefined") return "light";
  const resolved = preference === "system" ? getSystemTheme() : preference;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState("system");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = ["light", "dark", "system"].includes(stored) ? stored : "system";
    setPreferenceState(initial);
    setResolvedTheme(applyTheme(initial));
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const handleChange = () => {
      if (preference === "system") setResolvedTheme(applyTheme("system"));
    };
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, [preference]);

  const setPreference = useCallback((nextPreference) => {
    const safePreference = ["light", "dark", "system"].includes(nextPreference) ? nextPreference : "system";
    window.localStorage.setItem(STORAGE_KEY, safePreference);
    setPreferenceState(safePreference);
    setResolvedTheme(applyTheme(safePreference));
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setPreference]);

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference, toggleTheme }), [preference, resolvedTheme, setPreference, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
