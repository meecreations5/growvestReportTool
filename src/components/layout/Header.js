"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, Plus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NAV_ITEMS, QUICK_CREATE_ITEMS } from "@/lib/constants/navigation";
import NotificationBell from "@/components/notifications/NotificationBell";
import BrandLogo from "@/components/branding/BrandLogo";
import { usePermissions } from "@/contexts/PermissionContext";
import WorkspaceSearch from "@/components/layout/WorkspaceSearch";
import ThemeToggle from "@/components/layout/ThemeToggle";

function currentLabel(pathname) {
  const item = NAV_ITEMS.find((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`));
  return item?.label || (pathname.startsWith("/profile") ? "My Profile" : "Workspace");
}

function initials(name) {
  return String(name || "GV").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function Avatar({ profile, className = "h-9 w-9" }) {
  return profile?.photoURL ? (
    <img src={profile.photoURL} alt={profile.fullName || "Profile"} className={`${className} rounded-full object-cover`} />
  ) : (
    <span className={`grid ${className} place-items-center rounded-full bg-[var(--gv-blue)] text-xs font-bold text-white`}>{initials(profile?.fullName)}</span>
  );
}

export default function Header({ onMenu }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuth();
  const { canManage } = usePermissions();
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const quickItems = QUICK_CREATE_ITEMS.filter((item) => item.roles.includes(profile?.role) && canManage(item.permission));

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

        <div className="hidden min-w-[260px] max-w-xl flex-1 px-5 md:block">
          <WorkspaceSearch />
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
          <ThemeToggle compact />
          <NotificationBell />
          <div className="relative hidden sm:block">
            <button type="button" onClick={() => setProfileOpen((value) => !value)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 transition hover:bg-slate-50" aria-expanded={profileOpen} aria-label="Open profile menu">
              <Avatar profile={profile} />
              <ChevronDown size={15} className="text-slate-400" />
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--gv-shadow-float)]">
                <div className="border-b border-slate-100 px-3 py-2.5"><p className="truncate text-sm font-bold text-slate-900">{profile?.fullName || "GrowVest User"}</p><p className="truncate text-xs text-slate-500">{profile?.email}</p></div>
                <Link href="/profile" onClick={() => setProfileOpen(false)} className="mt-1 flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">My profile</Link>
                <button onClick={handleLogout} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={17} /> Sign out</button>
              </div>
            ) : null}
          </div>
          <button onClick={handleLogout} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 sm:hidden" aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-2 md:hidden"><WorkspaceSearch /></div>
    </header>
  );
}
