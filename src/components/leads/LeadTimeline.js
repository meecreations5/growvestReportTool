import { History } from "lucide-react";
import { formatDateTime } from "@/lib/utils/date";

export default function LeadTimeline({ items, loading }) {
  if (loading) return <p className="text-sm text-slate-500">Loading activity…</p>;
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
        <History className="mx-auto text-slate-400" size={28} />
        <p className="mt-3 text-sm font-semibold text-slate-700">No activity recorded</p>
      </div>
    );
  }

  return (
    <ol className="relative ml-2 border-l border-slate-200 pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative pb-6 last:pb-0">
          <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600 ring-2 ring-blue-100" />
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-bold text-slate-900">{item.title || "Lead updated"}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.description || "—"}</p>
              <p className="mt-2 text-xs text-slate-400">by {item.createdByName || "GrowVest user"}</p>
            </div>
            <time className="shrink-0 text-xs font-medium text-slate-500">{formatDateTime(item.createdAt)}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
