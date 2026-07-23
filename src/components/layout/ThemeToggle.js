"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle({ compact = false, className = "" }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 ${compact ? "w-11 px-0" : ""} ${className}`}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {!compact ? <span className="text-sm font-semibold">{dark ? "Light" : "Dark"}</span> : null}
    </button>
  );
}
