"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NAV_ITEMS, QUICK_CREATE_ITEMS } from "@/lib/constants/navigation";
import NotificationBell from "@/components/notifications/NotificationBell";
import BrandLogo from "@/components/branding/BrandLogo";

function currentLabel(pathname) {
  const item = NAV_ITEMS.find((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`));
  return item?.label || "Workspace";
}

export default function Header({ onMenu }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuth();
  const [quickOpen, setQuickOpen] = useState(false);
  const quickItems = QUICK_CREATE_ITEMS.filter((item) => item.roles.includes(profile?.role));

  async function handleLogout() {
    await logout();
    router.replace("/staff-login");
  }

  return (
    <header className="app-shell-header sticky top-0 z-20 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
      <div className="flex min-h-20 items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onMenu} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <BrandLogo variant="icon" className="hidden sm:grid lg:hidden" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Workspace / <span className="text-slate-700">{currentLabel(pathname)}</span></p>
            <p className="font-heading truncate text-lg leading-tight">Welcome, {profile?.fullName?.split(" ")[0] || "User"}</p>
          </div>
        </div>

        <div className="hidden min-w-[240px] max-w-md flex-1 px-6 md:block">
          <label className="relative block">
            <span className="sr-only">Search workspace</span>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="search" placeholder="Search investors, leads or reports" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--gv-blue)] focus:bg-white focus:ring-4 focus:ring-blue-100" />
          </label>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative hidden sm:block">
            <button type="button" onClick={() => setQuickOpen((value) => !value)} aria-expanded={quickOpen} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--gv-blue)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--gv-blue-strong)]">
              <Plus size={18} /> Quick create <ChevronDown size={15} />
            </button>
            {quickOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--gv-shadow-float)]">
                {quickItems.map((item) => {
                  const Icon = item.icon;
                  return <Link key={item.label} href={item.href} onClick={() => setQuickOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Icon size={17} className="text-[var(--gv-blue)]" />{item.label}</Link>;
                })}
              </div>
            ) : null}
          </div>
          <NotificationBell />
          <button onClick={handleLogout} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 sm:inline-flex sm:w-auto sm:gap-2 sm:px-3" aria-label="Sign out">
            <LogOut size={17} />
            <span className="hidden text-sm font-semibold sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
