"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  X
} from "lucide-react";
import { INVESTOR_NAV_ITEMS } from "@/lib/constants/investorNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePwa } from "@/contexts/PwaContext";
import { useInvestorNotifications } from "@/contexts/InvestorNotificationContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import InvestorNotificationToasts from "@/components/notifications/InvestorNotificationToasts";
import BrandLogo from "@/components/branding/BrandLogo";
import InvestorBrandMark from "@/components/investor/mobile/InvestorBrandMark";
import InvestorEntryMotion from "@/components/investor/mobile/InvestorEntryMotion";
import { PwaConnectionBanner, PwaInstallCard, PwaUpdateBanner } from "@/components/pwa/PwaStatus";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useInvestorPrivacy } from "@/contexts/InvestorPrivacyContext";

const MOBILE_ITEMS = INVESTOR_NAV_ITEMS.filter((item) => item.mobile);
const MOBILE_LEFT_ITEMS = MOBILE_ITEMS.slice(0, 2);
const MOBILE_RIGHT_ITEMS = MOBILE_ITEMS.slice(2, 4);
const MORE_ITEMS = INVESTOR_NAV_ITEMS.filter((item) => !item.mobile);

const MOBILE_PAGE_META = [
  { prefix: "/investor/reports/", title: "Monthly Review", backHref: "/investor/reports" },
  { prefix: "/investor/portfolio/", title: "Holding Details", backHref: "/investor/portfolio" },
  { prefix: "/investor/portfolio", title: "Portfolio", backHref: "/investor/dashboard" },
  { prefix: "/investor/goals/", title: "Goal Details", backHref: "/investor/goals" },
  { prefix: "/investor/goals", title: "Bucket List", backHref: "/investor/dashboard" },
  { prefix: "/investor/reports", title: "Monthly Review", backHref: "/investor/dashboard" },
  { prefix: "/investor/insurance", title: "Protection", backHref: "/investor/dashboard" },
  { prefix: "/investor/documents", title: "Documents", backHref: "/investor/dashboard" },
  { prefix: "/investor/meetings", title: "Meetings & Reviews", backHref: "/investor/dashboard" },
  { prefix: "/investor/sip-reminders", title: "SIP Reminders", backHref: "/investor/dashboard" },
  { prefix: "/investor/actions", title: "Your Actions", backHref: "/investor/dashboard" },
  { prefix: "/investor/notifications", title: "Notifications", backHref: "/investor/dashboard" },
  { prefix: "/investor/change-password", title: "Login & Security", backHref: "/investor/profile" },
  { prefix: "/investor/profile", title: "My Profile", backHref: "/investor/dashboard" }
];

