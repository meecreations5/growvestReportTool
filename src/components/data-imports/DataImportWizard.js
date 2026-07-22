"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, inputClassName } from "@/components/ui/Field";
import { subscribeInvestors } from "@/services/assessmentService";
import { createDataImport } from "@/services/dataImportService";
import { getMonthlyReport } from "@/services/reportService";
import {
  DATA_IMPORT_ACCEPT,
  DATA_IMPORT_FIELDS,
  DATA_IMPORT_MAX_FILE_SIZE,
  DATA_IMPORT_STATUS,
  MONTH_OPTIONS
} from "@/lib/constants/dataImport";
import { getReportMonthKey } from "@/lib/constants/report";
import {
  autoMapImportHeaders,
  buildReportImportPayload,
  downloadImportErrorCsv,
  downloadSampleImportCsv,
  mapRawRows,
  parseImportFile,
  summariseValidation,
  validateImportRows
} from "@/lib/utils/dataImport";
import { formatCurrency } from "@/lib/utils/format";

const STEPS = [
  { id: "upload", label: "Upload File", helper: "Investor, period and file" },
  { id: "mapping", label: "Map Columns", helper: "Match source data" },
  { id: "validate", label: "Validate Data", helper: "Run financial checks" },
  { id: "errors", label: "Review Errors", helper: "Correct or exclude rows" },
  { id: "confirm", label: "Confirm Import", helper: "Review totals" },
  { id: "report", label: "Use in Report", helper: "Open monthly report" }
];

function formatFileSize(bytes = 0) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StepStateIcon({ state, index }) {
  if (state === "complete") return <Check size={14} />;
  return <span>{index + 1}</span>;
}

function ValidationMetric({ label, value, tone }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700"
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold">{value}</p>
    </div>
  );
}

function IssueBadge({ issue }) {
  const warning = issue.severity === "warning";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${warning ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>
      {warning ? <AlertTriangle size={11} /> : <CircleAlert size={11} />}
      {issue.message}
    </span>
  );
}

function RowStatus({ row }) {
  if (row.excluded) return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">Excluded</span>;
  if (row.issues?.some((issue) => issue.severity === "error")) return <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">Failed</span>;
  if (row.issues?.some((issue) => issue.severity === "warning")) return <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Warning</span>;
  return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">Valid</span>;
}

