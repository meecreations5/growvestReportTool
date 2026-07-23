"use client";

import { BellRing, ChevronRight, X } from "lucide-react";
import { useInvestorNotifications } from "@/contexts/InvestorNotificationContext";

export default function InvestorNotificationToasts() {
  const notifications = useInvestorNotifications();
  if (!notifications?.toasts?.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[76px] z-[80] mx-auto grid max-w-md gap-2 sm:inset-x-auto sm:right-5 sm:top-20 sm:w-[390px]">
      {notifications.toasts.map((item) => (
        <article key={item.id} className="pointer-events-auto overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl">
          <div className="h-1 bg-[linear-gradient(90deg,var(--gv-blue),var(--gv-cyan))]" />
          <div className="flex gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[var(--gv-blue)]"><BellRing size={18} /></span>
            <button type="button" onClick={() => notifications.openNotification(item)} className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-bold text-slate-950">{item.title || "GrowVest update"}</span>
              <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">{item.message}</span>
              {item.link ? <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--gv-blue)]">View update <ChevronRight size={13} /></span> : null}
            </button>
            <button type="button" onClick={() => notifications.dismissToast(item.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Dismiss notification"><X size={15} /></button>
          </div>
        </article>
      ))}
    </div>
  );
}