function mobilePageMeta(pathname) {
  return MOBILE_PAGE_META.find((item) => pathname.startsWith(item.prefix)) || { title: "GrowVest" };
}

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
  const { branding } = useBranding();
  const { privacyMode, togglePrivacyMode } = useInvestorPrivacy();
  const darkMode = resolvedTheme === "dark";
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileMoreActive = MORE_ITEMS.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const firstName = profile?.fullName?.split(" ")[0] || "Investor";
  const pwaTagline = branding.pwaTagline || branding.brandPositioning || "Your Conscious Wealth Partner";
  const isMobileHome = pathname === "/investor/dashboard";
  const mobileMeta = mobilePageMeta(pathname);


  // Mobile scroll recovery guard. Older hot-reload/PWA sessions could retain an
  // inline body overflow lock after closing a secure document preview. Clear that
  // stale lock whenever the Investor App mounts or changes route on a phone.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return;
    if (document.body.style.overflow === "hidden") document.body.style.overflow = "";
  }, [pathname]);

  async function handleLogout() {
    setMoreOpen(false);
    await logout();
    router.replace("/investor-login");
  }

  return (
    <div className="gv-investor-viewport min-h-dvh w-full overflow-x-clip bg-[var(--gv-surface)] pb-[calc(5.35rem+env(safe-area-inset-bottom))] lg:pb-0">
      <InvestorEntryMotion />
      <PwaConnectionBanner />
      <PwaUpdateBanner />
      <InvestorNotificationToasts />

      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        {/* v0.34.3 visual-corrected mobile app bar. Home joins the Royal Trust Blue wealth hero; every secondary screen has a consistent back path. */}
        <div className={`md:hidden ${isMobileHome ? "bg-[#1F4ED8]" : "border-b border-slate-200/80 bg-white/97 backdrop-blur-xl"}`}>
          <div className={`mx-auto flex min-h-[52px] max-w-lg items-center gap-2.5 px-3.5 ${isMobileHome ? "justify-between" : "grid grid-cols-[42px_minmax(0,1fr)_42px]"}`}>
            {isMobileHome ? (
              <>
                <Link href="/investor/dashboard" className="flex min-w-0 items-center" aria-label="GrowVest Investor home">
                  <InvestorBrandMark variant="logo" inverse className="h-auto w-[116px] shrink-0 brightness-0 invert" />
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  <NotificationBell inverted compact />
                  <Link href="/investor/profile" className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-white/25 bg-white/10" aria-label="Open profile">
                    <ProfileAvatar profile={profile} className="h-8 w-8" rounded="rounded-full" />
                  </Link>
                </div>
              </>
            ) : (
              <>
                {mobileMeta.backHref ? (
                  <Link href={mobileMeta.backHref} className="grid h-10 w-10 place-items-center rounded-full text-[#0B0B0F] active:bg-slate-100" aria-label={`Back from ${mobileMeta.title}`}>
                    <ChevronLeft size={21} strokeWidth={1.55} />
                  </Link>
                ) : <span />}
                <h1 className="truncate text-center font-heading text-[1.08rem] font-bold leading-tight text-[#0B0B0F]">{mobileMeta.title}</h1>
                <div className="flex justify-end"><NotificationBell /></div>
              </>
            )}
          </div>
        </div>

        {/* Existing tablet header is intentionally preserved from 768px to 1023px. */}
        <div className="hidden bg-[linear-gradient(135deg,var(--gv-ink),var(--gv-blue))] px-3 py-2 text-white shadow-lg md:block lg:hidden">
          <div className="mx-auto flex min-h-[54px] max-w-lg items-center justify-between gap-2.5">
            <Link href="/investor/dashboard" className="flex min-w-0 items-center gap-3" aria-label="GrowVest Investor home">
              <BrandLogo variant="wide" inverse className="max-w-[126px]" imageClassName="max-h-8 w-auto object-contain" />
              <span className="min-w-0 border-l border-white/20 pl-2.5">
                <span className="block max-w-[170px] truncate text-[8px] font-bold uppercase tracking-[0.1em] text-blue-100">{pwaTagline}</span>
                <span className="mt-0.5 block truncate font-heading text-sm font-bold leading-tight text-white">Hello, {firstName}</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <NotificationBell inverted />
              <button type="button" onClick={() => setMoreOpen(true)} className="grid h-10 w-10 touch-manipulation place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 text-xs font-bold text-white" aria-label="Open profile and more options">
                <ProfileAvatar profile={profile} className="h-10 w-10" rounded="rounded-2xl" />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-xl lg:block">
          <div className="mx-auto flex min-h-[66px] max-w-[1440px] items-center justify-between gap-3 px-6 lg:px-8">
            <Link href="/investor/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="GrowVest Investor home">
              <BrandLogo variant="wide" inverse={darkMode} className="max-w-[172px]" />
              <div className="min-w-0 border-l border-slate-200 pl-4">
                <p className="truncate font-heading text-base font-bold leading-tight text-[var(--gv-ink)]">Hello, {firstName}</p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{pwaTagline}</p>
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
            </div>
          </div>
        </div>
      </header>

      <div className={`mx-auto grid w-full min-w-0 max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-7 md:px-6 md:py-7 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8 ${isMobileHome ? "px-0 py-0" : "px-3.5 py-3.5"}`}>
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

        <main className="w-full min-w-0 max-w-full overflow-x-clip">
          {/* On phones installation belongs in More; retain the existing prompt for tablet only. */}
          {pathname === "/investor/dashboard" && canInstall ? <div className="mb-4 hidden md:block lg:hidden"><PwaInstallCard /></div> : null}
          {children}
        </main>
      </div>

      <nav aria-label="Investor mobile navigation" className="gv-mobile-bottom-nav gv-safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/98 px-2 pt-1 shadow-[0_-8px_28px_rgba(11,11,15,.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          {MOBILE_LEFT_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`gv-signature-nav-item flex min-h-[60px] touch-manipulation flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${active ? "text-[#1F4ED8]" : "text-[#6B7280]"}`}>
                <Icon size={19} strokeWidth={active ? 1.55 : 1.4} />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}

          <button type="button" onClick={() => setMoreOpen(true)} aria-current={mobileMoreActive ? "page" : undefined} className="gv-signature-center relative flex min-h-[60px] touch-manipulation flex-col items-center justify-end pb-1.5" aria-label="Open GrowVest actions">
            <span className="absolute -top-4 grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-[#1F4ED8] shadow-[0_8px_20px_rgba(31,78,216,.24)]">
              <InvestorBrandMark variant="icon" inverse className="h-auto w-[27px] brightness-0 invert" />
            </span>
            <span className="text-[10px] font-semibold leading-none text-[#6B7280]">GrowVest</span>
          </button>

          {MOBILE_RIGHT_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`gv-signature-nav-item flex min-h-[60px] touch-manipulation flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${active ? "text-[#1F4ED8]" : "text-[#6B7280]"}`}>
                <Icon size={19} strokeWidth={active ? 1.55 : 1.4} />
                <span className="max-w-[68px] truncate leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Investor app menu">
          <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} aria-label="Close menu" />

          {/* Signature GrowVest action sheet for phones. */}
          <section className="gv-safe-bottom absolute inset-x-0 bottom-0 max-h-[88dvh] overscroll-contain overflow-y-auto rounded-t-[30px] bg-white px-4 pb-4 pt-3 shadow-2xl md:hidden">
            <div className="mx-auto h-1.5 w-11 rounded-full bg-slate-200" />
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#1F4ED8]"><InvestorBrandMark variant="icon" inverse className="h-auto w-6 brightness-0 invert" /></span>
                <div><p className="font-heading text-[1.15rem] font-bold text-[#0B0B0F]">GrowVest</p><p className="text-[11px] text-[#6B7280]">Your wealth, goals and records</p></div>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-[#F4F6F9] text-[#6B7280]" aria-label="Close menu"><X size={18} strokeWidth={1.55} /></button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-5">
              {MORE_ITEMS.filter((item) => [
                "/investor/reports",
                "/investor/insurance",
                "/investor/documents",
                "/investor/meetings",
                "/investor/sip-reminders",
                "/investor/actions",
                "/investor/profile"
              ].includes(item.href)).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-w-0 flex-col items-center text-center active:opacity-70">
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-slate-200 bg-white text-[#1F4ED8] shadow-[0_5px_14px_rgba(11,11,15,.04)]"><Icon size={21} strokeWidth={1.5} /></span>
                    <span className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-[#0B0B0F]">{item.href === "/investor/profile" ? "Profile" : item.href === "/investor/insurance" ? "Protection" : item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-6 overflow-hidden border-y border-slate-200">
              <Link href="/investor/notifications" onClick={() => setMoreOpen(false)} className="flex min-h-[54px] items-center gap-3 py-3 text-[#0B0B0F]">
                <Bell size={18} strokeWidth={1.5} className="text-[#1F4ED8]" />
                <span className="min-w-0 flex-1 text-[12px] font-semibold">Notifications</span>
                {notifications?.unreadCount ? <span className="rounded-full bg-[#E53935] px-2 py-0.5 text-[9px] font-bold text-white">{Math.min(notifications.unreadCount, 99)}</span> : <ChevronRight size={16} strokeWidth={1.5} className="text-slate-300" />}
              </Link>
              <button type="button" onClick={togglePrivacyMode} className="flex min-h-[54px] w-full items-center gap-3 border-t border-slate-100 py-3 text-left text-[#0B0B0F]">
                {privacyMode ? <EyeOff size={18} strokeWidth={1.5} className="text-[#1F4ED8]" /> : <Eye size={18} strokeWidth={1.5} className="text-[#1F4ED8]" />}
                <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold">Financial privacy</span><span className="block text-[10px] text-[#6B7280]">{privacyMode ? "Values are hidden" : "Hide values across the app"}</span></span>
                <span className={`h-5 w-9 rounded-full p-0.5 transition ${privacyMode ? "bg-[#1F4ED8]" : "bg-slate-200"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${privacyMode ? "translate-x-4" : ""}`} /></span>
              </button>
            </div>

            {canInstall ? <button type="button" onClick={async () => { await installApp(); setMoreOpen(false); }} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[#1F4ED8] px-4 text-[12px] font-bold text-white"><Download size={16} strokeWidth={1.5} /> Install GrowVest Investor App</button> : null}
            <p className="mt-4 text-center text-[10px] text-[#6B7280]">Your Conscious Wealth Partner</p>
          </section>

          {/* Existing tablet sheet is intentionally preserved. */}
          <section className="gv-safe-bottom absolute inset-x-0 bottom-0 hidden max-h-[88dvh] overscroll-contain overflow-y-auto rounded-t-[30px] bg-white px-4 pb-4 pt-3 shadow-2xl md:block lg:hidden">
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
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={`flex min-h-[74px] flex-col justify-between rounded-2xl border p-3.5 ${active ? "border-blue-200 bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]" : "border-slate-200 bg-white text-slate-700"}`}>
                    <Icon size={20} />
                    <span className="text-sm font-bold">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <div><p className="text-sm font-bold text-slate-800">App appearance</p><p className="mt-0.5 text-[11px] text-slate-500">Switch between light and dark mode.</p></div>
              <ThemeToggle compact />
            </div>

            <Link href="/investor/notifications" onClick={() => setMoreOpen(false)} className="mt-3 flex min-h-12 items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-[var(--gv-blue)]">
              <span>Notification preferences</span>
              <span className="rounded-full bg-white px-2 py-1 text-[10px]">{notifications?.pushEnabled ? "Push on" : "Set up"}</span>
            </Link>

            {canInstall ? <button type="button" onClick={async () => { await installApp(); setMoreOpen(false); }} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gv-blue)] px-4 text-sm font-bold text-white"><Download size={17} /> Install GrowVest Investor App</button> : null}
            <button type="button" onClick={handleLogout} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700"><LogOut size={17} /> Sign out securely</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
