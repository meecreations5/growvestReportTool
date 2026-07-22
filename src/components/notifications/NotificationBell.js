"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications
} from "@/services/notificationService";
import { formatDateTime } from "@/lib/utils/date";

export default function NotificationBell() {
  const router = useRouter();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const panelRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeNotifications(
      profile,
      setItems,
      (nextError) => {
        console.error(nextError);
        setError("Notifications could not be loaded.");
      }
    );
  }, [profile?.id, profile?.investorId, profile?.role]);

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
      if (item.status !== "read") await markNotificationRead(item.id);
    } catch (nextError) {
      console.error(nextError);
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
        aria-label="Open notifications"
      >
        <Bell size={19} />
        {unread.length ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{Math.min(unread.length, 99)}</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-[76px] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[390px]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div><p className="font-black text-slate-950">Notifications</p><p className="text-xs text-slate-500">{unread.length} unread</p></div>
            <button type="button" onClick={() => markAllNotificationsRead(items)} disabled={!unread.length} className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 disabled:opacity-40"><CheckCheck size={15} /> Mark all read</button>
          </div>
          <div className="gv-scrollbar max-h-[calc(100dvh-150px)] overflow-y-auto sm:max-h-[430px]">
            {error ? <p className="p-4 text-sm text-red-700">{error}</p> : null}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => openNotification(item)} className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${item.status !== "read" ? "bg-blue-50/60" : "bg-white"}`}>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.status !== "read" ? "bg-blue-700" : "bg-slate-300"}`} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.message}</span><span className="mt-2 block text-[11px] font-semibold text-slate-400">{formatDateTime(item.createdAt)}</span></span>
                {item.link ? <ExternalLink size={15} className="mt-1 shrink-0 text-slate-400" /> : null}
              </button>
            ))}
            {!items.length && !error ? <div className="p-8 text-center text-sm text-slate-500">No notifications yet.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
