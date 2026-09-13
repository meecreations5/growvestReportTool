"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  LockKeyhole,
  Save,
  ShieldCheck,
  Target,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils/format";
import { getMonthLabel } from "@/lib/constants/report";
import { ReportOutputGuide } from "@/components/reports/create/ReportWorkflowGuidance";

function stepStateClasses(step, active) {
  if (active) return "border-blue-200 bg-blue-50 text-blue-800";
  if (step.complete) return "border-emerald-100 bg-emerald-50/70 text-emerald-800";
  if (step.locked) return "border-transparent bg-transparent text-slate-400";
  return "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white";
}

const REPORT_HOW_TO_USE_STEPS = [
  ["1", "Select Investor", "Choose the investor. Profile details, assigned Conscious Wealth Partner, goals and available portfolio context are inherited automatically."],
  ["2", "Reporting Period", "Confirm the Opening baseline date or select the Monthly Wealth Review period. Check duplicate and baseline warnings before continuing."],
  ["3", "Portfolio Data", "Confirm the verified Portfolio Master snapshot, holdings, transactions and headline portfolio values for the reporting cutoff."],
  ["4", "Review Calculations", "Resolve reconciliation differences before approval. Calculated percentages and performance checks are read-only."],
  ["5", "Commentary", "Add the investor-facing Wealth Review narrative, progress highlight, priority attention and portfolio opportunity."],
  ["6", "Goals & Allocation", "Review Bucket List progress, General Wealth assignments and current-versus-target allocation."],
  ["7", "Template", "Select the report template. The selected template version is saved as a snapshot so future template changes do not alter this report."],
  ["8", "Preview & Approval", "Review investor-visible actions, compliance text and all completion checks. Use Save & preview report before completing."],
  ["9", "Generate Secure PDF", "Complete the report first, then generate or regenerate the secure PDF. If the report changes later, regenerate the PDF before publishing."],
  ["10", "Deliver Report", "After the PDF is verified, publish the immutable version to the Investor Portal and send the investor communication."],
];

function ReportHowToUseDialog({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="report-how-to-use-title">
      <button type="button" className="absolute inset-0" aria-label="Close report instructions" onClick={onClose} />
      <section className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Monthly Reports</p>
            <h2 id="report-how-to-use-title" className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-950">How to use the report workflow</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Follow the workflow in order. The report stays editable as a working draft until completion; the secure PDF and published version should only be created after the preview has been reviewed.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Recommended sequence</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-blue-950">Create / Edit → Save & Preview → Complete Report → Generate / Regenerate PDF → Verify PDF → Publish → Send to Investor</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {REPORT_HOW_TO_USE_STEPS.map(([number, title, description]) => (
              <article key={number} className="flex gap-3 rounded-xl border border-slate-200 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-950 text-xs font-bold text-white">{number}</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Before completing</p>
              <p className="mt-2 text-xs leading-5 text-emerald-900">Check portfolio reconciliation, goal mapping, commentary, actions, disclaimer and the selected template.</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">If data changes</p>
              <p className="mt-2 text-xs leading-5 text-amber-900">Save the working report again. If a PDF already exists, it becomes stale and must be regenerated before delivery.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Published reports</p>
              <p className="mt-2 text-xs leading-5 text-slate-700">Published versions are immutable. Prepare and review a working revision, then publish it only after the new PDF is approved.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-right sm:px-6">
          <Button type="button" onClick={onClose}>Got it</Button>
        </div>
      </section>
    </div>
  );
}

function StepStateIcon({ step, active, number }) {
  if (step.complete) {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
        <Check size={16} strokeWidth={2.5} />
      </span>
    );
  }

  if (step.locked) {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
        <LockKeyhole size={14} />
      </span>
    );
  }

  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
      {number}
    </span>
  );
}

