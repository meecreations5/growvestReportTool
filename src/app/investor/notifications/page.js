"use client";

import { useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  FileBarChart2,
  FileText,
  Info,
  Megaphone,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles
} from "lucide-react";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import { useInvestorNotifications } from "@/contexts/InvestorNotificationContext";
import { formatDateTime } from "@/lib/utils/date";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" }
];

const PUSH_CATEGORIES = [
  { key: "reports", label: "Reports", description: "New monthly reports and published revisions." },
  { key: "meetings", label: "Meetings & MOM", description: "Review schedules, reminders and meeting summaries." },
  { key: "documents", label: "Documents", description: "New documents and document-status updates." },
  { key: "general", label: "General updates", description: "Important GrowVest service announcements." }
];

function iconFor(item) {
  const type = String(item?.eventType || "").toLowerCase();
  if (type.includes("report")) return FileBarChart2;
  if (type.includes("meeting") || type.includes("mom")) return CalendarClock;
  if (type.includes("document")) return FileText;
  if (type.includes("announcement")) return Megaphone;
  return BellRing;
}

function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-4 ${disabled ? "opacity-55" : ""}`}>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[var(--gv-ink)]">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[var(--gv-blue)]" : "bg-slate-300"} disabled:cursor-not-allowed`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function pushDescription(notifications) {
  if (!notifications.pushSupported) return "This browser does not support web push notifications.";
  if (!notifications.pushConfigured) return "Web Push is not configured for this deployment yet.";
  if (notifications.pushPermission === "denied") return "Notifications are blocked. Enable them from the browser or phone site settings.";
  if (notifications.pushEnabled) return "Receive report, meeting and document alerts even when the GrowVest app is closed.";
  return "Enable alerts on this phone or computer for important Investor Portal updates.";
}

