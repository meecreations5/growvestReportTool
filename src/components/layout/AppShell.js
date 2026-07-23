"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

const SIDEBAR_KEY = "growvest-sidebar-collapsed";

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[var(--gv-surface)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[5.5rem]" : "lg:pl-[var(--gv-sidebar-width)]"}`}>
        <Header onMenu={() => setSidebarOpen(true)} />
        <main className="px-4 py-5 sm:px-6 sm:py-7 xl:px-8 xl:py-8">
          <div className="gv-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