export function ReportWorkflowHeader({
  reportId,
  form,
  saveState,
  lastSavedAt,
  isLocked,
  copying,
  onCopyPrevious
}) {
  const [howToUseOpen, setHowToUseOpen] = useState(false);
  const investorName = form.investorName || "Investor not selected";
  const period = `${getMonthLabel(form.reportMonth)} ${form.reportYear}`;

  const saveLabel = saveState === "saving"
    ? "Autosaving…"
    : saveState === "dirty"
      ? "Autosave pending"
      : saveState === "error"
        ? "Autosave failed — use Save draft"
        : lastSavedAt
          ? "All changes saved"
          : reportId
            ? "Draft loaded"
            : "New report";

  return (
    <div className="grid gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <Link
          href={reportId ? `/reports/${reportId}` : "/reports"}
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
        >
          <ArrowLeft size={16} />
          Back to Monthly Reports
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {reportId ? "Edit Wealth Review" : "Create Wealth Review"}
          </h1>
          {isLocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              <LockKeyhole size={13} /> Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <Circle size={7} fill="currentColor" /> Draft
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{investorName}</span>
          <span aria-hidden="true">·</span>
          <span>{period}</span>
          <span aria-hidden="true">·</span>
          <span className={`inline-flex items-center gap-1.5 ${saveState === "error" ? "text-red-600" : saveState === "dirty" ? "text-amber-700" : "text-slate-500"}`}>
            <Clock3 size={14} /> {saveLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setHowToUseOpen(true)}
        >
          <CircleHelp size={15} />
          How to use
        </Button>
        {!reportId ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCopyPrevious}
            disabled={copying || !form.investorId || isLocked}
            className="hidden sm:inline-flex"
          >
            <FileText size={15} />
            {copying ? "Copying…" : "Copy previous"}
          </Button>
        ) : null}
      </div>

      <ReportHowToUseDialog open={howToUseOpen} onClose={() => setHowToUseOpen(false)} />
    </div>
  );
}

