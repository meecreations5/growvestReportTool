"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FileBarChart, Plus } from "lucide-react";
import { subscribeInvestorReports } from "@/services/reportService";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { getMonthLabel } from "@/lib/constants/report";
import ReportStatusBadge from "@/components/reports/ReportStatusBadge";
import Card from "@/components/ui/Card";

export default function InvestorReportsPanel({ investorId }) {
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!investorId || !profile) return undefined;
    return subscribeInvestorReports(
      investorId,
      profile,
      setReports,
      (nextError) => {
        console.error(nextError);
        setError("Unable to load report history.");
      }
    );
  }, [investorId, profile]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Monthly reports</p><h2 className="mt-1 text-lg font-black text-slate-950">Report history</h2></div><Link href={`/reports/create?investorId=${investorId}`} className="inline-flex items-center gap-1 text-xs font-black text-blue-700 hover:underline"><Plus size={14} /> Create</Link></div>
      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-3">{reports.slice(0, 8).map((report) => <Link key={report.id} href={`/reports/${report.id}`} className="rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/40"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-950">{getMonthLabel(report.reportMonth)} {report.reportYear}</p><p className="mt-1 text-xs text-slate-500">{formatCurrency(report.summary?.totalCorpus)} · {formatDate(report.statementDate)}</p></div><ReportStatusBadge status={report.status} /></div></Link>)}{!reports.length ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500"><FileBarChart size={18} className="mb-2 text-blue-700" />No monthly reports created yet.</div> : null}</div>
    </Card>
  );
}
