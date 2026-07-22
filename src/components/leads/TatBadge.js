import { AlertTriangle, CheckCircle2, Clock3, MinusCircle } from "lucide-react";

const styles = {
  breached: {
    className: "bg-red-50 text-red-700 ring-red-200",
    Icon: AlertTriangle,
    label: "TAT breached"
  },
  on_track: {
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Icon: Clock3,
    label: "On track"
  },
  complete: {
    className: "bg-blue-50 text-blue-700 ring-blue-200",
    Icon: CheckCircle2,
    label: "Completed"
  },
  not_set: {
    className: "bg-slate-100 text-slate-600 ring-slate-200",
    Icon: MinusCircle,
    label: "Deadline not set"
  },
  not_applicable: {
    className: "bg-slate-100 text-slate-600 ring-slate-200",
    Icon: MinusCircle,
    label: "Not applicable"
  }
};

export default function TatBadge({ state, label }) {
  const selected = styles[state] || styles.not_set;
  const Icon = selected.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${selected.className}`}>
      <Icon size={13} />
      {label || selected.label}
    </span>
  );
}
