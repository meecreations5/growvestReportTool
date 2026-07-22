"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--gv-surface)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[var(--gv-sidebar-width)]">
        <Header onMenu={() => setSidebarOpen(true)} />
        <main className="px-4 py-5 sm:px-6 sm:py-7 xl:px-8 xl:py-8">
          <div className="gv-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