export default function InvestorNotificationsPage() {
  const notifications = useInvestorNotifications();
  const [filter, setFilter] = useState("all");
  const visibleItems = useMemo(
    () => filter === "unread" ? notifications.unreadItems : notifications.items,
    [filter, notifications.items, notifications.unreadItems]
  );
  const pushDisabled = notifications.pushBusy || (!notifications.pushEnabled && (!notifications.pushSupported || !notifications.pushConfigured || notifications.pushPermission === "denied"));

  async function togglePush(enabled) {
    try { await notifications.setPushAlerts(enabled); }
    catch (error) { console.error(error); }
  }

  async function testPush() {
    try { await notifications.testPush(); }
    catch (error) { console.error(error); }
  }

  return (
    <div className="gv-page-stack">
      <InvestorPageHeader
        eyebrow="Investor updates"
        title="Notification Centre"
        description="Reports, meetings, documents and important GrowVest updates in one secure place."
        actions={notifications.unreadCount ? (
          <button type="button" onClick={notifications.markAllRead} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-[var(--gv-blue)]">
            <CheckCheck size={17} /> Mark all read
          </button>
        ) : null}
      />

      <section className={`overflow-hidden rounded-[24px] border p-4 shadow-[var(--gv-shadow-card)] sm:p-5 ${notifications.pushEnabled ? "border-emerald-200 bg-emerald-50/70" : "border-blue-200 bg-blue-50/70"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${notifications.pushEnabled ? "bg-emerald-600 text-white" : "bg-[var(--gv-blue)] text-white"}`}>
            <Smartphone size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.13em] text-slate-500">Closed-app alerts</p>
                <h2 className="mt-1 font-heading text-xl font-bold text-[var(--gv-ink)]">{notifications.pushEnabled ? "Push notifications are active" : "Enable push notifications"}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{pushDescription(notifications)}</p>
              </div>
              <button
                type="button"
                onClick={() => togglePush(!notifications.pushEnabled)}
                disabled={pushDisabled}
                className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${notifications.pushEnabled ? "border border-slate-300 bg-white text-slate-700" : "bg-[var(--gv-blue)] text-white"}`}
              >
                {notifications.pushBusy ? "Please wait…" : notifications.pushEnabled ? "Turn off on this device" : "Enable on this device"}
              </button>
            </div>
            {notifications.pushMessage ? <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700">{notifications.pushMessage}</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="sticky top-[72px] z-10 mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--gv-border)] bg-white/95 p-2 shadow-[var(--gv-shadow-card)] backdrop-blur-xl sm:static">
            <div className="flex gap-1" role="tablist" aria-label="Notification filters">
              {FILTERS.map((item) => (
                <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`min-h-10 rounded-xl px-4 text-sm font-bold transition ${filter === item.value ? "bg-[var(--gv-blue)] text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                  {item.label}{item.value === "unread" && notifications.unreadCount ? ` (${notifications.unreadCount})` : ""}
                </button>
              ))}
            </div>
            <span className="hidden pr-2 text-xs font-semibold text-slate-400 sm:block">Live updates</span>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[var(--gv-border)] bg-white shadow-[var(--gv-shadow-card)]">
            {notifications.loading ? <div className="p-8 text-center text-sm text-slate-500">Loading notifications…</div> : null}
            {notifications.error ? <div className="p-5 text-sm text-red-700">{notifications.error}</div> : null}
            {!notifications.loading && visibleItems.map((item) => {
              const Icon = iconFor(item);
              const unread = item.status !== "read";
              return (
                <button key={item.id} type="button" onClick={() => notifications.openNotification(item)} className={`group flex w-full gap-3.5 border-b border-slate-100 p-4 text-left transition last:border-b-0 hover:bg-slate-50 sm:p-5 ${unread ? "bg-blue-50/45" : "bg-white"}`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${unread ? "bg-[var(--gv-blue)] text-white" : "bg-slate-100 text-slate-500"}`}><Icon size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2"><span className="min-w-0 flex-1 text-sm font-bold text-[var(--gv-ink)] sm:text-[15px]">{item.title || "GrowVest update"}</span>{unread ? <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" /> : null}</span>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-600 sm:text-sm">{item.message}</span>
                    <span className="mt-2.5 block text-[11px] font-semibold text-slate-400">{formatDateTime(item.createdAt)}</span>
                  </span>
                  {item.link ? <ChevronRight size={18} className="mt-3 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--gv-blue)]" /> : null}
                </button>
              );
            })}
            {!notifications.loading && !visibleItems.length ? (
              <div className="px-6 py-14 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-slate-100 text-slate-400"><Sparkles size={23} /></span><h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">You are all caught up</h2><p className="mt-2 text-sm text-slate-500">New investor updates will appear here automatically.</p></div>
            ) : null}
          </div>
        </div>

        <aside className="h-fit rounded-[24px] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[var(--gv-blue)]"><Settings2 size={20} /></span><div><p className="gv-eyebrow">Preferences</p><h2 className="font-heading text-xl font-bold text-[var(--gv-ink)]">App alerts</h2></div></div>
          <div className="mt-4 divide-y divide-slate-200">
            <Toggle checked={notifications.inAppAlerts} onChange={notifications.setInAppAlerts} label="In-app banners" description="Show a banner when a new update arrives while you are using the portal." />
            {PUSH_CATEGORIES.map((item) => (
              <Toggle
                key={item.key}
                checked={notifications.pushCategories[item.key] !== false}
                onChange={(enabled) => notifications.updatePushCategory(item.key, enabled)}
                disabled={!notifications.pushEnabled}
                label={item.label}
                description={item.description}
              />
            ))}
          </div>

          {notifications.pushEnabled ? (
            <button type="button" onClick={testPush} disabled={notifications.pushBusy} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-[var(--gv-blue)] disabled:opacity-50">
              <Send size={16} /> Send test notification
            </button>
          ) : null}

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            <div className="flex items-center gap-2 font-bold text-slate-700"><ShieldCheck size={15} /> Privacy-first delivery</div>
            <p className="mt-2">The push message contains only a short update and a secure app link. Financial report details remain protected inside the signed-in portal.</p>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-800"><Info size={16} className="mt-0.5 shrink-0" /> Push preferences are separate from email delivery and apply to the devices where notifications are enabled.</div>
        </aside>
      </section>
    </div>
  );
}
