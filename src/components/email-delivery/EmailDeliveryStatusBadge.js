import { DELIVERY_STATUS_LABELS, normaliseDeliveryStatus } from "@/lib/constants/emailDelivery";

const styles = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  not_ready: "bg-slate-100 text-slate-500 ring-slate-200",
  scheduled: "bg-violet-50 text-violet-700 ring-violet-200",
  queued: "bg-blue-50 text-blue-700 ring-blue-200",
  sending: "bg-blue-50 text-blue-700 ring-blue-200",
  sent: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  opened: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  clicked: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  bounced: "bg-red-50 text-red-700 ring-red-200",
  blocked: "bg-amber-50 text-amber-800 ring-amber-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  skipped: "bg-amber-50 text-amber-800 ring-amber-200"
};

export default function EmailDeliveryStatusBadge({ status }) {
  const normalised = status === "not_ready" ? "not_ready" : normaliseDeliveryStatus(status);
  const label = normalised === "not_ready" ? "Not Ready" : (DELIVERY_STATUS_LABELS[normalised] || normalised || "Pending");
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset ${styles[normalised] || styles.pending}`}>
      {label}
    </span>
  );
}
