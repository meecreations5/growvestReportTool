"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronRight, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useInvestorNotifications } from "@/contexts/InvestorNotificationContext";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications
} from "@/services/notificationService";
import { formatDateTime } from "@/lib/utils/date";

export default function NotificationBell({ className = "", inverted = false }) {
  const router = useRouter();
  const { profile } = useAuth();
  const investorContext = useInvestorNotifications();
  const [open, setOpen] = useState(false);
  const [staffItems, setStaffItems] = useState([]);
  const [staffError, setStaffError] = useState("");
  const panelRef = useRef(null);
  const investorMode = profile?.role === "investor" && Boolean(investorContext);
  const items = investorMode ? investorContext.items : staffItems;
  const error = investorMode ? investorContext.error : staffError;

  useEffect(() => {
    if (investorMode || !profile?.id) return undefined;
    return subscribeNotifications(
      profile,
      setStaffItems,
      (nextError) => {
        console.error(nextError);
        setStaffError("Notifications could not be loaded.");
      }
    );
  }, [investorMode, profile]);

  useEffect(() => {
    function handleClick(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unread = useMemo(() => items.filter((item) => item.status !== "read"), [items]);

  async function openNotification(item) {
    try {
      if (investorMode) await investorContext.openNotification(item);
      else {
        if (item.status !== "read") await markNotificationRead(item.id);
        if (item.link) router.push(item.link);
      }
    } catch (nextError) {
      console.error(nextError);
    }
    setOpen(false);
  }

  async function markAllRead() {
    try {
      if (investorMode) await investorContext.markAllRead();
      else await markAllNotificationsRead(items);
    } catch (nextError) {
      console.error(nextError);
    }
  }

  return (
    <div ref={panelRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`relative grid h-11 w-11 place-items-center rounded-2xl border transition ${inverted ? "border-white/15 bg-white/10 text-white hover:bg-white/20" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
        aria-label={`Open notifications${unread.length ? `, ${unread.length} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell size={19} />
        {unread.length ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-white">{Math.min(unread.length, 99)}</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-[76px] z-50 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[52px] sm:w-[390px]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
            <div><p className="font-heading text-lg font-bold text-slate-950">Notifications</p><p className="text-xs text-slate-500">{unread.length} unread update{unread.length === 1 ? "" : "s"}</p></div>
            <button type="button" onClick={markAllRead} disabled={!unread.length} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-40"><CheckCheck size={15} /> Mark all read</button>
          </div>
          <div className="gv-scrollbar max-h-[calc(100dvh-175px)] overflow-y-auto sm:max-h-[430px]">
            {error ? <p className="p-4 text-sm text-red-700">{error}</p> : null}
            {items.slice(0, 12).map((item) => (
              <button key={item.id} type="button" onClick={() => openNotification(item)} className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${item.status !== "read" ? "bg-blue-50/60" : "bg-white"}`}>
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.status !== "read" ? "bg-blue-700" : "bg-slate-300"}`} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-950">{item.title}</span><span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600">{item.message}</span><span className="mt-2 block text-[11px] font-semibold text-slate-400">{formatDateTime(item.createdAt)}</span></span>
                {item.link ? <ExternalLink size={15} className="mt-1 shrink-0 text-slate-400" /> : null}
              </button>
            ))}
            {!items.length && !error ? <div className="p-8 text-center text-sm text-slate-500">No notifications yet.</div> : null}
          </div>
          {investorMode ? (
            <button type="button" onClick={() => { setOpen(false); router.push("/investor/notifications"); }} className="flex min-h-12 w-full items-center justify-center gap-1 border-t border-slate-200 text-sm font-bold text-[var(--gv-blue)]">View notification centre <ChevronRight size={16} /></button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
