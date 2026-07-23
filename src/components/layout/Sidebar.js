"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { NAV_GROUPS } from "@/lib/constants/navigation";
import { useAuth } from "@/contexts/AuthContext";
import BrandLogo from "@/components/branding/BrandLogo";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { usePermissions } from "@/contexts/PermissionContext";
import { useTheme } from "@/contexts/ThemeContext";

function initials(name) {
  return String(name || "GV").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapsed }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { canAccess } = usePermissions();
  const { resolvedTheme } = useTheme();
  const darkMode = resolvedTheme === "dark";

  return (
    <>
      {open ? <button aria-label="Close navigation overlay" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm lg:hidden" /> : null}
      <aside className={`app-shell-sidebar fixed inset-y-0 left-0 z-40 flex w-[var(--gv-sidebar-width)] flex-col border-r border-slate-200/90 bg-white transition-[width,transform] duration-200 lg:translate-x-0 ${collapsed ? "lg:w-[5.5rem]" : "lg:w-[var(--gv-sidebar-width)]"} ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`flex min-h-20 items-center justify-between border-b border-slate-200/80 px-5 ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}><BrandLogo variant="wide" inverse={darkMode} /></div>
          {collapsed ? <div className="hidden lg:block"><BrandLogo variant="icon" className="justify-center" /></div> : null}
          <button type="button" onClick={onClose} aria-label="Close navigation" className="ml-3 grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <div className={`hidden border-b border-slate-100 py-2 lg:flex ${collapsed ? "justify-center px-2" : "justify-end px-3"}`}>
          <button type="button" onClick={onToggleCollapsed} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav aria-label="Primary navigation" className={`gv-scrollbar flex-1 overflow-y-auto px-3 py-5 ${collapsed ? "lg:px-2" : ""}`}>
          <div className="grid gap-5">
            {NAV_GROUPS.map((group) => {
              const items = group.items.filter((item) => item.roles.includes(profile?.role) && canAccess(item.permission));
              if (!items.length) return null;
              return (
                <section key={group.label} aria-labelledby={`nav-${group.label.replace(/\s+/g, "-").toLowerCase()}`}>
                  <p id={`nav-${group.label.replace(/\s+/g, "-").toLowerCase()}`} className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 ${collapsed ? "lg:hidden" : ""}`}>{group.label}</p>
                  {collapsed ? <div className="mb-2 hidden justify-center lg:flex"><span className="h-1 w-1 rounded-full bg-slate-300" /></div> : null}
                  <div className="grid gap-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          title={collapsed ? item.label : undefined}
                          aria-label={collapsed ? item.label : undefined}
                          aria-current={active ? "page" : undefined}
                          className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${collapsed ? "lg:justify-center lg:gap-0 lg:px-2" : ""} ${active ? "bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                        >
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-white text-[var(--gv-blue)] shadow-sm" : "text-slate-500 group-hover:bg-white"}`}>
                            <Icon size={18} strokeWidth={2} />
                          </span>
                          <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </nav>

        <div className={`border-t border-slate-200/80 p-4 ${collapsed ? "lg:p-2" : ""}`}>
          <Link href="/profile" title="My profile" className={`block rounded-2xl bg-[var(--gv-ink)] p-4 text-white ${collapsed ? "lg:p-2" : ""}`}>
            <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center lg:gap-0" : ""}`}>
              {profile?.photoURL ? <img src={profile.photoURL} alt={profile.fullName || "Profile"} className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-bold">{initials(profile?.fullName)}</span>}
              <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                <p className="truncate text-sm font-bold">{profile?.fullName || "GrowVest User"}</p>
                <p className="truncate text-xs text-slate-400">{ROLE_LABELS[profile?.role] || profile?.role}</p>
              </div>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
