"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileUp,
  History,
  Layers3,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Settings2,
  UploadCloud,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestors } from "@/services/assessmentService";
import {
  commitPortfolioImport,
  previewPortfolioImport,
  subscribePortfolioImports
} from "@/services/portfolioService";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import PortfolioImportRecoveryDialog from "@/components/portfolio/PortfolioImportRecoveryDialog";
import GenericPortfolioMappingDialog from "@/components/portfolio/GenericPortfolioMappingDialog";
import DailyPortfolioCoveragePanel from "@/components/portfolio/DailyPortfolioCoveragePanel";
import { inputClassName } from "@/components/ui/Field";
import { formatCurrency } from "@/lib/utils/format";
import {
  PORTFOLIO_ADAPTER_STATUS,
  PORTFOLIO_MATCH_STATUS,
  PORTFOLIO_REPORT_LABELS,
  PORTFOLIO_REPORT_TYPES,
  PORTFOLIO_SOURCE_LABELS
} from "@/lib/constants/portfolio";

const ACCEPT = ".xls,.xlsx,.csv";

function dateTime(value) {
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

function sourceLabel(source) {
  return PORTFOLIO_SOURCE_LABELS[source] || "Portfolio Source";
}

function reportLabel(reportType) {
  return PORTFOLIO_REPORT_LABELS[reportType] || "Portfolio Report";
}

function fileState(item = {}) {
  if (item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.NEEDS_PACKAGE) {
    return ["Source package required", "bg-amber-50 text-amber-800 ring-amber-200", AlertTriangle];
  }
  if (item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.MAPPING_REQUIRED) {
    return ["Map columns", "bg-violet-50 text-violet-700 ring-violet-200", Layers3];
  }
  if (item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.DETECTED_NOT_ENABLED) {
    return ["Detected · adapter pending", "bg-violet-50 text-violet-700 ring-violet-200", Layers3];
  }
  if (item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.UNSUPPORTED || item.matchStatus === "unsupported") {
    return ["Needs attention", "bg-red-50 text-red-700 ring-red-200", CircleAlert];
  }
  const map = {
    [PORTFOLIO_MATCH_STATUS.VERIFIED]: ["Ready", "bg-emerald-50 text-emerald-700 ring-emerald-200", CheckCircle2],
    [PORTFOLIO_MATCH_STATUS.REVIEW]: ["Confirm investor", "bg-amber-50 text-amber-800 ring-amber-200", AlertTriangle],
    [PORTFOLIO_MATCH_STATUS.UNMATCHED]: ["Investor required", "bg-red-50 text-red-700 ring-red-200", CircleAlert],
    [PORTFOLIO_MATCH_STATUS.CONFLICT]: ["Ownership conflict", "bg-red-50 text-red-700 ring-red-200", CircleAlert],
    [PORTFOLIO_MATCH_STATUS.DUPLICATE]: ["Already imported", "bg-slate-100 text-slate-600 ring-slate-200", ShieldCheck],
    failed: ["File error", "bg-red-50 text-red-700 ring-red-200", CircleAlert]
  };
  return map[item.matchStatus] || ["Review", "bg-slate-100 text-slate-600 ring-slate-200", CircleAlert];
}

function FileStateBadge({ item }) {
  const [label, className, Icon] = fileState(item);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function isReadyAdapter(item = {}) {
  return item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.READY;
}

function needsInvestorChoice(item = {}) {
  return isReadyAdapter(item)
    && [PORTFOLIO_MATCH_STATUS.REVIEW, PORTFOLIO_MATCH_STATUS.UNMATCHED].includes(item.matchStatus);
}

function isIssue(item = {}, mapping = "") {
  if (!isReadyAdapter(item)) return true;
  if ([PORTFOLIO_MATCH_STATUS.CONFLICT, "failed"].includes(item.matchStatus)) return true;
  if (needsInvestorChoice(item) && !mapping) return true;
  return false;
}

function FileCard({ item, investors, mapping, onMappingChange, onOpenGenericMapping, onOpenRecovery }) {
  const requiresChoice = needsInvestorChoice(item);
  const suggestedIds = new Set((item.suggestions || []).map((candidate) => candidate.investorId));
  const orderedInvestors = [
    ...investors.filter((investor) => suggestedIds.has(investor.id)),
    ...investors.filter((investor) => !suggestedIds.has(investor.id))
  ];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="max-w-full truncate font-semibold text-slate-950">{item.fileName}</p>
            <FileStateBadge item={item} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span><strong className="text-slate-700">Source:</strong> {sourceLabel(item.source)}</span>
            <span><strong className="text-slate-700">Type:</strong> {reportLabel(item.reportType)}</span>
            {item.fileFormat ? <span><strong className="text-slate-700">Format:</strong> {item.fileFormat}</span> : null}
            {item.confidence ? <span><strong className="text-slate-700">Detection:</strong> {Math.round(Number(item.confidence) * 100)}%</span> : null}
          </div>
          {item.externalClientName || item.externalPan || item.externalClientCode ? (
            <p className="mt-2 text-xs text-slate-500">
              External investor: <strong className="text-slate-700">{item.externalClientName || "Identity detected"}</strong>
              {item.externalPan ? <> · PAN <strong className="text-slate-700">{item.externalPan}</strong></> : null}
              {item.externalClientCode ? <> · Client Code <strong className="text-slate-700">{item.externalClientCode}</strong></> : null}
            </p>
          ) : null}
          {item.warnings?.length ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">{item.warnings.slice(0, 2).join(" ")}</div> : null}
          {item.error ? <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">{item.error}</p> : null}
          {item.duplicateOfImportId ? <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-slate-600">Exact file content was imported earlier. Newer/different files for the same investor are still allowed.</p><button type="button" onClick={() => onOpenRecovery?.(item.duplicateOfImportId)} className="inline-flex min-h-8 items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"><History size={13} /> Manage previous import</button></div> : null}
        </div>

        {item.summary ? (
          item.reportType === PORTFOLIO_REPORT_TYPES.ULIP_PORTFOLIO ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[440px]">
              <div className="rounded-lg bg-violet-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-violet-600">Policies</p><p className="mt-1 font-bold text-violet-950">{item.summary.policyCount || item.policies?.length || 0}</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Funds</p><p className="mt-1 font-bold text-slate-900">{item.summary.positionCount || 0}</p></div>
              <div className="rounded-lg bg-blue-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Premium Paid</p><p className="mt-1 font-bold text-blue-950">{formatCurrency(item.summary.totalInvested)}</p></div>
              <div className="rounded-lg bg-emerald-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Fund Value</p><p className="mt-1 font-bold text-emerald-950">{formatCurrency(item.summary.currentValue)}</p></div>
            </div>
          ) : item.reportType === PORTFOLIO_REPORT_TYPES.BAJAJ_INTRADAY ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[440px]">
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Trades</p><p className="mt-1 font-bold text-slate-900">{item.summary.tradeCount || item.summary.transactionCount || 0}</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Turnover</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(item.summary.turnover)}</p></div>
              <div className="rounded-lg bg-amber-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-600">Charges</p><p className="mt-1 font-bold text-amber-950">{formatCurrency(item.summary.totalCharges)}</p></div>
              <div className="rounded-lg bg-blue-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-600">Net P&amp;L</p><p className="mt-1 font-bold text-blue-950">{formatCurrency(item.summary.netPnl)}</p></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[440px]">
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Holdings</p><p className="mt-1 font-bold text-slate-900">{item.summary.positionCount || 0}</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{item.summary.tradeCount ? "Trades" : "Transactions"}</p><p className="mt-1 font-bold text-slate-900">{item.summary.tradeCount || item.summary.transactionCount || 0}</p></div>
              <div className="rounded-lg bg-blue-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Invested</p><p className="mt-1 font-bold text-blue-950">{formatCurrency(item.summary.totalInvested)}</p></div>
              <div className="rounded-lg bg-emerald-50 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Current</p><p className="mt-1 font-bold text-emerald-950">{formatCurrency(item.summary.currentValue)}</p></div>
            </div>
          )
        ) : null}
      </div>

      {isReadyAdapter(item) && item.matchStatus === PORTFOLIO_MATCH_STATUS.VERIFIED ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          Auto matched → {item.matchedInvestorName} {item.matchedClientCode ? `(${item.matchedClientCode})` : ""}
        </div>
      ) : null}

      {item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.MAPPING_REQUIRED ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-bold text-violet-950">Provider columns need mapping</p><p className="mt-1 text-xs leading-5 text-violet-700">Map this layout once. GrowVest can remember the header structure for future daily uploads.</p></div>
          <Button type="button" variant="secondary" onClick={() => onOpenGenericMapping?.(item.fileId)}><Layers3 size={16} /> Map Columns</Button>
        </div>
      ) : null}

      {item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.READY && item.reportType === PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD && item.mappingProfileId && item.genericMapping ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-violet-800">Saved column mapping applied automatically. Review it if this provider changed its layout or meaning.</p>
          <button type="button" onClick={() => onOpenGenericMapping?.(item.fileId)} className="inline-flex min-h-8 items-center gap-1.5 self-start rounded-lg border border-violet-200 bg-white px-2.5 text-xs font-bold text-violet-700 hover:bg-violet-50"><Layers3 size={13} /> Review Mapping</button>
        </div>
      ) : null}

      {requiresChoice ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Confirm GrowVest investor</label>
          <select className={inputClassName} value={mapping || ""} onChange={(event) => onMappingChange(item.fileId, event.target.value)}>
            <option value="">Select investor</option>
            {orderedInvestors.map((investor) => {
              const suggested = suggestedIds.has(investor.id);
              return (
                <option key={investor.id} value={investor.id}>
                  {suggested ? "Suggested · " : ""}{investor.fullName} {investor.clientCode ? `(${investor.clientCode})` : ""}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}
    </article>
  );
}

export default function PortfolioImportCentre() {
  const { profile } = useAuth();
  const fileInputRef = useRef(null);
  const [investors, setInvestors] = useState([]);
  const [recentImports, setRecentImports] = useState([]);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [mappings, setMappings] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [recoveryBatchId, setRecoveryBatchId] = useState("");
  const [genericMappingFileId, setGenericMappingFileId] = useState("");
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState("all");
  const [coverageRefreshKey, setCoverageRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeInvestors(profile, setInvestors, (nextError) => console.error("Unable to load investors", nextError));
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribePortfolioImports(profile, setRecentImports, (nextError) => console.error("Unable to load portfolio imports", nextError));
  }, [profile]);

  const previewFiles = preview?.files || [];
  const eligibleFiles = useMemo(() => previewFiles.filter((item) => isReadyAdapter(item)
    && ![PORTFOLIO_MATCH_STATUS.DUPLICATE, PORTFOLIO_MATCH_STATUS.CONFLICT, "failed"].includes(item.matchStatus)), [previewFiles]);
  const unresolved = useMemo(() => eligibleFiles.filter((item) => needsInvestorChoice(item) && !mappings[item.fileId]), [eligibleFiles, mappings]);
  const readyFiles = useMemo(() => eligibleFiles.filter((item) => !needsInvestorChoice(item) || Boolean(mappings[item.fileId])), [eligibleFiles, mappings]);
  const duplicateFiles = useMemo(() => previewFiles.filter((item) => item.matchStatus === PORTFOLIO_MATCH_STATUS.DUPLICATE), [previewFiles]);
  const issueFiles = useMemo(() => previewFiles.filter((item) => isIssue(item, mappings[item.fileId])), [previewFiles, mappings]);
  const selectedValue = useMemo(() => readyFiles.reduce((sum, item) => sum + Number(item.summary?.currentValue || 0), 0), [readyFiles]);
  const visibleFiles = viewMode === "issues" ? issueFiles : previewFiles;
  const genericMappingItem = useMemo(() => previewFiles.find((item) => item.fileId === genericMappingFileId) || null, [genericMappingFileId, previewFiles]);
  const genericMappingSourceFile = genericMappingItem ? files[Number(genericMappingItem.uploadIndex || 0)] || null : null;

  function selectFiles(nextFiles) {
    const items = [...nextFiles].filter((file) => /\.(xls|xlsx|csv)$/i.test(file.name));
    setFiles(items);
    setPreview(null);
    setMappings({});
    setResult(null);
    setViewMode("all");
    setError(items.length ? "" : "Choose XLS/XLSX/CSV portfolio reports.");
  }

  async function handlePreview() {
    if (!files.length) return;
    setBusy("preview");
    setError("");
    setResult(null);
    try {
      const next = await previewPortfolioImport(files);
      setPreview(next);
      setCoverageRefreshKey((current) => current + 1);
      const defaults = {};
      (next.files || []).forEach((item) => {
        if (item.matchStatus === PORTFOLIO_MATCH_STATUS.REVIEW && item.matchedInvestorId) defaults[item.fileId] = item.matchedInvestorId;
      });
      setMappings(defaults);
      const hasIssues = (next.files || []).some((item) => isIssue(item, defaults[item.fileId]));
      setViewMode(hasIssues ? "issues" : "all");
    } catch (nextError) {
      setError(nextError.message || "Unable to analyse portfolio reports.");
    } finally {
      setBusy("");
    }
  }

  function handleGenericMapped(updated) {
    setPreview((current) => current ? {
      ...current,
      files: (current.files || []).map((item) => item.fileId === updated.fileId ? updated : item)
    } : current);
    if (updated.matchStatus === PORTFOLIO_MATCH_STATUS.REVIEW && updated.matchedInvestorId) {
      setMappings((current) => ({ ...current, [updated.fileId]: updated.matchedInvestorId }));
    }
    setViewMode("issues");
  }

  async function handleCommit() {
    if (!preview?.batchId || !readyFiles.length) return;
    setBusy("commit");
    setError("");
    try {
      const decisions = readyFiles.map((item) => ({
        fileId: item.fileId,
        investorId: item.matchStatus === PORTFOLIO_MATCH_STATUS.VERIFIED ? item.matchedInvestorId : mappings[item.fileId]
      }));
      const nextResult = await commitPortfolioImport(preview.batchId, decisions);
      setResult(nextResult);
      setCoverageRefreshKey((current) => current + 1);
      setFiles([]);
      setPreview(null);
      setMappings({});
      setViewMode("all");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (nextError) {
      setError(nextError.message || "Unable to update portfolios.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-6 pb-24 lg:pb-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Portfolio Management</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Daily Portfolio Update</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Drop portfolio reports in one place. GrowVest detects the source and report type, applies saved investor mappings, skips only exact-content duplicates and asks you to review only exceptions. <strong className="text-slate-700">Fundbazaar uses Client Wise Valuation Report.xlsx only; Portfolio Ledger is not applicable.</strong></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/portfolio" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Portfolio Overview</Link>
          {profile?.role === "super_admin" || profile?.role === "admin" ? <Link href="/portfolio/administration" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Settings2 size={17} /> Portfolio Administration</Link> : null}
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}><FileUp size={17} /> Select Portfolio Files</Button>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      {result ? (
        <Card className="border-emerald-200 bg-emerald-50/40 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={21} /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Daily update completed</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{result.importedCount || 0} portfolio report(s) applied</h2>
              <p className="mt-1 text-sm text-slate-600">Updated portfolio value {formatCurrency(result.totalCurrentValue)} · {(result.results || []).reduce((sum, item) => sum + Number(item.newPositionCount || 0), 0)} new holding(s) · {(result.results || []).reduce((sum, item) => sum + Number(item.exitedPositionCount || 0), 0)} exited holding(s) · {(result.results || []).reduce((sum, item) => sum + Number(item.tradeCount || 0), 0)} intraday trade(s) · {result.issueCount || 0} issue(s).</p>
            </div>
          </div>
        </Card>
      ) : null}


      <DailyPortfolioCoveragePanel currentUser={profile} refreshKey={coverageRefreshKey} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Files" value={preview ? previewFiles.length : files.length} helper="Selected for today's update" icon={FileSpreadsheet} tone="blue" />
        <MetricCard label="Ready" value={readyFiles.length} helper={preview ? formatCurrency(selectedValue) : "Analyse files first"} icon={CheckCircle2} tone="green" />
        <MetricCard label="Need Attention" value={issueFiles.length} helper={unresolved.length ? `${unresolved.length} investor mapping(s)` : "Exceptions only"} icon={AlertTriangle} tone={issueFiles.length ? "amber" : "green"} />
        <MetricCard label="Skipped" value={duplicateFiles.length} helper="Exact duplicates" icon={ShieldCheck} tone="slate" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Unified Import</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Upload → Detect → Review Exceptions → Update</h2>
              <p className="mt-1 text-sm text-slate-500">Fundbazaar, Bajaj Broking, ULIP and GrowVest Standard/Generic portfolio imports are enabled. Unknown provider layouts can be mapped once and remembered for future uploads.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/templates/GrowVest_Standard_Portfolio_Import_v0.32.3.xlsx" download className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"><Download size={15} /> Standard Template</a>
              {files.length || preview ? <button type="button" onClick={() => selectFiles([])} className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600"><X size={15} /> Clear</button> : null}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <input ref={fileInputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(event) => selectFiles(event.target.files || [])} />

          {!preview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); selectFiles(event.dataTransfer.files || []); }}
              className="grid min-h-52 w-full place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              <span>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm"><UploadCloud size={25} /></span>
                <span className="mt-4 block font-heading text-xl font-bold text-slate-950">Drop all today's portfolio reports here</span>
                <span className="mt-2 block text-sm text-slate-500">XLS / XLSX / CSV · up to 100 files · filenames are not used for investor matching</span>
                {files.length ? <span className="mt-4 inline-flex rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-800">{files.length} file(s) selected</span> : null}
              </span>
            </button>
          ) : null}

          {files.length && !preview ? (
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={handlePreview} disabled={busy === "preview"}>{busy === "preview" ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />} Analyse Files</Button>
            </div>
          ) : null}

          {preview ? (
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Analysis complete</p>
                  <p className="mt-1 text-sm text-slate-700">{readyFiles.length} ready · {issueFiles.length} need attention · {duplicateFiles.length} duplicate(s) skipped automatically.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(preview.sourceCounts || {}).map(([source, count]) => <span key={source} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{sourceLabel(source)} · {count}</span>)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setViewMode("issues")} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${viewMode === "issues" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>Issues only ({issueFiles.length})</button>
                  <button type="button" onClick={() => setViewMode("all")} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${viewMode === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>All files ({previewFiles.length})</button>
                </div>
              </div>

              {visibleFiles.length ? visibleFiles.map((item) => (
                <FileCard
                  key={item.fileId}
                  item={item}
                  investors={investors}
                  mapping={mappings[item.fileId]}
                  onMappingChange={(fileId, investorId) => setMappings((current) => ({ ...current, [fileId]: investorId }))}
                  onOpenGenericMapping={(fileId) => setGenericMappingFileId(fileId)}
                  onOpenRecovery={(previousBatchId) => setRecoveryBatchId(previousBatchId)}
                />
              )) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-800">No exceptions. All eligible files are ready.</div>
              )}

              <div className="sticky bottom-3 z-10 flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-bold text-slate-900">{readyFiles.length} report(s) ready to update</p>
                  <p className="mt-1 text-xs text-slate-500">{unresolved.length ? `${unresolved.length} investor mapping(s) still need confirmation.` : issueFiles.length ? "Files still needing mapping stay untouched; ready Fundbazaar, Bajaj, ULIP and GrowVest Standard reports can be processed safely." : "All eligible files are verified."}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => { setPreview(null); setMappings({}); setViewMode("all"); }}>Back</Button>
                  <Button type="button" onClick={handleCommit} disabled={!readyFiles.length || busy === "commit"}>{busy === "commit" ? <Loader2 className="animate-spin" size={17} /> : <UploadCloud size={17} />} Update Ready Portfolios</Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">History</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Recent daily portfolio batches</h2></div>
        <div className="divide-y divide-slate-100">
          {recentImports.length ? recentImports.slice(0, 12).map((item) => (
            <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div><p className="font-semibold text-slate-900">{sourceLabel(item.source)} · {item.fileCount || 0} file(s)</p><p className="mt-1 text-xs text-slate-500">{dateTime(item.createdAt)} · {item.createdByName || "GrowVest User"}</p></div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{item.importedCount || 0} imported</span>{Number(item.issueCount || item.previewIssueCount || 0) ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">{item.issueCount || item.previewIssueCount} issue(s)</span> : null}{Number(item.coverageExpectedCount || 0) > 0 ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Coverage {item.coverageReceivedCount || 0}/{item.coverageExpectedCount} · {Number(item.coverageCompletionPercentage || 0).toFixed(0)}%</span> : null}{Number(item.missingInvestorCount || 0) ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{item.missingInvestorCount} missing</span> : null}<span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{formatCurrency(item.totalCurrentValue)}</span>{["super_admin", "admin"].includes(profile?.role) && (Number(item.importedCount || 0) > 0 || ["partial", "failed"].includes(item.status)) ? <button type="button" onClick={() => setRecoveryBatchId(item.id)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700"><History size={13} /> Manage</button> : null}</div>
            </div>
          )) : <div className="p-8 text-center text-sm text-slate-500">No daily portfolio imports yet.</div>}
        </div>
      </Card>
      {recoveryBatchId ? <PortfolioImportRecoveryDialog batchId={recoveryBatchId} investors={investors} onClose={() => setRecoveryBatchId("")} onCompleted={() => setCoverageRefreshKey((current) => current + 1)} /> : null}

      {genericMappingItem ? <GenericPortfolioMappingDialog
        open
        item={genericMappingItem}
        file={genericMappingSourceFile}
        batchId={preview?.batchId || ""}
        onClose={() => setGenericMappingFileId("")}
        onMapped={handleGenericMapped}
      /> : null}
    </div>
  );
}
