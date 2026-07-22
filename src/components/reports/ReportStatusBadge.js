import { REPORT_STATUS } from "@/lib/constants/report";

export default function ReportStatusBadge({ status }) {
  const styles = {
    [REPORT_STATUS.DRAFT]: "bg-amber-100 text-amber-800",
    [REPORT_STATUS.COMPLETED]: "bg-emerald-100 text-emerald-800",
    [REPORT_STATUS.LOCKED]: "bg-slate-200 text-slate-700"
  };
  const label = status === REPORT_STATUS.COMPLETED ? "Completed" : status === REPORT_STATUS.LOCKED ? "Locked" : "Draft";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${styles[status] || styles[REPORT_STATUS.DRAFT]}`}>{label}</span>;
}
