"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  Copy,
  FileBarChart,
  FileCheck2,
  Plus,
  Search,
  Send,
  WalletCards
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeMonthlyReports } from "@/services/reportService";
import { getMonthLabel } from "@/lib/constants/report";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { inputClassName } from "@/components/ui/Field";
import ReportStatusBadge from "@/components/reports/ReportStatusBadge";
import MetricCard from "@/components/ui/MetricCard";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import EmptyState from "@/components/ui/EmptyState";

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsTable() {
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [year, setYear] = useState("ALL");

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeMonthlyReports(
      profile,
      (items) => {
        setReports(items);
        setLoading(false);
      },
      (nextError) => {
        console.error(nextError);
        setError("Unable to load monthly reports. Deploy the included Firestore indexes if Firebase requests one.");
        setLoading(false);
      }
    );
  }, [profile]);

  const years = useMemo(
    () => [...new Set(reports.map((item) => Number(item.reportYear)).filter(Boolean))].sort((a, b) => b - a),
    [reports]
  );

  const summary = useMemo(() => {
    const monthKey = currentMonthKey();
    return {
      total: reports.length,
      draft: reports.filter((item) => item.status === "draft").length,
      completed: reports.filter((item) => item.status === "completed").length,
      published: reports.filter((item) => item.investorVisible).length,
      currentMonth: reports.filter((item) => item.reportMonthKey === monthKey).length,
      corpus: reports
        .filter((item) => item.status === "completed")
        .reduce((sum, item) => sum + Number(item.summary?.totalCorpus || 0), 0)
    };
  }, [reports]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesSearch = !term || [report.investorName, report.clientCode, report.reportCode, report.title, report.advisorName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = status === "ALL"
        || (status === "published" ? Boolean(report.investorVisible) : report.status === status);
      const matchesYear = year === "ALL" || Number(report.reportYear) === Number(year);
      return matchesSearch && matchesStatus && matchesYear;
    });
  }, [reports, search, status, year]);

  const tabs = [
    { value: "ALL", label: "All", count: reports.length },
    { value: "draft", label: "Draft", count: summary.draft },
    { value: "completed", label: "Completed", count: summary.completed },
    { value: "published", label: "Published", count: summary.published }
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="gv-eyebrow">Portfolio reporting</p>
          <h1 className="gv-page-title mt-2">Monthly portfolio reports</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Prepare, review, publish and track every Investor report from one operational workspace.
          </p>
        </div>
        <Link href="/reports/create" className="gv-button-primary inline-flex min-h-12 items-center justify-center gap-2 px-5">
          <Plus size={18} /> Create monthly report
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Reports" value={summary.total} helper={`${summary.currentMonth} prepared this month`} icon={FileBarChart} tone="blue" />
        <MetricCard label="Draft reports" value={summary.draft} helper="Still require completion" icon={CalendarClock} tone={summary.draft ? "amber" : "slate"} />
        <MetricCard label="Completed" value={summary.completed} helper={`${summary.published} published to Investors`} icon={FileCheck2} tone="green" />
        <MetricCard label="Reported corpus" value={formatCurrency(summary.corpus)} helper="Across completed reports" icon={WalletCards} tone="cyan" />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
      ) : null}

      <section className="gv-card overflow-hidden">
        <div className="grid gap-4 border-b border-[var(--gv-border)] p-4 lg:p-5 xl:grid-cols-[minmax(0,1fr)_auto_150px] xl:items-center">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClassName} pl-10`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Investor, client code, report or Advisor"
            />
          </div>
          <SegmentedTabs items={tabs} value={status} onChange={setStatus} ariaLabel="Report status" />
          <select className={inputClassName} value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="ALL">All years</option>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading monthly reports…</div>
        ) : filtered.length ? (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {filtered.map((report) => (
                <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-heading text-lg font-bold text-[var(--gv-ink)]">{getMonthLabel(report.reportMonth)} {report.reportYear}</p>
                      <p className="mt-1 text-xs text-slate-500">{report.reportCode || report.id}</p>
                    </div>
                    <ReportStatusBadge status={report.status} />
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <p className="font-semibold text-slate-950">{report.investorName}</p>
                    <p className="mt-1 text-xs text-slate-500">{report.clientCode} · {report.advisorName || "Advisor not assigned"}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Portfolio value</p>
                      <p className="mt-1 font-bold text-slate-950">{formatCurrency(report.summary?.totalCorpus)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Statement date</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDate(report.statementDate)}</p>
                    </div>
                  </div>

                  {report.investorVisible ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                      <Send size={13} /> Published to Investor
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)] gap-2">
                    <Link
                      href={`/reports/create?investorId=${report.investorId}&copyFrom=${report.id}`}
                      aria-label={`Copy ${report.title || "report"}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
                    >
                      <Copy size={16} />
                    </Link>
                    <Link href={`/reports/${report.id}`} className="gv-button-primary inline-flex min-h-11 items-center justify-center gap-2">
                      Open report <ChevronRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-bold">Report</th>
                    <th className="px-5 py-3 font-bold">Investor</th>
                    <th className="px-5 py-3 font-bold">Advisor</th>
                    <th className="px-5 py-3 text-right font-bold">Corpus</th>
                    <th className="px-5 py-3 font-bold">Statement date</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((report) => (
                    <tr key={report.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <Link href={`/reports/${report.id}`} className="group block">
                          <p className="font-bold text-slate-950 group-hover:text-blue-700">{getMonthLabel(report.reportMonth)} {report.reportYear}</p>
                          <p className="mt-1 text-xs text-slate-500">{report.reportCode || report.id}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-4"><p className="font-bold text-slate-900">{report.investorName}</p><p className="mt-1 text-xs text-slate-500">{report.clientCode}</p></td>
                      <td className="px-5 py-4 text-slate-700">{report.advisorName || "—"}</td>
                      <td className="px-5 py-4 text-right font-black text-slate-950">{formatCurrency(report.summary?.totalCorpus)}</td>
                      <td className="px-5 py-4 text-slate-700">{formatDate(report.statementDate)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <ReportStatusBadge status={report.status} />
                          {report.investorVisible ? <span className="text-[11px] font-bold text-emerald-600">Published v{report.publishedVersion || 1}</span> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link href={`/reports/create?investorId=${report.investorId}&copyFrom=${report.id}`} title="Copy report" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Copy size={16} /></Link>
                          <Link href={`/reports/${report.id}`} aria-label={`Open ${report.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><ChevronRight size={17} /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-6">
            <EmptyState
              icon={FileBarChart}
              title="No reports found"
              description="Create the first monthly report or change the current search and filters."
              action={<Link href="/reports/create" className="gv-button-primary inline-flex min-h-11 items-center gap-2 px-4"><Plus size={16} /> Create report</Link>}
            />
          </div>
        )}

        <div className="border-t border-slate-200 px-5 py-3 text-xs font-medium text-slate-500">Showing {filtered.length} of {reports.length} reports</div>
      </section>
    </div>
  );
}
