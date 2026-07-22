"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  FileCheck2,
  Mail,
  Send,
  Smartphone,
  UserCheck
} from "lucide-react";

function Step({ label, helper, complete, icon: Icon }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {complete ? <Check size={17} /> : Icon ? <Icon size={17} /> : <Circle size={13} />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-950">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{helper}</p>
      </div>
    </div>
  );
}

export default function ReportPublicationPanel({ report, acknowledgement }) {
  const [expanded, setExpanded] = useState(false);
  const completed = report.status === "completed" || report.status === "locked";
  const pdfReady = Boolean(report.pdfStoragePath);
  const published = Boolean(report.investorVisible);
  const emailSent = ["sent", "delivered", "opened", "clicked"].includes(
    String(report.lastEmailStatus || "").toLowerCase()
  );
  const acknowledged = Boolean(acknowledgement?.acknowledged);

  const completedCount = useMemo(
    () => [completed, pdfReady, published, emailSent, acknowledged].filter(Boolean).length,
    [completed, pdfReady, published, emailSent, acknowledged]
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left sm:px-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">
              Publication readiness
            </p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {completedCount} of 5 complete
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-700">
            {published
              ? `Published version ${report.publishedVersion || 1}`
              : completed
                ? "Report is ready for publishing"
                : "Complete the report before Investor delivery"}
          </p>
        </div>

        <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-500">
          {expanded ? "Hide details" : "View details"}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-blue-600 transition-[width] duration-300"
          style={{ width: `${(completedCount / 5) * 100}%` }}
        />
      </div>

      {expanded ? (
        <div className="grid gap-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-5 sm:p-5">
          <Step
            label="Complete report"
            helper="All required values and compliance text are present."
            complete={completed}
            icon={FileCheck2}
          />
          <Step
            label="Generate secure PDF"
            helper={pdfReady ? report.pdfFileName || "PDF stored securely" : "Generate and store the branded PDF."}
            complete={pdfReady}
            icon={Download}
          />
          <Step
            label="Publish to portal"
            helper={published ? "Visible in the Investor Portal." : "Create an immutable published version."}
            complete={published}
            icon={Smartphone}
          />
          <Step
            label="Send Investor email"
            helper={emailSent ? `Email status: ${report.lastEmailStatus}` : report.lastEmailStatus ? `Email status: ${report.lastEmailStatus}` : "Send the secure report notification."}
            complete={emailSent}
            icon={Mail}
          />
          <Step
            label="Investor acknowledgement"
            helper={acknowledged ? "Investor has acknowledged this report." : "Awaiting acknowledgement or discussion request."}
            complete={acknowledged}
            icon={UserCheck}
          />
        </div>
      ) : null}
    </section>
  );
}
