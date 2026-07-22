export default function KpiCard({ label, value, note, accent = "blue" }) {
  const accents = {
    blue: { bar: "bg-blue-600", text: "text-blue-700" },
    cyan: { bar: "bg-cyan-500", text: "text-cyan-700" },
    emerald: { bar: "bg-emerald-500", text: "text-emerald-700" },
    amber: { bar: "bg-amber-500", text: "text-amber-700" },
    red: { bar: "bg-red-500", text: "text-red-700" }
  };
  const theme = accents[accent] || accents.blue;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-5 h-2 w-12 rounded-full ${theme.bar}`} />
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className={`mt-3 text-xs font-semibold ${theme.text}`}>{note}</p>
    </div>
  );
}
