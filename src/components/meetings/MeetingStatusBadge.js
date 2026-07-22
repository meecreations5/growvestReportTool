const styles = {
  scheduled: "bg-blue-100 text-blue-800",
  rescheduled: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800"
};

export default function MeetingStatusBadge({ status }) {
  const label = String(status || "scheduled").replace(/_/g, " ");
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black capitalize ${styles[status] || "bg-slate-100 text-slate-700"}`}>{label}</span>;
}
