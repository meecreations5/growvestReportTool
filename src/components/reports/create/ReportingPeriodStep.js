"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  FileText,
  LoaderCircle
} from "lucide-react";
import { Field, inputClassName } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { MONTH_OPTIONS, getMonthLabel } from "@/lib/constants/report";
import { formatCurrency, formatDate } from "@/lib/utils/format";

function financialYearLabel(month, year) {
  const numericMonth = Number(month);
  const numericYear = Number(year);
  const startYear = numericMonth >= 4 ? numericYear : numericYear - 1;
  return `FY ${startYear}–${String(startYear + 1).slice(-2)}`;
}

export default function ReportingPeriodStep({
  form,
  reportId,
  fieldErrors,
  previousReport,
  duplicateReport,
  lookupLoading,
  copying,
  onUpdatePeriod,
  onTopLevelChange,
  onCopyPrevious
}) {
  const periodLabel = `${getMonthLabel(form.reportMonth)} ${form.reportYear}`;

  return (
    <div className="grid gap-6">
      {duplicateReport ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><AlertTriangle size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-950">A report already exists for {periodLabel}</p>
              <p className="mt-1 text-sm leading-6 text-amber-800">Open the existing report instead of creating a duplicate for this investor and reporting month.</p>
              <Link href={`/reports/${duplicateReport.id}`} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-amber-900 px-3 text-sm font-semibold text-white">Open existing report</Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Reporting month" required>
          <select disabled={Boolean(reportId)} className={inputClassName} value={form.reportMonth} onChange={(event) => onUpdatePeriod("reportMonth", event.target.value)}>
            {MONTH_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Field>
        <Field label="Report year" required>
          <input disabled={Boolean(reportId)} type="number" min="2020" max="2100" className={inputClassName} value={form.reportYear} onChange={(event) => onUpdatePeriod("reportYear", event.target.value)} />
        </Field>
        <Field label="Financial year">
          <input readOnly className={`${inputClassName} bg-slate-50`} value={financialYearLabel(form.reportMonth, form.reportYear)} />
        </Field>
        <Field label="Statement date" required error={fieldErrors.statementDate}>
          <input type="date" className={inputClassName} value={form.statementDate || ""} onChange={(event) => onTopLevelChange("statementDate", event.target.value)} />
        </Field>
        <Field label="Report title" required error={fieldErrors.title}>
          <input className={inputClassName} value={form.title || ""} onChange={(event) => onTopLevelChange("title", event.target.value)} />
        </Field>
        <Field label="Data source">
          <input readOnly className={`${inputClassName} bg-slate-50`} value={form.sourceReportMonthKey ? `Copied from ${form.sourceReportMonthKey}` : "Manual entry"} />
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm"><CalendarDays size={18} /></span>
          <div>
            <p className="text-sm font-semibold text-slate-950">Reporting period</p>
            <p className="mt-1 text-sm text-slate-500">This report will cover {periodLabel}. The statement date is used across the HTML preview and generated PDF.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          <CheckCircle2 size={15} className="text-emerald-600" /> Period configured
        </span>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Previous monthly report</h3>
            <p className="mt-1 text-xs text-slate-500">Use the previous month as a starting point and update only the latest values.</p>
          </div>
          {lookupLoading ? <LoaderCircle size={18} className="animate-spin text-blue-600" /> : null}
        </div>
        {previousReport ? (
          <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><FileText size={18} /></span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{getMonthLabel(previousReport.reportMonth)} {previousReport.reportYear}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Closing value: {formatCurrency(previousReport.summary?.totalCorpus)}</span>
                  <span>Statement: {formatDate(previousReport.statementDate)}</span>
                  <span className="capitalize">Status: {previousReport.status || "draft"}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/reports/${previousReport.id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">View report</Link>
              {!reportId ? (
                <Button type="button" variant="secondary" size="sm" onClick={onCopyPrevious} disabled={copying}>
                  <Copy size={15} /> {copying ? "Copying…" : "Copy previous data"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-5 text-sm text-slate-500">{lookupLoading ? "Checking previous report history…" : "No earlier monthly report was found for this investor."}</div>
        )}
      </section>
    </div>
  );
}
