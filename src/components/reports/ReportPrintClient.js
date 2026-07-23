"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestorReports, subscribeMonthlyReport, subscribePublishedInvestorReports, subscribeReportVersion } from "@/services/reportService";
import MonthlyReportPrintDocument from "@/components/reports/MonthlyReportPrintDocument";

export default function ReportPrintClient({ reportId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const [reportMeta, setReportMeta] = useState(null);
  const [publishedVersion, setPublishedVersion] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!firebaseUser?.uid) {
      router.replace("/staff-login");
      return undefined;
    }
    return subscribeMonthlyReport(reportId, (item) => {
      setReportMeta(item);
      if (!item) setError("Monthly report was not found.");
      if (profile?.role !== "investor") setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError("You do not have access to this report.");
      setLoading(false);
    });
  }, [authLoading, firebaseUser?.uid, profile?.role, reportId, router]);

  useEffect(() => {
    if (profile?.role !== "investor" || !reportMeta?.activePublishedVersionId) return undefined;
    return subscribeReportVersion(reportMeta.activePublishedVersionId, (item) => {
      setPublishedVersion(item ? { ...item, id: reportId, versionId: item.id } : null);
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError("The published report version could not be loaded.");
      setLoading(false);
    });
  }, [profile?.role, reportId, reportMeta?.activePublishedVersionId]);

  const report = profile?.role === "investor" ? publishedVersion : reportMeta;

  useEffect(() => {
    if (!report?.investorId) return undefined;
    const subscribe = profile?.role === "investor" ? subscribePublishedInvestorReports : subscribeInvestorReports;
    return subscribe(report.investorId, setHistory, () => {});
  }, [profile?.role, report?.investorId]);

  useEffect(() => {
    if (!report || printed || searchParams.get("autoprint") !== "1") return;
    const timer = window.setTimeout(() => {
      setPrinted(true);
      window.print();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [printed, report, searchParams]);

  if (authLoading || loading) return <div className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">Preparing report…</div>;
  if (error || !report) return <div className="grid min-h-screen place-items-center bg-slate-100 p-6"><div className="rounded-2xl border border-red-200 bg-white p-8 text-center"><p className="font-bold text-red-700">{error || "Report could not be loaded."}</p><button onClick={() => router.back()} className="mt-4 text-sm font-bold text-blue-700">Go back</button></div></div>;

  const backHref = profile?.role === "investor" ? `/investor/reports/${reportId}` : `/reports/${reportId}`;

  return (
    <div>
      <div className="monthly-report-print-toolbar sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={() => router.push(backHref)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"><ArrowLeft size={16} /> Back to report</button>
        <div className="text-center"><p className="text-sm font-black text-slate-950">A4 Report Preview</p><p className="text-xs text-slate-400">{profile?.role === "investor" ? `Published version ${report.publishedVersion || 1}` : `Working version ${report.version || 1} · ${report.templateSnapshot?.name || "Report template"} v${report.templateVersion || report.templateSnapshot?.version || 1}`}</p></div>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white"><Printer size={16} /> Print</button>
      </div>
      <MonthlyReportPrintDocument report={report} history={history} />
    </div>
  );
}
