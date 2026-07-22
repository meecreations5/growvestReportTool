import { MessageCircleMore } from "lucide-react";
import { formatDateTime } from "@/lib/utils/date";
import StatusBadge from "./StatusBadge";

export default function FollowUpHistory({ items, loading }) {
  if (loading) return <p className="text-sm text-slate-500">Loading follow-up history…</p>;
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
        <MessageCircleMore className="mx-auto text-slate-400" size={28} />
        <p className="mt-3 text-sm font-semibold text-slate-700">No follow-ups recorded yet</p>
        <p className="mt-1 text-xs text-slate-500">Every call, WhatsApp, email and meeting should be logged here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{item.channel}</span>
                <StatusBadge status={item.statusAfter} />
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{item.summary}</p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-semibold text-slate-600">{formatDateTime(item.contactAt)}</p>
              <p className="mt-1 text-xs text-slate-400">by {item.createdByName || item.advisorName || "Advisor"}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Client response</p>
              <p className="mt-1 text-sm text-slate-600">{item.clientResponse || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Next action</p>
              <p className="mt-1 text-sm text-slate-600">{item.nextAction || "—"}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
