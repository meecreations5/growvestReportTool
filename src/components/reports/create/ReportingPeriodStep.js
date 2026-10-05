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
import { REPORT_TYPE, getMonthLabel, getReportMonthKey } from "@/lib/constants/report";
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
  openingPeriodConflict,
  openingPublicationPending,
  lookupLoading,
  copying,
  onUpdatePeriod,
  onTopLevelChange,
  onCopyPrevious,
  periodLocked = false
}) {
  const periodLabel = `${getMonthLabel(form.reportMonth)} ${form.reportYear}`;
  const isOpeningReview = form.reportType === REPORT_TYPE.OPENING;

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

      {openingPeriodConflict ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><AlertTriangle size={17} /></span>
            <div>
              <p className="text-sm font-semibold text-amber-950">Monthly cutoff must be after the Opening baseline</p>
              <p className="mt-1 text-sm leading-6 text-amber-800">The Opening Wealth Review baseline is {openingPeriodConflict.statementDate || `${getMonthLabel(openingPeriodConflict.reportMonth)} ${openingPeriodConflict.reportYear}`}. A Monthly Wealth Review may use the same calendar month when its month-end cutoff is later than the Opening snapshot; otherwise choose the following month.</p>
            </div>
          </div>
        </div>
      ) : null}

      {openingPublicationPending ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-blue-700 ring-1 ring-blue-100"><FileText size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-950">Opening Wealth Review is not published yet</p>
              <p className="mt-1 text-sm leading-6 text-blue-800">You can prepare, complete and generate this Monthly Wealth Review now. Investor delivery remains locked until the Opening Wealth Review is published.</p>
              <Link href={`/reports/${openingPublicationPending.id}/edit`} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white">Open Opening Wealth Review</Link>
            </div>
          </div>
        </div>
      ) : null}

      {!reportId ? <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">{isOpeningReview ? <><strong>Opening Wealth Review:</strong> this is the investor&apos;s first GrowVest report. The latest verified Portfolio Master snapshot becomes the opening baseline. No previous-period return or movement is inferred.</> : <><strong>Monthly Wealth Review:</strong> GrowVest starts with the last completed calendar month. You can change the reporting month/year here before completing the report.</>}</div> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label={isOpeningReview ? "Opening baseline month" : "Reporting month"} required>
          <div className="grid gap-1.5">
            <input
              disabled={periodLocked || isOpeningReview}
              type="month"
              min="2020-01"
              max={getReportMonthKey(new Date().getFullYear(), new Date().getMonth() + 1)}
              className={inputClassName}
              value={getReportMonthKey(form.reportYear, form.reportMonth)}
              onChange={(event) => onUpdatePeriod("reportMonthKey", event.target.value)}
            />
            <span className="text-[11px] font-semibold text-blue-700">{isOpeningReview ? "Automatically uses the month containing the verified opening snapshot." : "Choose the month this report belongs to. Example: select August 2026 even when preparing it between 1–5 September."}</span>
          </div>
        </Field>
        <Field label="Report year">
          <input readOnly className={`${inputClassName} bg-slate-50`} value={form.reportYear || ""} />
        </Field>
        <Field label="Financial year">
          <input readOnly className={`${inputClassName} bg-slate-50`} value={financialYearLabel(form.reportMonth, form.reportYear)} />
        </Field>
        <Field label={isOpeningReview ? "Opening snapshot date" : "Portfolio cutoff date"} required error={fieldErrors.statementDate}>
          <div className="grid gap-1.5"><input readOnly type="date" className={`${inputClassName} border-emerald-200 bg-emerald-50/60 text-emerald-900`} value={form.statementDate || ""} /><span className="text-[11px] font-semibold text-emerald-700">{isOpeningReview ? "Automatic: date of the verified opening Portfolio Master snapshot" : "Automatic: month-end for a completed month, or today for the current month"}</span></div>
        </Field>
        <Field label="Report title" required error={fieldErrors.title}>
          <input className={inputClassName} value={form.title || ""} onChange={(event) => onTopLevelChange("title", event.target.value)} />
        </Field>
        <Field label="Data source">
          <input readOnly className={`${inputClassName} bg-slate-50`} value={form.sourcePortfolioSnapshotId || form.reportGenerationSource === "portfolio_master" ? "Verified Portfolio Master" : form.sourceReportMonthKey ? `Copied from ${form.sourceReportMonthKey}` : "Waiting for verified portfolio"} />
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm"><CalendarDays size={18} /></span>
          <div>
            <p className="text-sm font-semibold text-slate-950">{isOpeningReview ? "Opening baseline" : "Reporting period"}</p>
            <p className="mt-1 text-sm text-slate-500">{isOpeningReview ? `This review establishes the investor's GrowVest baseline as of ${form.statementDate || periodLabel}. Future Monthly Wealth Reviews will compare against verified historical snapshots.` : `This report will cover ${periodLabel}, even if it is prepared between the 1st and 5th of the next month. Portfolio values are taken only up to the automatic cutoff date.`}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          <CheckCircle2 size={15} className="text-emerald-600" /> {isOpeningReview ? "Baseline configured" : "Period configured"}
        </span>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Previous wealth review</h3>
            <p className="mt-1 text-xs text-slate-500">{isOpeningReview ? "No previous report is expected for an Opening Wealth Review." : "Use the previous month as a starting point and update only the latest values."}</p>
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
          <div className="p-5 text-sm text-slate-500">{lookupLoading ? "Checking previous report history…" : isOpeningReview ? "This will be the investor's first GrowVest wealth review." : "No earlier Monthly Wealth Review was found for this investor."}</div>
        )}
      </section>
    </div>
  );
}
