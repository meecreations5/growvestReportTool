import { Archive, CheckCircle2, CircleDashed, Crown, CirclePause } from "lucide-react";

const statusConfig = {
  active: { label: "Active", tone: "bg-emerald-50 text-emerald-700 ring-emerald-100", icon: CheckCircle2 },
  draft: { label: "Draft", tone: "bg-amber-50 text-amber-800 ring-amber-100", icon: CircleDashed },
  inactive: { label: "Inactive", tone: "bg-slate-100 text-slate-700 ring-slate-200", icon: CirclePause },
  archived: { label: "Archived", tone: "bg-slate-100 text-slate-500 ring-slate-200", icon: Archive }
};

export default function TemplateStatusBadge({ status = "active", isDefault = false }) {
  if (isDefault) {
    return (
      <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
        <Crown size={12} aria-hidden="true" /> Default
      </span>
    );
  }

  const config = statusConfig[status] || statusConfig.inactive;
  const Icon = config.icon;
  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${config.tone}`}>
      <Icon size={12} aria-hidden="true" /> {config.label}
    </span>
  );
}
