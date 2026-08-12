import { ACTION_STATUS_TONES } from "@/lib/constants/actions";

const toneClasses = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600"
};

export default function ActionStatusBadge({ status = "Requested" }) {
  const tone = ACTION_STATUS_TONES[status] || "slate";
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-bold ${toneClasses[tone]}`}>{status}</span>;
}
