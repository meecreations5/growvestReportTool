"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { INVESTOR_NAV_ITEMS } from "@/lib/constants/investorNavigation";
import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import BrandLogo from "@/components/branding/BrandLogo";

const MOBILE_ITEMS = INVESTOR_NAV_ITEMS.filter((item) => item.mobile);

function initials(name) {
  return String(name || "Investor")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "I";
}

export default function InvestorShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/investor-login");
  }

  return (
    <div className="min-h-dvh bg-[var(--gv-surface)] pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/investor/dashboard" className="flex min-w-0 items-center gap-3" aria-label="GrowVest Investor Portal home">
            <BrandLogo variant="wide" className="hidden max-w-[172px] sm:block" />
            <BrandLogo variant="icon" className="h-10 w-10 sm:hidden" />
            <div className="min-w-0 border-l border-slate-200 pl-3 sm:pl-4">
              <p className="font-heading text-sm font-bold text-[var(--gv-ink)] sm:text-base">Investor Portal</p>
              <p className="truncate text-[11px] text-[var(--gv-muted)] sm:text-xs">Hello, {profile?.fullName?.split(" ")[0] || "Investor"}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <details className="relative hidden sm:block">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:bg-slate-50">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--gv-blue)] text-xs font-bold text-white">{initials(profile?.fullName)}</span>
                <span className="hidden max-w-[150px] lg:block">
                  <strong className="block truncate text-xs text-slate-800">{profile?.fullName || "Investor"}</strong>
                  <span className="block truncate text-[10px] text-slate-400">{profile?.clientCode || "Secure portal"}</span>
                </span>
                <ChevronDown size={15} className="text-slate-400" />
              </summary>
              <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--gv-shadow-float)]">
                <Link href="/investor/profile" className="flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">View profile</Link>
                <Link href="/investor/change-password" className="flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Login &amp; security</Link>
                <button type="button" onClick={handleLogout} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={16} /> Sign out</button>
              </div>
            </details>
            <button type="button" onClick={handleLogout} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 sm:hidden" aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-7 px-4 py-5 sm:px-6 sm:py-7 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden h-fit rounded-[var(--gv-radius-lg)] border border-slate-200 bg-white p-3 shadow-[var(--gv-shadow-card)] lg:block">
          <div className="mb-3 rounded-2xl bg-[var(--gv-blue-soft)] p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--gv-blue)]"><ShieldCheck size={16} /> Secure client access</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Only published and client-visible information is available here.</p>
          </div>
          <nav className="grid gap-1" aria-label="Investor portal navigation">
            {INVESTOR_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[var(--gv-blue)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>

      <nav aria-label="Investor mobile navigation" className="gv-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/97 px-2 pt-2 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${active ? "text-[var(--gv-blue)]" : "text-slate-500"}`}>
                {active ? <span className="absolute top-0 h-1 w-7 rounded-full bg-[var(--gv-blue)]" /> : null}
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
