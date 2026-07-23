"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Download,
  LogOut,
  MoreHorizontal,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";
import { INVESTOR_NAV_ITEMS } from "@/lib/constants/investorNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePwa } from "@/contexts/PwaContext";
import { useInvestorNotifications } from "@/contexts/InvestorNotificationContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import InvestorNotificationToasts from "@/components/notifications/InvestorNotificationToasts";
import BrandLogo from "@/components/branding/BrandLogo";
import { PwaConnectionBanner, PwaInstallCard, PwaUpdateBanner } from "@/components/pwa/PwaStatus";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";

const MOBILE_ITEMS = INVESTOR_NAV_ITEMS.filter((item) => item.mobile);
const MORE_ITEMS = INVESTOR_NAV_ITEMS.filter((item) => !item.mobile);

function initials(name) {
  return String(name || "Investor")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "I";
}


function ProfileAvatar({ profile, className = "h-8 w-8", rounded = "rounded-full" }) {
  return profile?.photoURL
    ? <img src={profile.photoURL} alt={profile.fullName || "Investor"} className={`${className} ${rounded} object-cover`} />
    : <span className={`grid ${className} ${rounded} place-items-center bg-[var(--gv-blue)] text-xs font-bold text-white`}>{initials(profile?.fullName)}</span>;
}

