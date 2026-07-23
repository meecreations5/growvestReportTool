"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_GROUPS } from "@/lib/constants/navigation";
import { useAuth } from "@/contexts/AuthContext";
import BrandLogo from "@/components/branding/BrandLogo";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { usePermissions } from "@/contexts/PermissionContext";

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { canAccess } = usePermissions();

  return (
    <>
      {open ? <button aria-label="Close navigation overlay" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm lg:hidden" /> : null}
      <aside className={`app-shell-sidebar fixed inset-y-0 left-0 z-40 flex w-[var(--gv-sidebar-width)] flex-col border-r border-slate-200/90 bg-white transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex min-h-20 items-center justify-between border-b border-slate-200/80 px-5">
          <BrandLogo variant="wide" className="min-w-0 flex-1" />
          <button type="button" onClick={onClose} aria-label="Close navigation" className="ml-3 grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav aria-label="Primary navigation" className="gv-scrollbar flex-1 overflow-y-auto px-3 py-5">
          <div className="grid gap-5">
            {NAV_GROUPS.map((group) => {
              const items = group.items.filter((item) => item.roles.includes(profile?.role) && canAccess(item.permission));
              if (!items.length) return null;
              return (
                <section key={group.label} aria-labelledby={`nav-${group.label.replace(/\s+/g, "-").toLowerCase()}`}>
                  <p id={`nav-${group.label.replace(/\s+/g, "-").toLowerCase()}`} className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{group.label}</p>
                  <div className="grid gap-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                        >
                          <span className={`grid h-8 w-8 place-items-center rounded-lg transition ${active ? "bg-white text-[var(--gv-blue)] shadow-sm" : "text-slate-500 group-hover:bg-white"}`}>
                            <Icon size={18} strokeWidth={2} />
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-200/80 p-4">
          <div className="rounded-2xl bg-[var(--gv-ink)] p-4 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-bold">{String(profile?.fullName || "GV").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{profile?.fullName || "GrowVest User"}</p>
                <p className="truncate text-xs text-slate-400">{ROLE_LABELS[profile?.role] || profile?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