export default function DataImportWizard({ onClose, onSaved }) {
  const router = useRouter();
  const { profile } = useAuth();
  const fileInputRef = useRef(null);
  const [activeStep, setActiveStep] = useState("upload");
  const [investors, setInvestors] = useState([]);
  const [investorSearch, setInvestorSearch] = useState("");
  const [context, setContext] = useState({
    investorId: "",
    reportMonth: new Date().getMonth() + 1,
    reportYear: new Date().getFullYear(),
    sourceLabel: "Monthly portfolio statement"
  });
  const [fileMeta, setFileMeta] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [rows, setRows] = useState([]);
  const [validationSummary, setValidationSummary] = useState({ total: 0, valid: 0, warning: 0, failed: 0, excluded: 0 });
  const [filter, setFilter] = useState("all");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedImportId, setSavedImportId] = useState("");
  const [existingReport, setExistingReport] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeInvestors(profile, setInvestors, (nextError) => {
      console.error(nextError);
      setError("Unable to load investors.");
    });
  }, [profile]);

  const selectedInvestor = useMemo(
    () => investors.find((item) => item.id === context.investorId) || null,
    [context.investorId, investors]
  );

  const filteredInvestors = useMemo(() => {
    const query = investorSearch.trim().toLowerCase();
    if (!query) return investors.slice(0, 8);
    return investors.filter((item) => [item.fullName, item.clientCode, item.email, item.contactNo, item.assignedAdvisorName]
      .some((value) => String(value || "").toLowerCase().includes(query))).slice(0, 12);
  }, [investorSearch, investors]);

  const activeStepIndex = STEPS.findIndex((step) => step.id === activeStep);
  const requiredMappingsComplete = DATA_IMPORT_FIELDS.filter((field) => field.required).every((field) => mapping[field.key]);
  const usableRows = rows.filter((row) => !row.excluded && !row.issues?.some((issue) => issue.severity === "error"));
  const reportPayload = useMemo(() => buildReportImportPayload(rows), [rows]);

  useEffect(() => {
    if (rows.length) setValidationSummary(summariseValidation(rows));
  }, [rows]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter === "all") return true;
    if (filter === "excluded") return row.excluded;
    if (filter === "failed") return !row.excluded && row.issues?.some((issue) => issue.severity === "error");
    if (filter === "warning") return !row.excluded && !row.issues?.some((issue) => issue.severity === "error") && row.issues?.some((issue) => issue.severity === "warning");
    if (filter === "valid") return !row.excluded && !row.issues?.length;
    return true;
  }), [filter, rows]);

  function setContextField(field, value) {
    setContext((current) => ({ ...current, [field]: ["reportMonth", "reportYear"].includes(field) ? Number(value) : value }));
  }

  async function handleFile(file) {
    setError("");
    setParsing(true);
    try {
      const parsed = await parseImportFile(file);
      setFileMeta({
        name: file.name,
        size: file.size,
        type: file.type || file.name.split(".").pop()?.toUpperCase(),
        sheetName: parsed.sheetName,
        truncated: parsed.truncated,
        totalRowsInFile: parsed.totalRowsInFile
      });
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMapping(autoMapImportHeaders(parsed.headers));
      setRows([]);
      setValidationSummary({ total: 0, valid: 0, warning: 0, failed: 0, excluded: 0 });
    } catch (nextError) {
      setError(nextError.message || "Unable to read the uploaded file.");
      setFileMeta(null);
      setHeaders([]);
      setRawRows([]);
    } finally {
      setParsing(false);
    }
  }

  function clearFile() {
    setFileMeta(null);
    setHeaders([]);
    setRawRows([]);
    setRows([]);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function canOpenStep(stepId) {
    const index = STEPS.findIndex((step) => step.id === stepId);
    if (index <= activeStepIndex) return true;
    if (stepId === "mapping") return Boolean(context.investorId && fileMeta && rawRows.length);
    if (stepId === "validate") return requiredMappingsComplete;
    if (stepId === "errors") return rows.length > 0;
    if (stepId === "confirm") return rows.length > 0 && validationSummary.failed === 0 && usableRows.length > 0;
    if (stepId === "report") return Boolean(savedImportId);
    return false;
  }

  function goToStep(stepId) {
    if (!canOpenStep(stepId)) return;
    setError("");
    setActiveStep(stepId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function continueStep() {
    setError("");

    if (activeStep === "upload") {
      if (!context.investorId) return setError("Select an investor before continuing.");
      if (!fileMeta || !rawRows.length) return setError("Upload a CSV or Excel file before continuing.");
      setActiveStep("mapping");
      return;
    }

    if (activeStep === "mapping") {
      if (!requiredMappingsComplete) return setError("Map Instrument, Asset Class and Closing / Current Value before continuing.");
      setActiveStep("validate");
      return;
    }

    if (activeStep === "validate") {
      const mapped = mapRawRows(rawRows, mapping);
      const result = validateImportRows(mapped);
      setRows(result.rows);
      setValidationSummary(result.summary);
      setActiveStep("errors");
      return;
    }

    if (activeStep === "errors") {
      const result = validateImportRows(rows);
      setRows(result.rows);
      setValidationSummary(result.summary);
      if (result.summary.failed > 0) {
        setError("Correct or exclude all failed rows before confirming the import.");
        return;
      }
      if (!result.summary.valid && !result.summary.warning) {
        setError("At least one valid row is required.");
        return;
      }
      setActiveStep("confirm");
      return;
    }

    if (activeStep === "confirm") {
      await saveImport();
    }
  }

  function goBack() {
    if (activeStepIndex <= 0) return;
    setError("");
    setActiveStep(STEPS[activeStepIndex - 1].id);
  }

  function updateRow(rowId, field, value) {
    setRows((current) => {
      const nextRows = current.map((row) => row.id === rowId ? {
        ...row,
        [field]: ["instrumentName", "assetClass", "notes"].includes(field) ? value : (value === "" ? 0 : Number(value))
      } : row);
      return validateImportRows(nextRows).rows;
    });
  }

  function toggleExcluded(rowId) {
    const result = validateImportRows(rows.map((row) => row.id === rowId ? { ...row, excluded: !row.excluded } : row));
    setRows(result.rows);
    setValidationSummary(result.summary);
  }

  function excludeFailedRows() {
    const result = validateImportRows(rows.map((row) => row.issues?.some((issue) => issue.severity === "error") ? { ...row, excluded: true } : row));
    setRows(result.rows);
    setValidationSummary(result.summary);
  }

  async function saveImport() {
    if (!selectedInvestor) return setError("The selected investor is no longer available.");
    setSaving(true);
    setError("");
    try {
      const reportMonthKey = getReportMonthKey(context.reportYear, context.reportMonth);
      const duplicate = await getMonthlyReport(`${selectedInvestor.id}_${reportMonthKey}`);
      const importId = await createDataImport({
        investorId: selectedInvestor.id,
        investorName: selectedInvestor.fullName,
        clientCode: selectedInvestor.clientCode,
        advisorUid: selectedInvestor.assignedAdvisorUid || selectedInvestor.advisorUid || profile.id,
        advisorName: selectedInvestor.assignedAdvisorName || selectedInvestor.advisorName || profile.fullName,
        reportMonth: context.reportMonth,
        reportYear: context.reportYear,
        reportMonthKey,
        sourceLabel: context.sourceLabel,
        fileName: fileMeta.name,
        fileSize: fileMeta.size,
        fileType: fileMeta.type,
        sheetName: fileMeta.sheetName,
        headers,
        mapping,
        rows,
        validationSummary,
        reportPayload,
        status: DATA_IMPORT_STATUS.READY,
        targetReportId: duplicate?.id || null
      }, profile);

      setExistingReport(duplicate);
      setSavedImportId(importId);
      setActiveStep("report");
      onSaved?.(importId);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to save the validated import.");
    } finally {
      setSaving(false);
    }
  }

  function openReport() {
    if (!savedImportId) return;
    if (existingReport?.id) {
      router.push(`/reports/${existingReport.id}/edit?importId=${savedImportId}&step=portfolio-data`);
      return;
    }
    router.push(`/reports/create?importId=${savedImportId}`);
  }

  const nextLabel = activeStep === "upload"
    ? "Continue to Column Mapping"
    : activeStep === "mapping"
      ? "Continue to Validation"
      : activeStep === "validate"
        ? "Run Validation"
        : activeStep === "errors"
          ? "Continue to Confirmation"
          : activeStep === "confirm"
            ? "Confirm Import"
            : "Open Monthly Report";

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-[#F5F7FB]">
      <div className="sticky top-20 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Close import wizard">
              <X size={19} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Data Import Centre</p>
              <h1 className="truncate font-heading text-xl font-bold text-slate-950 sm:text-2xl">Import monthly portfolio data</h1>
            </div>
          </div>
          <p className="hidden text-xs font-semibold text-slate-500 sm:block">Step {activeStepIndex + 1} of {STEPS.length}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-44 rounded-xl border border-slate-200 bg-white p-3">
            {STEPS.map((step, index) => {
              const current = step.id === activeStep;
              const complete = index < activeStepIndex || (step.id === "report" && savedImportId);
              const available = canOpenStep(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!available}
                  onClick={() => goToStep(step.id)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${current ? "bg-blue-50 text-blue-800" : available ? "text-slate-700 hover:bg-slate-50" : "cursor-not-allowed text-slate-300"}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${complete ? "bg-emerald-100 text-emerald-700" : current ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <StepStateIcon state={complete ? "complete" : "default"} index={index} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{step.label}</span>
                    <span className="mt-0.5 block text-xs leading-4 opacity-70">{step.helper}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 pb-28 lg:pb-6">
          <div className="mb-5 overflow-x-auto lg:hidden">
            <div className="flex min-w-max gap-2">
              {STEPS.map((step, index) => (
                <button key={step.id} type="button" disabled={!canOpenStep(step.id)} onClick={() => goToStep(step.id)} className={`rounded-full px-3 py-2 text-xs font-bold ${step.id === activeStep ? "bg-blue-700 text-white" : canOpenStep(step.id) ? "bg-white text-slate-700 ring-1 ring-slate-200" : "bg-slate-100 text-slate-300"}`}>
                  {index + 1}. {step.label}
                </button>
              ))}
            </div>
          </div>

          {error ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

          {activeStep === "upload" ? (
            <div className="grid gap-5">
              <Card className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileUp size={19} /></span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Step 1</p>
                    <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Select investor and upload file</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Choose the reporting context first, then upload the CSV or Excel statement containing holding-level monthly data.</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="xl:col-span-2">
                    <Field label="Investor" required hint="Search by investor name, client code, email or mobile number.">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input className={`${inputClassName} pl-10`} value={investorSearch} onChange={(event) => setInvestorSearch(event.target.value)} placeholder="Search investor" />
                      </div>
                    </Field>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredInvestors.map((investor) => {
                        const selected = investor.id === context.investorId;
                        return (
                          <button key={investor.id} type="button" onClick={() => setContextField("investorId", investor.id)} className={`rounded-xl border p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-950">{investor.fullName}</p>
                                <p className="mt-1 text-xs text-slate-500">{investor.clientCode || "Client code pending"}</p>
                              </div>
                              {selected ? <CheckCircle2 size={18} className="shrink-0 text-blue-700" /> : null}
                            </div>
                            <p className="mt-3 truncate text-xs text-slate-500">Advisor: {investor.assignedAdvisorName || investor.advisorName || "Not assigned"}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Reporting month" required>
                    <select className={inputClassName} value={context.reportMonth} onChange={(event) => setContextField("reportMonth", event.target.value)}>
                      {MONTH_OPTIONS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                    </select>
                  </Field>

                  <Field label="Report year" required>
                    <input type="number" min="2020" max="2100" className={inputClassName} value={context.reportYear} onChange={(event) => setContextField("reportYear", event.target.value)} />
                  </Field>

                  <Field label="Data source label" hint="This appears in the import history and audit record.">
                    <input className={inputClassName} value={context.sourceLabel} onChange={(event) => setContextField("sourceLabel", event.target.value)} />
                  </Field>

                  <div className="flex items-end">
                    <Button type="button" variant="secondary" className="w-full" onClick={downloadSampleImportCsv}><Download size={17} /> Download sample CSV</Button>
                  </div>
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <input ref={fileInputRef} type="file" accept={DATA_IMPORT_ACCEPT} className="sr-only" onChange={(event) => handleFile(event.target.files?.[0])} />
                {!fileMeta ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                    onDrop={(event) => { event.preventDefault(); setDragActive(false); handleFile(event.dataTransfer.files?.[0]); }}
                    className={`flex min-h-60 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition ${dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"}`}
                  >
                    {parsing ? <Loader2 className="animate-spin text-blue-700" size={34} /> : <UploadCloud className="text-blue-700" size={38} />}
                    <p className="mt-4 font-heading text-xl font-bold text-slate-950">{parsing ? "Reading your file…" : "Drop CSV or Excel file here"}</p>
                    <p className="mt-2 text-sm text-slate-500">or click to browse · CSV, XLSX or XLS · maximum {Math.round(DATA_IMPORT_MAX_FILE_SIZE / (1024 * 1024))} MB</p>
                  </button>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><FileSpreadsheet size={23} /></span>
                        <div>
                          <p className="font-bold text-slate-950">{fileMeta.name}</p>
                          <p className="mt-1 text-xs text-slate-600">{formatFileSize(fileMeta.size)} · {rawRows.length} rows · Sheet: {fileMeta.sheetName}</p>
                        </div>
                      </div>
                      <Button type="button" variant="secondary" onClick={clearFile}><Trash2 size={16} /> Replace file</Button>
                    </div>
                    {fileMeta.truncated ? <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">The file contains {fileMeta.totalRowsInFile} rows. Only the first 300 rows were loaded.</p> : null}
                  </div>
                )}
              </Card>
            </div>
          ) : null}

          {activeStep === "mapping" ? (
            <div className="grid gap-5">
              <Card className="p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Step 2</p>
                <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Map source columns</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Match each GrowVest report field with the correct column from the uploaded file. Required fields are marked.</p>
              </Card>
              <Card className="overflow-hidden">
                <div className="grid divide-y divide-slate-200">
                  {DATA_IMPORT_FIELDS.map((field) => (
                    <div key={field.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1.25fr] sm:items-center sm:px-6">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{field.label} {field.required ? <span className="text-red-600">*</span> : null}</p>
                        <p className="mt-1 text-xs text-slate-500">{field.required ? "Required for report integration" : "Optional field"}</p>
                      </div>
                      <select className={inputClassName} value={mapping[field.key] || ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}>
                        <option value="">Do not import</option>
                        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5 sm:p-6">
                <h3 className="font-heading text-lg font-bold text-slate-950">Source preview</h3>
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500"><tr>{headers.slice(0, 7).map((header) => <th key={header} className="whitespace-nowrap px-3 py-3 font-bold">{header}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">{rawRows.slice(0, 4).map((row, index) => <tr key={index}>{headers.slice(0, 7).map((header) => <td key={header} className="max-w-52 truncate px-3 py-3 text-slate-700">{String(row[header] ?? "")}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}

          {activeStep === "validate" ? (
            <Card className="p-6 sm:p-8">
              <div className="mx-auto max-w-2xl text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-700"><RefreshCcw size={29} /></span>
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Step 3</p>
                <h2 className="mt-2 font-heading text-3xl font-bold text-slate-950">Validate portfolio data</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">GrowVest will check required fields, numeric values, duplicates, negative balances, closing-value reconciliation and unusual returns.</p>
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-600">
                  <p className="font-bold text-slate-900">Ready to validate</p>
                  <p className="mt-2">{rawRows.length} rows · {headers.length} source columns · {DATA_IMPORT_FIELDS.filter((field) => mapping[field.key]).length} mapped fields</p>
                </div>
              </div>
            </Card>
          ) : null}

          {activeStep === "errors" ? (
            <div className="grid gap-5">
              <Card className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Step 4</p>
                    <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Review errors and warnings</h2>
                    <p className="mt-2 text-sm text-slate-500">Correct values inline or exclude rows that should not be imported.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(validationSummary.failed > 0 || validationSummary.warning > 0) ? <Button type="button" variant="secondary" onClick={() => downloadImportErrorCsv(rows)}><Download size={16} /> Download issue CSV</Button> : null}
                    {validationSummary.failed > 0 ? <Button type="button" variant="secondary" onClick={excludeFailedRows}><Trash2 size={16} /> Exclude all failed rows</Button> : null}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <ValidationMetric label="Total" value={validationSummary.total} tone="slate" />
                  <ValidationMetric label="Valid" value={validationSummary.valid} tone="green" />
                  <ValidationMetric label="Warnings" value={validationSummary.warning} tone="amber" />
                  <ValidationMetric label="Failed" value={validationSummary.failed} tone="red" />
                  <ValidationMetric label="Excluded" value={validationSummary.excluded} tone="slate" />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["all", "valid", "warning", "failed", "excluded"].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${filter === value ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{value}</button>)}
                </div>
              </Card>

              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
                <table className="min-w-[1280px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-3 font-bold">Row</th>
                      <th className="px-3 py-3 font-bold">Status</th>
                      <th className="px-3 py-3 font-bold">Instrument</th>
                      <th className="px-3 py-3 font-bold">Asset Class</th>
                      <th className="px-3 py-3 font-bold">Opening</th>
                      <th className="px-3 py-3 font-bold">Investment</th>
                      <th className="px-3 py-3 font-bold">Withdrawal</th>
                      <th className="px-3 py-3 font-bold">Profit / Loss</th>
                      <th className="px-3 py-3 font-bold">Current Value</th>
                      <th className="px-3 py-3 font-bold">Return %</th>
                      <th className="px-3 py-3 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((row) => (
                      <tr key={row.id} className={row.excluded ? "bg-slate-50 opacity-60" : "align-top"}>
                        <td className="px-3 py-3 font-bold text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-3"><RowStatus row={row} /></td>
                        <td className="px-3 py-3"><input disabled={row.excluded} className="min-h-10 w-52 rounded-lg border border-slate-200 px-2 text-xs" value={row.instrumentName || ""} onChange={(event) => updateRow(row.id, "instrumentName", event.target.value)} /></td>
                        <td className="px-3 py-3"><input disabled={row.excluded} className="min-h-10 w-28 rounded-lg border border-slate-200 px-2 text-xs" value={row.assetClass || ""} onChange={(event) => updateRow(row.id, "assetClass", event.target.value)} /></td>
                        {["openingValue", "investment", "withdrawal", "profitLoss", "currentValue", "returnPercentage"].map((field) => <td key={field} className="px-3 py-3"><input disabled={row.excluded} type="number" step="0.01" className="min-h-10 w-28 rounded-lg border border-slate-200 px-2 text-xs" value={row[field] ?? 0} onChange={(event) => updateRow(row.id, field, event.target.value)} /></td>)}
                        <td className="px-3 py-3"><Button type="button" size="sm" variant="quiet" onClick={() => toggleExcluded(row.id)}>{row.excluded ? "Include" : "Exclude"}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {visibleRows.map((row) => (
                  <Card key={row.id} className={`p-4 ${row.excluded ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">Source row {row.rowNumber}</p><div className="mt-2"><RowStatus row={row} /></div></div><Button type="button" size="sm" variant="quiet" onClick={() => toggleExcluded(row.id)}>{row.excluded ? "Include" : "Exclude"}</Button></div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Field label="Instrument"><input disabled={row.excluded} className={inputClassName} value={row.instrumentName || ""} onChange={(event) => updateRow(row.id, "instrumentName", event.target.value)} /></Field>
                      <Field label="Asset Class"><input disabled={row.excluded} className={inputClassName} value={row.assetClass || ""} onChange={(event) => updateRow(row.id, "assetClass", event.target.value)} /></Field>
                      <Field label="Current Value"><input disabled={row.excluded} type="number" className={inputClassName} value={row.currentValue ?? 0} onChange={(event) => updateRow(row.id, "currentValue", event.target.value)} /></Field>
                      <Field label="Profit / Loss"><input disabled={row.excluded} type="number" className={inputClassName} value={row.profitLoss ?? 0} onChange={(event) => updateRow(row.id, "profitLoss", event.target.value)} /></Field>
                    </div>
                    {row.issues?.length ? <div className="mt-4 flex flex-wrap gap-2">{row.issues.map((nextIssue, index) => <IssueBadge key={`${nextIssue.code}-${index}`} issue={nextIssue} />)}</div> : null}
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === "confirm" ? (
            <div className="grid gap-5">
              <Card className="p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Step 5</p>
                <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Confirm validated import</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Review the financial totals that will populate the monthly report. Imported values remain editable in Create Report.</p>
              </Card>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ValidationMetric label="Rows imported" value={usableRows.length} tone="green" />
                <ValidationMetric label="Closing portfolio" value={formatCurrency(reportPayload.summary.totalCorpus)} tone="slate" />
                <ValidationMetric label="New investment" value={formatCurrency(reportPayload.summary.newMoneyAdded)} tone="slate" />
                <ValidationMetric label="Profit / Loss" value={formatCurrency(reportPayload.summary.investmentGain)} tone={reportPayload.summary.investmentGain < 0 ? "red" : "green"} />
              </div>
              <Card className="p-5 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-slate-950">Import context</h3>
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Investor</dt><dd className="text-right font-bold text-slate-900">{selectedInvestor?.fullName}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Client code</dt><dd className="text-right font-bold text-slate-900">{selectedInvestor?.clientCode || "—"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Reporting period</dt><dd className="text-right font-bold text-slate-900">{MONTH_OPTIONS.find((month) => month.value === context.reportMonth)?.label} {context.reportYear}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Source file</dt><dd className="max-w-60 truncate text-right font-bold text-slate-900">{fileMeta?.name}</dd></div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-slate-950">Report mapping</h3>
                    <ul className="mt-4 grid gap-3 text-sm text-slate-600">
                      <li className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> Portfolio Summary and Current Corpus</li>
                      <li className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> Asset-Class Holdings and Allocation</li>
                      <li className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> Fund-wise Detailed Holdings</li>
                      <li className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> New Investment, Withdrawals and Gain / Loss</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {activeStep === "report" ? (
            <Card className="p-6 sm:p-10">
              <div className="mx-auto max-w-2xl text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={31} /></span>
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-700">Import ready</p>
                <h2 className="mt-2 font-heading text-3xl font-bold text-slate-950">Portfolio data is ready for the report</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">{usableRows.length} validated holdings will be applied to {selectedInvestor?.fullName}&apos;s {MONTH_OPTIONS.find((month) => month.value === context.reportMonth)?.label} {context.reportYear} monthly report.</p>
                {existingReport ? (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                    <p className="font-bold text-amber-900">A monthly report already exists</p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">The imported values will be applied to the existing report draft. Review the existing commentary and goals before saving.</p>
                  </div>
                ) : null}
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button type="button" size="lg" onClick={openReport}><ArrowRight size={18} /> {existingReport ? "Apply to Existing Report" : "Create Monthly Report"}</Button>
                  <Button type="button" size="lg" variant="secondary" onClick={onClose}>Return to Import History</Button>
                </div>
              </div>
            </Card>
          ) : null}
        </main>
      </div>

      {activeStep !== "report" ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl lg:left-[var(--gv-sidebar-width)]">
          <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3">
            <Button type="button" variant="secondary" onClick={goBack} disabled={activeStepIndex === 0 || saving}><ArrowLeft size={17} /> Back</Button>
            <Button type="button" onClick={continueStep} disabled={saving || parsing || (activeStep === "confirm" && validationSummary.failed > 0)}>
              {saving ? <Loader2 size={17} className="animate-spin" /> : null}
              {saving ? "Saving import…" : nextLabel}
              {!saving && activeStep !== "confirm" ? <ArrowRight size={17} /> : null}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
