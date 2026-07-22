export default function UserStatusBadge({ status, invitationStatus }) {
  if (invitationStatus && invitationStatus !== "linked") {
    const styles = invitationStatus === "pending"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-slate-100 text-slate-600 ring-slate-200";
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${styles}`}>{invitationStatus}</span>;
  }

  const active = status === "active";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>
      {status || "unknown"}
    </span>
  );
}
