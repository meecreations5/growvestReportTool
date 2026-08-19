"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  MoreHorizontal,
  Plus,
  Search
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import MetricCard from "@/components/ui/MetricCard";
import EmptyState from "@/components/ui/EmptyState";
import { inputClassName } from "@/components/ui/Field";
import DataImportWizard from "@/components/data-imports/DataImportWizard";
import { archiveDataImport, subscribeDataImports } from "@/services/dataImportService";
import {
  DATA_IMPORT_STATUS,
  DATA_IMPORT_STATUS_LABELS
} from "@/lib/constants/dataImport";
import { downloadSampleImportCsv } from "@/lib/utils/dataImport";
import { formatCurrency } from "@/lib/utils/format";
import { getMonthLabel } from "@/lib/constants/report";

function formatDateTime(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function ImportStatusBadge({ status }) {
  const styles = {
    [DATA_IMPORT_STATUS.READY]: "bg-blue-50 text-blue-700 ring-blue-200",
    [DATA_IMPORT_STATUS.IMPORTED]: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    [DATA_IMPORT_STATUS.FAILED]: "bg-red-50 text-red-700 ring-red-200",
    [DATA_IMPORT_STATUS.ARCHIVED]: "bg-slate-100 text-slate-600 ring-slate-200"
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${styles[status] || styles[DATA_IMPORT_STATUS.READY]}`}>{DATA_IMPORT_STATUS_LABELS[status] || status}</span>;
}

export default function DataImportCentre() {
  const { profile } = useAuth();
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!profile?.id) return undefined;
    setLoading(true);
    return subscribeDataImports(
      profile,
      (items) => {
        setImports(items);
        setLoading(false);
      },
      (nextError) => {
        console.error(nextError);
        setError("Unable to load import history.");
        setLoading(false);
      }
    );
  }, [profile]);

  const visibleImports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return imports.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!query) return true;
      return [item.investorName, item.clientCode, item.fileName, item.reportMonthKey, item.sourceLabel]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [imports, search, status]);

  const metrics = useMemo(() => ({
    total: imports.filter((item) => item.status !== DATA_IMPORT_STATUS.ARCHIVED).length,
    ready: imports.filter((item) => item.status === DATA_IMPORT_STATUS.READY).length,
    imported: imports.filter((item) => item.status === DATA_IMPORT_STATUS.IMPORTED).length,
    issues: imports.filter((item) => Number(item.validationSummary?.warning || 0) > 0 || item.status === DATA_IMPORT_STATUS.FAILED).length
  }), [imports]);

  async function handleArchive(importId) {
    setBusyId(importId);
    setError("");
    try {
      await archiveDataImport(importId, profile);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to archive this import.");
    } finally {
      setBusyId("");
    }
  }

  if (wizardOpen) {
    return <DataImportWizard onClose={() => setWizardOpen(false)} onSaved={() => {}} />;
  }

  return (
    <div className="grid gap-6 pb-24 lg:pb-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Portfolio Management</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Bulk Data Upload</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Upload monthly CSV or Excel data, map columns, resolve validation issues and use the verified values inside an Investor report.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={downloadSampleImportCsv}><Download size={17} /> Download Sample</Button>
          <Button type="button" onClick={() => setWizardOpen(true)}><Plus size={17} /> New Bulk Upload</Button>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Import Batches" value={metrics.total} helper="Active import records" icon={Database} tone="blue" />
        <MetricCard label="Ready for Report" value={metrics.ready} helper="Validated and not yet applied" icon={FileUp} tone="cyan" />
        <MetricCard label="Used in Reports" value={metrics.imported} helper="Linked to monthly reports" icon={CheckCircle2} tone="green" />
        <MetricCard label="Need Attention" value={metrics.issues} helper="Warnings or validation failures" icon={AlertTriangle} tone="amber" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-950">Import history</h2>
            <p className="mt-1 text-xs text-slate-500">Audit-ready file, validation and report-linking history.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input className={`${inputClassName} min-h-11 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search investor or file" />
            </label>
            <select className={`${inputClassName} min-h-11 sm:w-48`} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value={DATA_IMPORT_STATUS.READY}>Ready for report</option>
              <option value={DATA_IMPORT_STATUS.IMPORTED}>Used in report</option>
              <option value={DATA_IMPORT_STATUS.FAILED}>Validation failed</option>
              <option value={DATA_IMPORT_STATUS.ARCHIVED}>Archived</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-56 place-items-center text-sm text-slate-500"><Loader2 className="mb-3 animate-spin text-blue-700" size={26} /> Loading import history…</div>
        ) : !visibleImports.length ? (
          <div className="p-6">
            <EmptyState
              icon={FileSpreadsheet}
              title={imports.length ? "No imports match the selected filters" : "No portfolio imports yet"}
              description={imports.length ? "Clear the search or change the status filter." : "Upload the first monthly CSV or Excel file to reduce manual report entry."}
              action={!imports.length ? <Button type="button" onClick={() => setWizardOpen(true)}><Plus size={17} /> Start First Import</Button> : null}
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Investor</th>
                    <th className="px-4 py-3">Reporting Period</th>
                    <th className="px-4 py-3">Source File</th>
                    <th className="px-4 py-3">Rows</th>
                    <th className="px-4 py-3">Portfolio Value</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Imported</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleImports.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4"><p className="font-bold text-slate-950">{item.investorName}</p><p className="mt-1 text-xs text-slate-500">{item.clientCode || "—"}</p></td>
                      <td className="px-4 py-4 font-semibold text-slate-700">{getMonthLabel(item.reportMonth)} {item.reportYear}</td>
                      <td className="max-w-64 px-4 py-4"><p className="truncate font-semibold text-slate-700">{item.fileName}</p><p className="mt-1 truncate text-xs text-slate-500">{item.sourceLabel}</p></td>
                      <td className="px-4 py-4 text-slate-600">{item.reportPayload?.sourceRowCount || item.validationSummary?.valid || 0}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">{formatCurrency(item.reportPayload?.summary?.totalCorpus || 0)}</td>
                      <td className="px-4 py-4"><ImportStatusBadge status={item.status} /></td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatDateTime(item.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {item.status === DATA_IMPORT_STATUS.READY ? <Link href={item.targetReportId ? `/reports/${item.targetReportId}/edit?importId=${item.id}&step=portfolio-data` : `/reports/create?importId=${item.id}`} className="inline-flex min-h-9 items-center rounded-lg bg-blue-700 px-3 text-xs font-bold text-white hover:bg-blue-800">Use in Report</Link> : null}
                          {item.importedReportId ? <Link href={`/reports/${item.importedReportId}`} className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Open Report</Link> : null}
                          {item.status !== DATA_IMPORT_STATUS.ARCHIVED ? <button type="button" disabled={busyId === item.id} onClick={() => handleArchive(item.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Archive import">{busyId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}</button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {visibleImports.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-bold text-slate-950">{item.investorName}</p><p className="mt-1 text-xs text-slate-500">{item.clientCode || "—"} · {getMonthLabel(item.reportMonth)} {item.reportYear}</p></div>
                    <ImportStatusBadge status={item.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                    <div><p className="text-slate-400">Portfolio Value</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(item.reportPayload?.summary?.totalCorpus || 0)}</p></div>
                    <div><p className="text-slate-400">Rows</p><p className="mt-1 font-bold text-slate-900">{item.reportPayload?.sourceRowCount || 0}</p></div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {item.status === DATA_IMPORT_STATUS.READY ? <Link href={item.targetReportId ? `/reports/${item.targetReportId}/edit?importId=${item.id}&step=portfolio-data` : `/reports/create?importId=${item.id}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-blue-700 px-3 text-sm font-bold text-white">Use in Report</Link> : null}
                    {item.importedReportId ? <Link href={`/reports/${item.importedReportId}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700">Open Report</Link> : null}
                    <button type="button" onClick={() => handleArchive(item.id)} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 text-slate-500"><MoreHorizontal size={17} /></button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 lg:hidden">
        <Button type="button" className="w-full" size="lg" onClick={() => setWizardOpen(true)}><Plus size={18} /> New Bulk Upload</Button>
      </div>
    </div>
  );
}