export default function InvestorShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuth();
  const { canInstall, installApp, isInstalled } = usePwa();
  const notifications = useInvestorNotifications();
  const { resolvedTheme } = useTheme();
  const darkMode = resolvedTheme === "dark";
  const [moreOpen, setMoreOpen] = useState(false);
  const firstName = profile?.fullName?.split(" ")[0] || "Investor";

  async function handleLogout() {
    setMoreOpen(false);
    await logout();
    router.replace("/investor-login");
  }

  return (
    <div className="min-h-dvh bg-[var(--gv-surface)] pb-[calc(5.45rem+env(safe-area-inset-bottom))] lg:pb-0">
      <PwaConnectionBanner />
      <PwaUpdateBanner />
      <InvestorNotificationToasts />

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[66px] max-w-[1440px] items-center justify-between gap-3 px-3.5 sm:px-6 lg:px-8">
          <Link href="/investor/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="GrowVest Investor home">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--gv-blue)] p-1.5 shadow-sm sm:hidden">
              <BrandLogo variant="icon" className="!h-full !w-full" imageClassName="!h-full !w-full rounded-xl bg-white object-contain p-1" />
            </span>
            <BrandLogo variant="wide" inverse={darkMode} className="hidden max-w-[172px] sm:flex" />
            <div className="min-w-0 sm:border-l sm:border-slate-200 sm:pl-4">
              <p className="truncate font-heading text-[15px] font-bold leading-tight text-[var(--gv-ink)] sm:text-base">Hello, {firstName}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400 sm:normal-case sm:tracking-normal">GrowVest Investor App</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {canInstall ? <div className="hidden md:block"><PwaInstallCard compact /></div> : null}
            <ThemeToggle compact />
            <NotificationBell />

            <details className="relative hidden sm:block">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:bg-slate-50">
                <ProfileAvatar profile={profile} />
                <span className="hidden max-w-[150px] lg:block">
                  <strong className="block truncate text-xs text-slate-800">{profile?.fullName || "Investor"}</strong>
                  <span className="block truncate text-[10px] text-slate-400">{profile?.clientCode || "Secure portal"}</span>
                </span>
                <ChevronDown size={15} className="text-slate-400" />
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--gv-shadow-float)]">
                <Link href="/investor/profile" className="flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">View profile</Link>
                <Link href="/investor/change-password" className="flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Login &amp; security</Link>
                {canInstall ? <button type="button" onClick={installApp} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-[var(--gv-blue)] hover:bg-blue-50"><Download size={16} /> Install app</button> : null}
                <button type="button" onClick={handleLogout} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={16} /> Sign out</button>
              </div>
            </details>

            <button type="button" onClick={() => setMoreOpen(true)} className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-slate-950 text-xs font-bold text-white shadow-sm sm:hidden" aria-label="Open profile and more options">
              <ProfileAvatar profile={profile} className="h-11 w-11" rounded="rounded-2xl" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-7 px-3.5 py-4 sm:px-6 sm:py-7 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden h-fit rounded-[var(--gv-radius-lg)] border border-slate-200 bg-white p-3 shadow-[var(--gv-shadow-card)] lg:block">
          <div className="mb-3 rounded-2xl bg-[var(--gv-blue-soft)] p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--gv-blue)]"><ShieldCheck size={16} /> Secure client access</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Only published and client-visible information is available here.</p>
          </div>
          <nav className="grid gap-1" aria-label="Investor portal navigation">
            {INVESTOR_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = item.href === "/investor/notifications" ? notifications?.unreadCount : 0;
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[var(--gv-blue)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                  <Icon size={18} />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {badge ? <span className={`grid min-h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black ${active ? "bg-white text-[var(--gv-blue)]" : "bg-red-600 text-white"}`}>{Math.min(badge, 99)}</span> : null}
                </Link>
              );
            })}
          </nav>
          {canInstall ? <div className="mt-3 border-t border-slate-200 pt-3"><button type="button" onClick={installApp} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-[var(--gv-blue)] hover:bg-blue-50"><Download size={18} /> Install investor app</button></div> : null}
          {isInstalled ? <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">App installed</p> : null}
        </aside>

        <main className="min-w-0">
          {pathname === "/investor/dashboard" && canInstall ? <div className="mb-4 md:hidden"><PwaInstallCard /></div> : null}
          {children}
        </main>
      </div>

      <nav aria-label="Investor mobile navigation" className="gv-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/97 px-2 pt-1.5 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const badge = item.href === "/investor/notifications" ? notifications?.unreadCount : 0;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-[61px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${active ? "text-[var(--gv-blue)]" : "text-slate-500"}`}>
                {active ? <span className="absolute top-0 h-1 w-7 rounded-full bg-[var(--gv-blue)]" /> : null}
                <span className="relative"><Icon size={21} strokeWidth={active ? 2.5 : 2} />{badge ? <span className="absolute -right-2.5 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-white">{Math.min(badge, 9)}</span> : null}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className={`relative flex min-h-[61px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${MORE_ITEMS.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ? "text-[var(--gv-blue)]" : "text-slate-500"}`}>
            <MoreHorizontal size={22} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-[90] sm:hidden" role="dialog" aria-modal="true" aria-label="Investor app menu">
          <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} aria-label="Close menu" />
          <section className="gv-safe-bottom absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[30px] bg-white px-4 pb-4 pt-3 shadow-2xl">
            <div className="mx-auto h-1.5 w-11 rounded-full bg-slate-200" />
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-950 p-4 text-white">
              <ProfileAvatar profile={profile} className="h-12 w-12" rounded="rounded-2xl" />
              <div className="min-w-0 flex-1"><p className="truncate font-heading text-lg font-bold text-white">{profile?.fullName || "Investor"}</p><p className="truncate text-xs text-slate-400">{profile?.clientCode || "Secure GrowVest profile"}</p></div>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Close menu"><X size={19} /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={`flex min-h-[74px] flex-col justify-between rounded-2xl border p-3.5 ${active ? "border-blue-200 bg-blue-50 text-[var(--gv-blue)]" : "border-slate-200 bg-white text-slate-700"}`}>
                    <Icon size={20} />
                    <span className="text-sm font-bold">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {canInstall ? <button type="button" onClick={async () => { await installApp(); setMoreOpen(false); }} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gv-blue)] px-4 text-sm font-bold text-white"><Download size={17} /> Install GrowVest Investor App</button> : null}
            <button type="button" onClick={handleLogout} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700"><LogOut size={17} /> Sign out securely</button>
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] font-semibold text-slate-400"><UserRound size={14} /> Your investor information remains private and secure.</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
