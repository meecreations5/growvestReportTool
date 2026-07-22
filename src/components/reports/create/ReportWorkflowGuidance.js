"use client";

import {
  Calculator,
  Database,
  Eye,
  FileOutput,
  PenLine,
  ShieldCheck
} from "lucide-react";

export const REPORT_OUTPUT_MAP = {
  investor: {
    title: "Investor identity and Advisor profile",
    description: "The selected profile supplies the investor identity used throughout the report.",
    sections: ["Report cover", "Investor details", "Advisor profile"],
    source: "Inherited from Investor Profile"
  },
  period: {
    title: "Reporting identity",
    description: "The period and statement date identify the report in HTML, PDF and delivery records.",
    sections: ["Report cover", "Report header", "PDF metadata"],
    source: "Entered by staff"
  },
  "portfolio-data": {
    title: "Portfolio values and holdings",
    description: "Headline values and fund records become the core financial content of the investor report.",
    sections: ["Executive summary", "Portfolio performance", "Detailed holdings"],
    source: "Entered by staff"
  },
  calculations: {
    title: "Calculated performance checks",
    description: "These figures verify that the entered corpus, asset classes and fund totals reconcile.",
    sections: ["Performance summary", "Portfolio charts", "Internal reconciliation"],
    source: "Calculated automatically"
  },
  commentary: {
    title: "Advisor insights",
    description: "The narrative explains progress, priorities and opportunities in investor-friendly language.",
    sections: ["Advisor insights", "Monthly commentary", "Highlights"],
    source: "Entered by staff"
  },
  goals: {
    title: "Goals and allocation",
    description: "Bucket List progress and allocation comparisons show how the portfolio supports life goals.",
    sections: ["Bucket List progress", "Portfolio allocation", "Goal-linked holdings"],
    source: "Profile data and staff updates"
  },
  template: {
    title: "Report presentation",
    description: "The selected template controls how all approved sections appear in responsive HTML and PDF.",
    sections: ["Report cover", "All report sections", "PDF header and footer"],
    source: "Managed by report template"
  },
  approval: {
    title: "Actions, compliance and approval",
    description: "Investor-visible actions and disclaimer text are published; validation notes remain internal.",
    sections: ["Recommended actions", "Review section", "Disclaimer"],
    source: "Investor-visible and internal content"
  },
  pdf: {
    title: "Secure PDF output",
    description: "The completed HTML report is rendered as the secure, branded investor document.",
    sections: ["Secure PDF", "Version history", "Download record"],
    source: "Generated automatically"
  },
  delivery: {
    title: "Investor delivery",
    description: "The approved report is published to the portal and delivered using the selected communication channel.",
    sections: ["Investor Portal", "Investor email", "Delivery history"],
    source: "Generated from approved report"
  }
};

export function ReportOutputGuide({ stepId, compact = false }) {
  const mapping = REPORT_OUTPUT_MAP[stepId];
  if (!mapping) return null;

  return (
    <div className={`rounded-xl border border-blue-100 bg-blue-50/60 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm">
          <FileOutput size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Where this appears in the report</p>
            <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-blue-700">{mapping.source}</span>
          </div>
          {!compact ? <p className="mt-1 text-sm leading-5 text-slate-600">{mapping.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {mapping.sections.map((section) => (
              <span key={section} className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                <Eye size={12} className="text-blue-600" /> {section}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ValueSourceLegend({ showInternal = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">Value source:</span>
      <SourceChip icon={PenLine} label="Entered by staff" className="border-blue-100 bg-blue-50 text-blue-700" />
      <SourceChip icon={Calculator} label="Calculated automatically" className="border-emerald-100 bg-emerald-50 text-emerald-700" />
      <SourceChip icon={Database} label="Inherited from profile" className="border-slate-200 bg-slate-50 text-slate-600" />
      {showInternal ? <SourceChip icon={ShieldCheck} label="Internal only" className="border-amber-100 bg-amber-50 text-amber-700" /> : null}
    </div>
  );
}

function SourceChip({ icon: Icon, label, className }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-semibold ${className}`}>
      <Icon size={12} /> {label}
    </span>
  );
}
