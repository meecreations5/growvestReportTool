const styles = {
  "NEW": "bg-blue-50 text-blue-700 ring-blue-200",
  "CONTACTED": "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "QUALIFIED": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "WARM": "bg-amber-50 text-amber-700 ring-amber-200",
  "NOT QUALIFIED": "bg-slate-100 text-slate-600 ring-slate-200",
  "IN PROPOSAL": "bg-violet-50 text-violet-700 ring-violet-200",
  "COMMITTED — PENDING": "bg-orange-50 text-orange-700 ring-orange-200",
  "CONVERTED": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "LONG FOLLOW-UP": "bg-yellow-50 text-yellow-800 ring-yellow-200",
  "DROPPED": "bg-slate-200 text-slate-700 ring-slate-300",
  "LAPSE — CLIENT SIDE": "bg-yellow-100 text-yellow-800 ring-yellow-200",
  "LAPSE — COMPANY SIDE": "bg-red-100 text-red-800 ring-red-200",
  "RECOVERED": "bg-green-100 text-green-800 ring-green-200"
};

export default function StatusBadge({ status }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${styles[status] || "bg-slate-100 text-slate-700 ring-slate-200"}`}>{status || "—"}</span>;
}