export function ReportProgressRail({ steps, activeStep, onSelect, progress }) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-24 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Report progress</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-950">Create report</p>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{progress}%</span>
          </div>
          <progress className="gv-progress mt-3 h-1.5 w-full overflow-hidden rounded-full" value={progress} max="100">{progress}%</progress>
        </div>

        <nav aria-label="Report creation steps" className="grid gap-1 p-2">
          {steps.map((step, index) => {
            const active = step.id === activeStep;
            return (
              <button
                key={step.id}
                type="button"
                disabled={step.locked}
                onClick={() => onSelect(step.id)}
                title={step.locked ? step.lockReason : undefined}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${stepStateClasses(step, active)} disabled:cursor-not-allowed`}
              >
                <StepStateIcon step={step} active={active} number={index + 1} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{step.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{step.helper}</span>
                </span>
                {!step.locked ? <ChevronRight size={15} className={active ? "text-blue-600" : "text-slate-300"} /> : null}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function MobileReportProgress({ steps, activeStep, onSelect, progress, open, onOpenChange }) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep));
  const current = steps[currentIndex];

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
          {currentIndex + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Step {currentIndex + 1} of {steps.length}</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-slate-950">{current?.label}</span>
        </span>
        <span className="text-xs font-bold text-slate-500">{progress}%</span>
        <ChevronDown size={18} className="text-slate-400" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Report steps">
          <div className="ml-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Report progress</p>
                <p className="mt-1 font-heading text-xl font-bold text-slate-950">Choose a step</p>
              </div>
              <button type="button" onClick={() => onOpenChange(false)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="grid flex-1 gap-1 overflow-y-auto p-3">
              {steps.map((step, index) => {
                const active = step.id === activeStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={step.locked}
                    onClick={() => {
                      onSelect(step.id);
                      onOpenChange(false);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left ${stepStateClasses(step, active)}`}
                  >
                    <StepStateIcon step={step} active={active} number={index + 1} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{step.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{step.helper}</span>
                      {step.locked && step.lockReason ? <span className="mt-1 block text-[11px] text-amber-700">{step.lockReason}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ReportStepShell({ number, title, description, eyebrow = "Create wealth review", children, aside }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-700 text-sm font-bold text-white">{number}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">{eyebrow}</p>
            <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className={aside ? "grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]" : "p-4 sm:p-6"}>
        <div className="min-w-0">{children}</div>
        {aside ? <div>{aside}</div> : null}
      </div>
    </section>
  );
}

export function ReportSummaryPanel({ form, progress, validationIssues = [], activeStep }) {
  const totalCorpus = Number(form.summary?.totalCorpus || 0);
  const portfolioValue = !form.investorId ? "—" : totalCorpus > 0 ? formatCurrency(totalCorpus) : "Not added";

  return (
    <aside className="hidden 2xl:block">
      <div className="sticky top-24 overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Report summary</p>
          <p className="mt-1 text-sm text-slate-500">A lightweight view of the current report.</p>
        </div>
        <dl className="grid gap-3 p-4">
          <SummaryItem icon={UserRound} label="Investor" value={form.investorName || "Not selected"} />
          <SummaryItem icon={FileText} label="Reporting period" value={`${getMonthLabel(form.reportMonth)} ${form.reportYear}`} />
          <SummaryItem icon={WalletCards} label="Portfolio value" value={portfolioValue} />
          <SummaryItem icon={Target} label="Goals" value={String(form.goals?.length || 0)} />
          <SummaryItem icon={FileCheck2} label="Holdings" value={String(form.funds?.length || 0)} />
        </dl>
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">Readiness</span>
            <span className="text-sm font-bold text-blue-700">{progress}%</span>
          </div>
          <progress className="gv-progress mt-2 h-1.5 w-full overflow-hidden rounded-full" value={progress} max="100">{progress}%</progress>
        </div>
        <div className="border-t border-slate-100 p-4">
          <ReportOutputGuide stepId={activeStep} compact />
          <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 ${validationIssues.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
            {validationIssues.length ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <ShieldCheck size={16} className="mt-0.5 shrink-0" />}
            <div>
              <p className="text-xs font-bold">{validationIssues.length ? `${validationIssues.length} validation issue${validationIssues.length === 1 ? "" : "s"}` : "No completion issues"}</p>
              <p className="mt-1 text-[11px] leading-4 opacity-80">{validationIssues.length ? "Complete report remains unavailable until these are resolved." : "Required completion checks currently pass."}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SummaryItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><Icon size={16} /></span>
      <div className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</dd>
      </div>
    </div>
  );
}

export function ReportWorkflowActions({
  stepIndex,
  totalSteps,
  canGoBack,
  canContinue,
  isLocked,
  saving,
  canSave,
  primaryLabel,
  onBack,
  onSave,
  onContinue
}) {
  return (
    <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_42px_rgba(15,23,42,0.14)] backdrop-blur sm:p-4">
      <div className="hidden min-w-0 sm:block">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Step {stepIndex + 1} of {totalSteps}</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">Complete the current step to continue.</p>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Button type="button" variant="secondary" onClick={onBack} disabled={!canGoBack || saving} className="flex-1 sm:flex-none">
          Back
        </Button>
        <Button type="button" variant="secondary" onClick={onSave} disabled={isLocked || !canSave || saving} className="flex-1 px-3 sm:flex-none sm:px-4">
          <Save size={16} />
          <span>{saving ? "Saving…" : "Save draft"}</span>
        </Button>
        <Button type="button" onClick={onContinue} disabled={!canContinue || isLocked || saving} className="flex-[1.4] sm:flex-none">
          {saving ? (
            "Saving…"
          ) : (
            <>
              <span className="sm:hidden">{primaryLabel.toLowerCase().startsWith("complete") ? "Complete report" : primaryLabel.toLowerCase().includes("issue") ? "Resolve issues" : "Continue"}</span>
              <span className="hidden sm:inline">{primaryLabel}</span>
            </>
          )}
          {!saving ? <ChevronRight size={17} /> : null}
        </Button>
      </div>
    </div>
  );
}

export function LockedFutureStep({ title, description, actionLabel, href }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center sm:p-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><LockKeyhole size={20} /></span>
      <h3 className="mt-4 font-heading text-xl font-bold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{description}</p>
      {href ? <Link href={href} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">{actionLabel}</Link> : null}
    </div>
  );
}
