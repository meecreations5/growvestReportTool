"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Eye,
  FileCheck2,
  LayoutTemplate,
  Plus,
  Trash2,
  WalletCards
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestors } from "@/services/assessmentService";
import { getDataImport, linkDataImportToReport } from "@/services/dataImportService";
import { getPortfolioReportSource, updatePortfolioGoal } from "@/services/portfolioService";
import { getInvestorProfileActionsForReportOnce, getOpenInvestorActionsOnce } from "@/services/actionService";
import {
  getLatestInvestorReport,
  getMonthlyReport,
  saveMonthlyReport
} from "@/services/reportService";
import {
  ACTION_OWNER_OPTIONS,
  ACTION_PRIORITY_OPTIONS,
  ACTION_STATUS_OPTIONS,
  INVESTOR_DECISION_OPTIONS,
  RECOMMENDATION_TYPE_OPTIONS,
  ASSET_CLASS_COLORS,
  ASSET_CLASS_OPTIONS,
  DEFAULT_REPORT_DISCLAIMER,
  GOAL_STATUS_OPTIONS,
  HIGHLIGHT_TYPE_OPTIONS,
  calculatePercentage,
  createEmptyAction,
  createEmptyAllocation,
  createEmptyFund,
  createEmptyHighlight,
  createEmptyHolding,
  createReportFromInvestor,
  createReportFromPortfolioSource,
  getMonthLabel,
  getReportMonthKey,
  getDefaultReportPeriod,
  getReportPeriodCutoffDate,
  getReportPeriodEndDate
} from "@/lib/constants/report";
import { monthlyReportSchema, validateCompletedReport } from "@/lib/validation/reportSchema";
import { getReportTemplate, subscribeReportTemplates } from "@/services/reportTemplateService";
import {
  DEFAULT_REPORT_TEMPLATE_ID,
  createReportTemplateSnapshot,
  getSystemReportTemplate
} from "@/lib/constants/reportTemplates";
import { SIGNATURE_SOURCE_LABELS } from "@/lib/constants/emailTemplates";
import { Field, inputClassName } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/format";
import InvestorSelectionStep from "@/components/reports/create/InvestorSelectionStep";
import ReportingPeriodStep from "@/components/reports/create/ReportingPeriodStep";
import ReportTemplateSelectionStep from "@/components/reports/create/ReportTemplateSelectionStep";
import {
  LockedFutureStep,
  MobileReportProgress,
  ReportProgressRail,
  ReportStepShell,
  ReportSummaryPanel,
  ReportWorkflowActions,
  ReportWorkflowHeader
} from "@/components/reports/create/ReportWorkflowShell";
import {
  ReportOutputGuide,
  ValueSourceLegend
} from "@/components/reports/create/ReportWorkflowGuidance";
import CommentaryLibraryPicker from "@/components/market-commentary/CommentaryLibraryPicker";
import { isActionOpen, isStructuredWithdrawalAction } from "@/lib/constants/actions";
import WithdrawalActionSummary from "@/components/actions/WithdrawalActionSummary";

function numberValue(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function withReportTemplateDefaults(report) {
  if (report?.templateId && report?.templateSnapshot) return report;
  const template = getSystemReportTemplate(report?.templateId || DEFAULT_REPORT_TEMPLATE_ID);
  return {
    ...report,
    templateId: template?.id || DEFAULT_REPORT_TEMPLATE_ID,
    templateVersion: Number(template?.version || 1),
    templateSnapshot: createReportTemplateSnapshot(template)
  };
}

function nextReportPeriod(report) {
  let month = Number(report?.reportMonth || new Date().getMonth() + 1) + 1;
  let year = Number(report?.reportYear || new Date().getFullYear());
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return { month, year };
}

function reportPortfolioAsOfDate(year, month, statementDate = "") {
  const cutoff = getReportPeriodCutoffDate(year, month);
  const monthPrefix = `${Number(year)}-${String(Number(month)).padStart(2, "0")}-`;
  if (statementDate && String(statementDate).startsWith(monthPrefix) && statementDate <= cutoff) return statementDate;
  return cutoff;
}

function SectionHeader({ number, title, description, action }) {
  return (
    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-700 text-xs font-black text-white">{number}</span>
        <div><h2 className="font-black text-slate-950">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
      </div>
      {action}
    </div>
  );
}

function RemoveButton({ onClick, label = "Remove row" }) {
  return <button type="button" onClick={onClick} aria-label={label} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50"><Trash2 size={16} /></button>;
}

function StepPageIntro({ number, eyebrow, title, description, icon: Icon, stepId, showValueLegend = false, showInternal = false }) {
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">{Icon ? <Icon size={18} /> : number}</span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">{eyebrow || `Step ${number}`}</p>
            <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <ReportOutputGuide stepId={stepId} />
      {showValueLegend ? <ValueSourceLegend showInternal={showInternal} /> : null}
    </div>
  );
}

export default function ReportForm({ reportId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [investors, setInvestors] = useState([]);
  const [reportTemplates, setReportTemplates] = useState([]);
  const [form, setForm] = useState(() => {
    const period = getDefaultReportPeriod();
    const initial = createReportFromInvestor(null, period.month, period.year);
    return withReportTemplateDefaults({ ...initial, statementDate: getReportPeriodCutoffDate(period.year, period.month) });
  });
  const [loading, setLoading] = useState(Boolean(reportId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [copying, setCopying] = useState(false);
  const [activeStep, setActiveStep] = useState(() => searchParams.get("step") || "investor");
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const [previousReport, setPreviousReport] = useState(null);
  const [workflowActions, setWorkflowActions] = useState([]);
  const [duplicateReport, setDuplicateReport] = useState(null);
  const [periodLookupLoading, setPeriodLookupLoading] = useState(false);
  const [saveState, setSaveState] = useState(reportId ? "saved" : "idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [workingReportId, setWorkingReportId] = useState(reportId);
  const [applyingTemplateId, setApplyingTemplateId] = useState("");
  const formSignatureRef = useRef("");
  const formReadyRef = useRef(false);
  const corpusTouchedRef = useRef(Boolean(reportId));
  const appliedImportRef = useRef("");
  const appliedPortfolioSnapshotRef = useRef("");
  const carriedActionsFromReportRef = useRef("");
  const [activeImportId, setActiveImportId] = useState(() => searchParams.get("importId") || "");
  const [portfolioSource, setPortfolioSource] = useState(null);
  const [portfolioSourceLoading, setPortfolioSourceLoading] = useState(false);
  const [portfolioRefreshToken, setPortfolioRefreshToken] = useState(0);
  const [portfolioAllocationBusyId, setPortfolioAllocationBusyId] = useState("");

  const investorsForSelection = investors;


  useEffect(() => {
    setWorkingReportId(reportId);
  }, [reportId]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeInvestors(profile, setInvestors, (nextError) => {
      console.error(nextError);
      setError("Unable to load investors.");
    });
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeReportTemplates(
      profile,
      (items) => {
        const activeTemplates = items.filter((item) => item.status === "active");
        setReportTemplates(activeTemplates);
        if (!reportId) {
          setForm((current) => {
            const selectedExists = activeTemplates.some((item) => item.id === current.templateId);
            if (selectedExists) return current;
            const fallback = activeTemplates.find((item) => item.isDefault) || activeTemplates[0] || getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID);
            return fallback ? {
              ...current,
              templateId: fallback.id,
              templateVersion: Number(fallback.version || 1),
              templateSnapshot: createReportTemplateSnapshot(fallback)
            } : current;
          });
        }
      },
      (nextError) => {
        console.error("Unable to load report templates", nextError);
        setReportTemplates([getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID)].filter(Boolean));
      }
    );
  }, [profile, reportId]);

  useEffect(() => {
    let active = true;
    async function loadExisting() {
      if (!reportId) return;
      setLoading(true);
      try {
        const report = await getMonthlyReport(reportId);
        if (!report) throw new Error("Monthly report was not found.");
        if (active) {
          formReadyRef.current = false;
          corpusTouchedRef.current = true;
          setForm(withReportTemplateDefaults(report));
          setSaveState("saved");
        }
      } catch (nextError) {
        console.error(nextError);
        if (active) setError(nextError.message || "Unable to load the monthly report.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadExisting();
    return () => { active = false; };
  }, [reportId]);

  useEffect(() => {
    if (reportId || !investors.length) return;
    const investorId = searchParams.get("investorId");
    const copyFrom = searchParams.get("copyFrom");
    const requestedMonthKey = searchParams.get("month");
    if (!investorId) return;
    const investor = investors.find((item) => item.id === investorId);
    if (!investor) return;

    async function initialiseFromQuery() {
      if (copyFrom) {
        try {
          const source = await getMonthlyReport(copyFrom);
          if (source) {
            const period = nextReportPeriod(source);
            formReadyRef.current = false;
            corpusTouchedRef.current = false;
            setForm(withReportTemplateDefaults({
              ...source,
              id: undefined,
              reportCode: undefined,
              version: 0,
              reportMonth: period.month,
              reportYear: period.year,
              reportMonthKey: getReportMonthKey(period.year, period.month),
              statementDate: getReportPeriodCutoffDate(period.year, period.month),
              portfolioAsOfDate: "",
              sourcePortfolioSnapshotId: null,
              portfolioVerificationStatus: "",
              portfolioSourceFreshness: [],
              portfolioVerification: null,
              reportGenerationSource: "",
              reportingPeriod: {
                monthKey: getReportMonthKey(period.year, period.month),
                startDate: `${period.year}-${String(period.month).padStart(2, "0")}-01`,
                endDate: getReportPeriodEndDate(period.year, period.month),
                portfolioCutoffDate: getReportPeriodCutoffDate(period.year, period.month)
              },
              monthlyChanges: [],
              title: `Monthly Portfolio Report — ${getMonthLabel(period.month)} ${period.year}`,
              status: "draft",
              investorVisible: false,
              publicationStatus: "internal",
              activePublishedVersionId: null,
              publishedVersion: 0,
              publishedSourceVersion: null,
              publishedAt: null,
              pdfStoragePath: null,
              pdfFileName: null,
              pdfSizeBytes: null,
              pdfVersion: null,
              pdfGeneratedAt: null,
              pdfRendererVersion: null,
              pdfIsStale: false,
              pdfInvalidatedAt: null,
              pdfInvalidationReason: null,
              sourceReportId: source.id,
              sourceReportMonthKey: source.reportMonthKey,
              createdAt: undefined,
              completedAt: null
            }));
            return;
          }
        } catch (nextError) {
          console.error(nextError);
        }
      }
      formReadyRef.current = false;
      corpusTouchedRef.current = false;
      const defaultPeriod = getDefaultReportPeriod();
      const requestedMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(requestedMonthKey || ""));
      const currentMonthKey = getReportMonthKey(new Date().getFullYear(), new Date().getMonth() + 1);
      const requestedPeriodAllowed = requestedMatch && String(requestedMonthKey) <= currentMonthKey;
      const period = requestedPeriodAllowed
        ? { year: Number(requestedMatch[1]), month: Number(requestedMatch[2]) }
        : defaultPeriod;
      setForm(withReportTemplateDefaults({
        ...createReportFromInvestor(investor, period.month, period.year),
        statementDate: getReportPeriodCutoffDate(period.year, period.month)
      }));
    }

    initialiseFromQuery();
  }, [investors, reportId, searchParams]);

  const selectedInvestor = useMemo(
    () => investorsForSelection.find((item) => item.id === form.investorId) || null,
    [form.investorId, investorsForSelection]
  );

  useEffect(() => {
    if ((reportId && portfolioRefreshToken === 0) || !form.investorId || !selectedInvestor || activeImportId || searchParams.get("importId")) {
      if (!form.investorId) setPortfolioSource(null);
      return undefined;
    }

    let active = true;
    async function loadPortfolioSource() {
      const asOfDate = reportPortfolioAsOfDate(form.reportYear, form.reportMonth, form.statementDate);
      setPortfolioSourceLoading(true);
      try {
        const source = await getPortfolioReportSource(form.investorId, asOfDate, profile);
        if (!active) return;
        setPortfolioSource(source);
        const sourceForGeneration = source || { asOfDate, snapshot: null, positions: [], openingPositions: [], transactions: [] };
        const generated = createReportFromPortfolioSource(selectedInvestor, sourceForGeneration, form.reportMonth, form.reportYear);

        if (!source?.snapshot?.id) {
          setForm((current) => ({
            ...current,
            summary: {
              ...current.summary,
              totalCorpus: Number(generated.summary?.totalCorpus || 0),
              lifetimeTarget: Number(generated.summary?.lifetimeTarget || 0),
              monthlySip: Number(generated.summary?.monthlySip || 0),
              newMoneyAdded: 0,
              investmentGain: 0,
              openingValue: 0,
              totalWithdrawals: 0,
              overallProgress: calculatePercentage(
                Number(generated.summary?.totalCorpus || 0),
                Number(generated.summary?.lifetimeTarget || 0)
              )
            },
            holdings: generated.holdings || [],
            allocation: generated.allocation || [],
            funds: generated.funds || [],
            portfolioVerification: generated.portfolioVerification,
            reportGenerationSource: "portfolio_master",
            reportingPeriod: generated.reportingPeriod || null,
            monthlyChanges: generated.monthlyChanges || []
          }));
          setError("No verified Portfolio Master snapshot is available on or before this report date. Update the investor portfolio before generating the monthly report.");
          return;
        }

        const portfolioSourceKey = `${source.snapshot.id}|${asOfDate}`;
        if (appliedPortfolioSnapshotRef.current === portfolioSourceKey && portfolioRefreshToken === 0) return;

        if (corpusTouchedRef.current) {
          setForm((current) => ({
            ...current,
            sourcePortfolioSnapshotId: source.snapshot.id,
            portfolioAsOfDate: source.snapshot.snapshotDate || "",
            portfolioVerificationStatus: source.snapshot.verificationStatus || "verified",
            portfolioSourceFreshness: source.snapshot.sourceFreshness || [],
            portfolioVerification: generated.portfolioVerification,
            reportGenerationSource: "portfolio_master",
            reportingPeriod: generated.reportingPeriod || null,
            monthlyChanges: generated.monthlyChanges || []
          }));
        } else {
          setForm((current) => withReportTemplateDefaults({
            ...generated,
            templateId: current.templateId || generated.templateId,
            templateVersion: current.templateVersion || generated.templateVersion,
            templateSnapshot: current.templateSnapshot || generated.templateSnapshot,
            title: current.title || generated.title,
            statementDate: current.statementDate || generated.statementDate || asOfDate,
            advisorNote: current.advisorNote || generated.advisorNote,
            advisorInsights: current.advisorInsights || generated.advisorInsights,
            commentarySources: current.commentarySources || generated.commentarySources,
            monthlyHighlights: current.monthlyHighlights || generated.monthlyHighlights,
            nextSteps: current.nextSteps || generated.nextSteps,
            nextReview: current.nextReview || generated.nextReview,
            disclaimer: current.disclaimer || generated.disclaimer
          }));
        }
        appliedPortfolioSnapshotRef.current = portfolioSourceKey;
        setError("");
        const verificationStatus = generated.portfolioVerification?.status;
        setSuccess(verificationStatus === "review_required"
          ? `Portfolio snapshot as of ${source.snapshot.snapshotDate} populated the report. Review and confirm the verification warnings before continuing.`
          : verificationStatus === "blocked"
            ? `Portfolio snapshot as of ${source.snapshot.snapshotDate} was found, but verification is blocked. Resolve the flagged source issues before completion.`
            : `Verified portfolio snapshot as of ${source.snapshot.snapshotDate} populated this report automatically. Review the figures and add advisor recommendations before completion.`);
      } catch (nextError) {
        console.error("Unable to load portfolio report source", nextError);
        if (active) setPortfolioSource(null);
      } finally {
        if (active) setPortfolioSourceLoading(false);
      }
    }

    loadPortfolioSource();
    return () => { active = false; };
  }, [activeImportId, form.investorId, form.reportMonth, form.reportYear, form.statementDate, portfolioRefreshToken, profile, reportId, searchParams, selectedInvestor]);

  useEffect(() => {
    const importId = searchParams.get("importId");
    if (!importId || appliedImportRef.current === importId || loading || !investors.length) return undefined;

    let active = true;
    async function applyDataImport() {
      try {
        const importJob = await getDataImport(importId);
        if (!importJob) throw new Error("The selected data import was not found.");
        const investor = investors.find((item) => item.id === importJob.investorId);
        if (!investor) throw new Error("The investor linked to this import is not available to your account.");

        const imported = importJob.reportPayload || {};
        const totalCorpus = Number(imported.summary?.totalCorpus || 0);
        if (totalCorpus <= 0 || !imported.funds?.length) {
          throw new Error("The import does not contain usable portfolio values.");
        }

        const month = Number(importJob.reportMonth || new Date().getMonth() + 1);
        const year = Number(importJob.reportYear || new Date().getFullYear());
        const monthEnd = new Date(year, month, 0);
        const statementDate = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

        formReadyRef.current = false;
        corpusTouchedRef.current = true;
        setForm((current) => {
          const base = reportId
            ? current
            : withReportTemplateDefaults(createReportFromInvestor(investor, month, year));
          const lifetimeTarget = Number(base.summary?.lifetimeTarget || 0);
          return {
            ...base,
            reportMonth: month,
            reportYear: year,
            reportMonthKey: getReportMonthKey(year, month),
            statementDate: base.statementDate || statementDate,
            title: `Monthly Portfolio Report — ${getMonthLabel(month)} ${year}`,
            summary: {
              ...base.summary,
              totalCorpus,
              monthlySip: Number(imported.summary?.monthlySip || 0),
              newMoneyAdded: Number(imported.summary?.newMoneyAdded || 0),
              investmentGain: Number(imported.summary?.investmentGain || 0),
              openingValue: Number(imported.summary?.openingValue || 0),
              totalWithdrawals: Number(imported.summary?.totalWithdrawals || 0),
              overallProgress: calculatePercentage(totalCorpus, lifetimeTarget)
            },
            holdings: imported.holdings || [],
            allocation: imported.allocation || [],
            funds: imported.funds || [],
            sourceImportId: importId,
            sourceImportFileName: importJob.fileName || "",
            importedDataSummary: {
              sourceRowCount: Number(imported.sourceRowCount || 0),
              importedAt: new Date().toISOString(),
              sourceLabel: importJob.sourceLabel || "Bulk Data Upload"
            }
          };
        });

        appliedImportRef.current = importId;
        setActiveImportId(importId);
        setActiveStep("portfolio-data");
        setSuccess(`${imported.sourceRowCount || imported.funds.length} validated holdings from ${importJob.fileName || "the import file"} were applied. Review the calculated totals before saving.`);
        router.replace(reportId ? `/reports/${reportId}/edit?step=portfolio-data` : "/reports/create?step=portfolio-data");
      } catch (nextError) {
        console.error(nextError);
        if (active) setError(nextError.message || "Unable to apply the selected data import.");
      }
    }

    applyDataImport();
    return () => { active = false; };
  }, [investors, loading, reportId, router, searchParams]);
  const isLocked = form.status === "locked";

  const investorComplete = Boolean(form.investorId);
  const periodComplete = Boolean(form.investorId && form.statementDate && form.title && !duplicateReport && !periodLookupLoading);
  const portfolioVerification = form.portfolioVerification || null;
  const portfolioVerificationReady = !portfolioVerification?.required || Boolean(
    form.sourcePortfolioSnapshotId
    && !["pending", "blocked"].includes(String(portfolioVerification.status || ""))
    && (portfolioVerification.status !== "review_required" || portfolioVerification.acknowledged)
  );
  const portfolioDataComplete = Boolean(
    Number(form.summary?.totalCorpus || 0) > 0
    && form.holdings?.some((item) => Number(item.currentValue || 0) > 0)
    && form.funds?.some((item) => item.instrumentName?.trim() && Number(item.currentValue || 0) > 0)
    && portfolioVerificationReady
  );
  const commentaryComplete = Boolean(form.advisorInsights?.narrative || form.advisorNote?.content);
  const validGoals = (form.goals || []).filter((goal) => goal.name?.trim() && Number(goal.targetAmount || 0) > 0);
  const goalsComplete = form.goals?.length ? validGoals.length > 0 : true;
  const templateComplete = Boolean(form.templateId && form.templateSnapshot?.name);
  const completionIssues = useMemo(() => validateCompletedReport(form), [form]);
  const approvalComplete = completionIssues.length === 0 && Boolean(String(form.disclaimer || "").trim()) && templateComplete;

  const workflowSteps = useMemo(() => [
    { id: "investor", label: "Investor", helper: "Select client profile", complete: investorComplete, locked: false },
    { id: "period", label: "Reporting Period", helper: "Month and statement date", complete: periodComplete, locked: !investorComplete, lockReason: "Select an investor first." },
    { id: "portfolio-data", label: "Portfolio Data", helper: "Summary and holdings", complete: portfolioDataComplete, locked: !periodComplete, lockReason: "Complete the reporting period first." },
    { id: "calculations", label: "Review Calculations", helper: "Reconcile report values", complete: portfolioDataComplete, locked: !portfolioDataComplete, lockReason: "Add portfolio data first." },
    { id: "commentary", label: "Commentary", helper: "Advisor insights", complete: commentaryComplete, locked: !portfolioDataComplete, lockReason: "Review portfolio data first." },
    { id: "goals", label: "Goals & Allocation", helper: "Goals or General Wealth", complete: goalsComplete, locked: !commentaryComplete, lockReason: "Add Advisor commentary first." },
    { id: "template", label: "Template", helper: "Report presentation", complete: templateComplete, locked: !goalsComplete, lockReason: "Review goals or General Wealth first." },
    { id: "approval", label: "Preview & Approval", helper: "Actions and compliance", complete: approvalComplete, locked: !goalsComplete, lockReason: "Complete report content first." },
    { id: "pdf", label: "Generate PDF", helper: "Secure investor document", complete: Boolean(form.pdfStoragePath), locked: form.status !== "completed", lockReason: "Complete the report before generating a PDF." },
    { id: "delivery", label: "Deliver Report", helper: "Portal and email delivery", complete: Boolean(form.investorVisible), locked: !form.pdfStoragePath, lockReason: "Generate the secure PDF before delivery." }
  ], [approvalComplete, commentaryComplete, form.investorVisible, form.pdfStoragePath, form.status, goalsComplete, investorComplete, periodComplete, portfolioDataComplete, templateComplete]);

  const editorSteps = workflowSteps.slice(0, 8);
  const completedEditorSteps = editorSteps.filter((step) => step.complete).length;
  const readinessProgress = Math.round((completedEditorSteps / editorSteps.length) * 100);
  const activeStepIndex = Math.max(0, workflowSteps.findIndex((step) => step.id === activeStep));
  const activeStepDefinition = workflowSteps[activeStepIndex] || workflowSteps[0];

  useEffect(() => {
    if (loading) return;
    const signature = JSON.stringify(form);
    if (!formReadyRef.current) {
      formReadyRef.current = true;
      formSignatureRef.current = signature;
      return;
    }
    if (signature !== formSignatureRef.current && !saving && !isLocked) setSaveState("dirty");
  }, [form, isLocked, loading, saving]);

  useEffect(() => {
    let active = true;
    async function loadPeriodContext() {
      if (!form.investorId) {
        setPreviousReport(null);
        setWorkflowActions([]);
        setDuplicateReport(null);
        return;
      }
      setPeriodLookupLoading(true);
      const monthKey = getReportMonthKey(form.reportYear, form.reportMonth);
      try {
        const periodStart = `${monthKey}-01`;
        const periodEnd = getReportPeriodEndDate(form.reportYear, form.reportMonth);
        const [previous, duplicate, openActions, profileActions] = await Promise.all([
          getLatestInvestorReport(form.investorId, monthKey),
          getMonthlyReport(`${form.investorId}_${monthKey}`),
          profile?.id ? getOpenInvestorActionsOnce(form.investorId, profile) : Promise.resolve([]),
          profile?.id ? getInvestorProfileActionsForReportOnce(form.investorId, profile, { startDate: periodStart, endDate: periodEnd }) : Promise.resolve([])
        ]);
        if (!active) return;
        setPreviousReport(previous);
        setWorkflowActions(openActions || []);
        if (!duplicate || duplicate.id === workingReportId) {
          setForm((current) => {
            const frozenProfileActions = Boolean(
              current.status === "locked"
              || current.publicationStatus === "published"
              || (current.investorVisible === true && Number(current.publishedVersion || 0) > 0)
            );
            return frozenProfileActions ? current : { ...current, profileActions: profileActions || [] };
          });
        }
        setDuplicateReport(duplicate && duplicate.id !== workingReportId ? duplicate : null);
      } catch (lookupError) {
        console.error(lookupError);
        if (active) {
          setPreviousReport(null);
          setWorkflowActions([]);
          setDuplicateReport(null);
        }
      } finally {
        if (active) setPeriodLookupLoading(false);
      }
    }
    loadPeriodContext();
    return () => { active = false; };
  }, [form.investorId, form.reportMonth, form.reportYear, profile?.id, profile?.role, reportId, workingReportId]);

  useEffect(() => {
    if (reportId || !form.investorId) return;
    const carryKey = `${form.investorId}:${form.reportYear}-${String(form.reportMonth).padStart(2, "0")}:${workflowActions.map((item) => item.id).join(",") || previousReport?.id || "none"}`;
    if (carriedActionsFromReportRef.current === carryKey) return;

    const workflowCarry = (workflowActions || []).filter((item) => isActionOpen(item) && item.sourceType === "monthly_report");
    const previousReportCarry = (previousReport?.nextSteps || []).filter((item) => isActionOpen(item));
    const carryForward = previousReportCarry.length ? previousReportCarry : workflowCarry;
    if (!carryForward.length) {
      carriedActionsFromReportRef.current = carryKey;
      return;
    }

    setForm((current) => {
      if (current.nextSteps?.length) return current;
      return {
        ...current,
        nextSteps: carryForward.map((item, index) => ({
          id: `action-${Date.now()}-${index}`,
          title: item.title || item.description || "",
          description: item.description || item.title || "",
          recommendationType: item.recommendationType || item.requestType || "Portfolio Review",
          investorDecision: item.investorDecision || "Pending Discussion",
          relatedGoalId: item.relatedGoalId || "",
          relatedInvestmentId: item.relatedInvestmentId || "",
          sourceActionId: item.id || item.sourceActionId || "",
          sourceReportId: item.sourceReportId || "",
          sourceReportMonthKey: item.sourceReportMonthKey || item.lastReportMonthKey || "",
          owner: item.owner || "Advisor",
          priority: item.priority || "Planned",
          dueDate: item.dueDate || "",
          completionDate: item.completionDate || "",
          status: item.status || "Recommended",
          requestType: item.requestType || item.recommendationType || "",
          sourceType: item.sourceType || "monthly_report",
          requestedAmount: Number(item.requestedAmount || 0),
          requestedMonthlyAmount: Number(item.requestedMonthlyAmount || 0),
          requestedUnits: Number(item.requestedUnits || 0),
          requestedEffectiveDate: item.requestedEffectiveDate || "",
          requestedTargetGoalId: item.requestedTargetGoalId || "",
          requestedTargetGoalName: item.requestedTargetGoalName || "",
          requestedAccountReference: item.requestedAccountReference || "",
          financialImpactType: item.financialImpactType || "none",
          financialImpactStatus: item.financialImpactStatus || "not_applicable"
        }))
      };
    });
    carriedActionsFromReportRef.current = carryKey;
  }, [form.investorId, form.reportMonth, form.reportYear, previousReport, reportId, workflowActions]);

  function acknowledgePortfolioVerification() {
    setForm((current) => ({
      ...current,
      portfolioVerification: {
        ...(current.portfolioVerification || {}),
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedByUid: profile?.id || "",
        acknowledgedByName: profile?.fullName || profile?.email || "GrowVest User"
      }
    }));
    setSuccess("Portfolio verification warnings were reviewed and confirmed for this working report.");
  }

  function refreshPortfolioVerification() {
    appliedPortfolioSnapshotRef.current = "";
    setPortfolioRefreshToken((value) => value + 1);
  }

  function goToStep(stepId) {
    const target = workflowSteps.find((step) => step.id === stepId);
    if (!target || target.locked) return;
    setError("");
    setActiveStep(stepId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setTopLevel(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setSummary(field, value) {
    if (field === "totalCorpus") corpusTouchedRef.current = true;

    setForm((current) => {
      const summary = { ...current.summary, [field]: numberValue(value) };
      if (field === "totalCorpus" || field === "lifetimeTarget") {
        summary.overallProgress = calculatePercentage(summary.totalCorpus, summary.lifetimeTarget);
      }
      return { ...current, summary };
    });
  }

  function updatePeriod(field, value) {
    appliedPortfolioSnapshotRef.current = "";
    carriedActionsFromReportRef.current = "";
    setPortfolioSource(null);
    setForm((current) => {
      let reportMonth = Number(current.reportMonth);
      let reportYear = Number(current.reportYear);

      if (field === "reportMonthKey") {
        const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ""));
        if (!match) return current;
        reportYear = Number(match[1]);
        reportMonth = Number(match[2]);
      } else {
        reportMonth = field === "reportMonth" ? Number(value) : reportMonth;
        reportYear = field === "reportYear" ? Number(value) : reportYear;
      }

      const suggestedStatementDate = getReportPeriodCutoffDate(reportYear, reportMonth);
      return {
        ...current,
        reportMonth,
        reportYear,
        reportMonthKey: getReportMonthKey(reportYear, reportMonth),
        statementDate: suggestedStatementDate,
        reportingPeriod: {
          monthKey: getReportMonthKey(reportYear, reportMonth),
          startDate: `${reportYear}-${String(reportMonth).padStart(2, "0")}-01`,
          endDate: getReportPeriodEndDate(reportYear, reportMonth),
          portfolioCutoffDate: suggestedStatementDate
        },
        monthlyChanges: [],
        title: `Monthly Portfolio Report — ${getMonthLabel(reportMonth)} ${reportYear}`
      };
    });
  }

  function handleInvestorChange(investorId) {
    const investor = investorsForSelection.find((item) => item.id === investorId);
    corpusTouchedRef.current = false;
    appliedPortfolioSnapshotRef.current = "";
    carriedActionsFromReportRef.current = "";
    setPortfolioSource(null);
    setSuccess("");

    if (!investor) {
      setForm(withReportTemplateDefaults(createReportFromInvestor(null, form.reportMonth, form.reportYear)));
      return;
    }

    const fresh = withReportTemplateDefaults(createReportFromInvestor(investor, form.reportMonth, form.reportYear));
    const suggestedStatementDate = getReportPeriodCutoffDate(form.reportYear, form.reportMonth);

    const nextForm = {
      ...fresh,
      statementDate: suggestedStatementDate
    };

    setForm(nextForm);
  }

  async function updatePortfolioBucketFromReport(fund, goalId) {
    if (!fund?.positionId) return;
    setPortfolioAllocationBusyId(fund.positionId);
    setError("");
    setSuccess("");
    try {
      await updatePortfolioGoal(fund.positionId, goalId);
      appliedPortfolioSnapshotRef.current = "";
      setPortfolioRefreshToken((value) => value + 1);
      setSuccess(`Bucket assignment updated in Portfolio Master for ${fund.instrumentName || "investment"}. The report has been refreshed from the verified portfolio.`);
    } catch (nextError) {
      setError(nextError.message || "Unable to update the Bucket List assignment.");
    } finally {
      setPortfolioAllocationBusyId("");
    }
  }

  function updateArray(section, index, field, value) {
    setForm((current) => {
      const rows = [...(current[section] || [])];
      const row = { ...rows[index], [field]: value };
      if (["currentValue", "monthlySip", "targetAmount", "currentAmount", "targetPercentage", "currentPercentage"].includes(field)) row[field] = numberValue(value);

      if (section === "holdings" && field === "assetClass") row.color = ASSET_CLASS_COLORS[value] || ASSET_CLASS_COLORS.Other;
      if (section === "holdings" && (field === "currentValue" || field === "percentage")) row.percentage = field === "percentage" ? numberValue(value) : calculatePercentage(row.currentValue, current.summary?.totalCorpus);
      if (section === "goals" && ["targetAmount", "currentAmount"].includes(field)) row.progress = calculatePercentage(row.currentAmount, row.targetAmount);
      if (section === "allocation" && ["currentValue", "currentPercentage", "targetPercentage"].includes(field)) {
        row.currentPercentage = field === "currentPercentage" ? numberValue(value) : calculatePercentage(row.currentValue, current.summary?.totalCorpus);
        row.variance = Number((Number(row.currentPercentage || 0) - Number(row.targetPercentage || 0)).toFixed(1));
      }
      if (section === "funds" && field === "goalId") {
        const goal = current.goals?.find((item) => item.goalId === value);
        row.goalName = goal?.name || "";
      }
      rows[index] = row;
      return { ...current, [section]: rows };
    });
  }

  function removeArrayRow(section, index) {
    setForm((current) => ({ ...current, [section]: (current[section] || []).filter((_, rowIndex) => rowIndex !== index) }));
  }

  function applyMarketCommentary({ commentary, target, replaceExisting }) {
    const content = String(commentary?.content || "").trim();
    if (!content) return;

    const combine = (existing) => {
      const current = String(existing || "").trim();
      if (replaceExisting || !current) return content;
      return `${current}\n\n${content}`;
    };

    setForm((current) => {
      const source = {
        commentaryId: commentary.id,
        title: commentary.title,
        category: commentary.category,
        version: Number(commentary.version || 1),
        target,
        copiedAt: new Date().toISOString()
      };
      const commentarySources = [
        ...(current.commentarySources || []).filter((item) => !(item.commentaryId === source.commentaryId && item.target === source.target)),
        source
      ];

      if (target === "disclaimer") {
        return { ...current, disclaimer: combine(current.disclaimer), commentarySources };
      }

      if (target === "advisorHighlight") {
        return {
          ...current,
          advisorNote: { ...current.advisorNote, highlight: combine(current.advisorNote?.highlight) },
          commentarySources
        };
      }

      if (["progressHighlight", "priorityAttention", "portfolioOpportunity"].includes(target)) {
        return {
          ...current,
          advisorInsights: {
            ...current.advisorInsights,
            [target]: {
              ...current.advisorInsights?.[target],
              title: replaceExisting || !current.advisorInsights?.[target]?.title ? commentary.title : current.advisorInsights[target].title,
              description: combine(current.advisorInsights?.[target]?.description)
            }
          },
          commentarySources
        };
      }

      return {
        ...current,
        advisorNote: { ...current.advisorNote, content: combine(current.advisorNote?.content) },
        advisorInsights: { ...current.advisorInsights, narrative: combine(current.advisorInsights?.narrative || current.advisorNote?.content) },
        commentarySources
      };
    });

    setSuccess(`${commentary.title} was copied into the report. Review and personalise the content before completion.`);
  }

  async function selectReportTemplate(template) {
    if (!template || applyingTemplateId) return;

    // Always re-read the published template before applying it. This avoids
    // applying a stale list/subscription object after a template was activated.
    const latestTemplate = await getReportTemplate(template.id).catch(() => null);
    const appliedTemplate = latestTemplate || template;

    setError("");
    setSuccess("");

    const hadGeneratedOrPublishedPdf = Boolean(form.pdfStoragePath || form.activePublishedVersionId);
    const appliedAt = new Date().toISOString();
    const nextForm = {
      ...form,
      templateId: appliedTemplate.id,
      templateVersion: Number(appliedTemplate.version || 1),
      templateSnapshot: createReportTemplateSnapshot(appliedTemplate),
      templateAppliedAt: appliedAt,
      pdfStoragePath: null,
      pdfFileName: null,
      pdfSizeBytes: null,
      pdfVersion: null,
      pdfGeneratedAt: null,
      pdfRendererVersion: null,
      pdfIsStale: hadGeneratedOrPublishedPdf,
      pdfInvalidationReason: hadGeneratedOrPublishedPdf ? "report_template_changed" : null
    };

    setForm(nextForm);
    setSaveState("dirty");

    // New reports can keep the selected template locally until the first draft
    // save. Existing reports persist the template immediately so opening HTML
    // or PDF preview cannot race against the delayed autosave.
    if (!workingReportId || !canSaveDraft) {
      setSuccess(`${appliedTemplate.name} version ${Number(appliedTemplate.version || 1)} selected. Save the report draft to apply it to HTML and PDF output.`);
      return;
    }

    setApplyingTemplateId(appliedTemplate.id);
    setSaving(true);
    setSaveState("saving");

    try {
      const saved = await saveMonthlyReport(nextForm, profile, {
        reportId: workingReportId,
        complete: form.status === "completed",
        autosave: false
      });

      const persistedForm = {
        ...nextForm,
        templateId: saved.templateId,
        templateVersion: saved.templateVersion,
        templateSnapshot: saved.templateSnapshot,
        templateAppliedAt: appliedAt,
        version: saved.version,
        status: saved.status,
        publicationStatus: saved.publicationStatus,
        pdfStoragePath: null,
        pdfFileName: null,
        pdfSizeBytes: null,
        pdfVersion: null,
        pdfGeneratedAt: null,
        pdfRendererVersion: null,
        pdfIsStale: saved.pdfIsStale,
        pdfInvalidationReason: saved.pdfInvalidationReason
      };
      setForm(persistedForm);
      formSignatureRef.current = JSON.stringify(persistedForm);
      setLastSavedAt(new Date());
      setSaveState("saved");
      setSuccess(`${appliedTemplate.name} version ${Number(appliedTemplate.version || 1)} is now saved on this working report. Open HTML Preview to verify it${hadGeneratedOrPublishedPdf ? ", then regenerate the PDF" : ""}.`);
    } catch (nextError) {
      console.error(nextError);
      setSaveState("error");
      setError(nextError.message || "The report template could not be applied.");
    } finally {
      setSaving(false);
      setApplyingTemplateId("");
    }
  }

  async function copyLatestReport() {
    if (!form.investorId) {
      setError("Select an investor before copying the previous report.");
      return;
    }
    setCopying(true);
    setError("");
    try {
      const currentMonthKey = getReportMonthKey(form.reportYear, form.reportMonth);
      const source = await getLatestInvestorReport(form.investorId, currentMonthKey);
      if (!source) throw new Error("No previous monthly report was found for this investor.");
      corpusTouchedRef.current = true;
      setForm((current) => ({
        ...source,
        id: undefined,
        reportCode: undefined,
        version: 0,
        investorId: current.investorId,
        investorName: current.investorName,
        clientCode: current.clientCode,
        investorEmail: current.investorEmail,
        investorContactNo: current.investorContactNo,
        investorPortalUid: current.investorPortalUid,
        advisorUid: current.advisorUid,
        assignedAdvisorUid: current.assignedAdvisorUid,
        advisorName: current.advisorName,
        reportMonth: current.reportMonth,
        reportYear: current.reportYear,
        reportMonthKey: currentMonthKey,
        statementDate: current.statementDate,
        title: `Monthly Portfolio Report — ${getMonthLabel(current.reportMonth)} ${current.reportYear}`,
        status: "draft",
        investorVisible: false,
        publicationStatus: "internal",
        activePublishedVersionId: null,
        publishedVersion: 0,
        publishedSourceVersion: null,
        publishedAt: null,
        pdfStoragePath: null,
        pdfFileName: null,
        pdfSizeBytes: null,
        pdfVersion: null,
        pdfGeneratedAt: null,
        pdfRendererVersion: null,
        pdfIsStale: false,
        pdfInvalidatedAt: null,
        pdfInvalidationReason: null,
        sourceReportId: source.id,
        sourceReportMonthKey: source.reportMonthKey,
        createdAt: undefined,
        completedAt: null
      }));
      setSuccess(`Copied data from ${getMonthLabel(source.reportMonth)} ${source.reportYear}. Update the current monthly values before saving.`);
    } catch (nextError) {
      setError(nextError.message || "Unable to copy the previous report.");
    } finally {
      setCopying(false);
    }
  }

  async function handleSave(complete = false, options = {}) {
    const { silent = false, autosave = false, redirectToPreview = false } = options;
    if (isLocked || saving) return;

    setSaving(true);
    setSaveState("saving");
    if (!silent) {
      setError("");
      setSuccess("");
      setFieldErrors({});
    }

    const parsed = monthlyReportSchema.safeParse(form);
    if (!parsed.success) {
      if (!silent) {
        const nextErrors = {};
        parsed.error.issues.forEach((issue) => { nextErrors[issue.path.join(".")] = issue.message; });
        setFieldErrors(nextErrors);
        setError("Correct the highlighted report details before saving.");
      }
      setSaveState("dirty");
      setSaving(false);
      return;
    }

    if (complete) {
      const completionErrors = validateCompletedReport(form);
      if (completionErrors.length) {
        setError(completionErrors.join(" "));
        setSaveState("dirty");
        setSaving(false);
        return;
      }
    }

    try {
      const existingWorkingId = workingReportId;
      const saved = await saveMonthlyReport(form, profile, {
        reportId: existingWorkingId,
        complete,
        autosave
      });
      setWorkingReportId(saved.id);
      if (activeImportId) {
        try {
          await linkDataImportToReport(activeImportId, saved.id, profile);
          setActiveImportId("");
        } catch (linkError) {
          console.error("Monthly report saved, but the import history could not be linked.", linkError);
        }
      }
      if (!silent) {
        setSuccess(complete ? "Monthly report completed successfully." : "Monthly report draft saved.");
      }
      setSaveState("saved");
      setLastSavedAt(new Date());
      formSignatureRef.current = JSON.stringify(form);
      if (complete || redirectToPreview) {
        router.push(`/reports/${saved.id}`);
      } else if (!existingWorkingId) {
        router.replace(`/reports/${saved.id}/edit?step=${activeStep}`);
      }
      return saved;
    } catch (nextError) {
      console.error(nextError);
      if (!silent) setError(nextError.message || "Unable to save the monthly report.");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }


  function validateActiveStep() {
    setError("");
    if (activeStep === "investor" && !form.investorId) {
      setError("Select an investor before continuing.");
      return false;
    }
    if (activeStep === "period") {
      if (!form.statementDate || !form.title) {
        setError("Complete the statement date and report title before continuing.");
        return false;
      }
      if (duplicateReport) {
        setError("A report already exists for this investor and reporting month. Open the existing report instead.");
        return false;
      }
    }
    return true;
  }

  function goBackStep() {
    const previous = workflowSteps.slice(0, activeStepIndex).reverse().find((step) => !step.locked);
    if (previous) goToStep(previous.id);
  }

  async function continueWorkflow() {
    if (!validateActiveStep()) return;
    if (activeStep === "approval") {
      await handleSave(true);
      return;
    }
    if (activeStep === "pdf" || activeStep === "delivery") return;
    const next = workflowSteps.slice(activeStepIndex + 1).find((step) => !step.locked);
    if (next) goToStep(next.id);
  }

  const primaryActionLabel = activeStep === "investor"
    ? "Continue to Reporting Period"
    : activeStep === "period"
      ? "Continue to Portfolio Data"
      : activeStep === "approval"
        ? approvalComplete
          ? "Complete report"
          : `${completionIssues.length} issue${completionIssues.length === 1 ? "" : "s"} to resolve`
        : activeStep === "template"
          ? "Continue to Preview"
          : "Continue";

  const canSaveDraft = periodComplete && !duplicateReport;
  const activeStepReady = activeStep === "investor"
    ? investorComplete
    : activeStep === "period"
      ? periodComplete
      : activeStep === "portfolio-data"
        ? portfolioDataComplete
        : activeStep === "commentary"
          ? commentaryComplete
          : activeStep === "goals"
            ? goalsComplete
            : activeStep === "template"
              ? templateComplete
            : activeStep === "approval"
              ? approvalComplete
              : true;
  const canContinue = !activeStepDefinition?.locked
    && activeStepReady
    && !["pdf", "delivery"].includes(activeStep);

  useEffect(() => {
    if (loading || isLocked || saving || !canSaveDraft || saveState !== "dirty" || ["investor", "period"].includes(activeStep)) return undefined;

    const timer = window.setTimeout(() => {
      handleSave(false, { silent: true, autosave: true });
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [form, loading, isLocked, saving, canSaveDraft, saveState, activeStep]);

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading monthly report…</div>;

  const holdingsTotal = (form.holdings || []).reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const fundsTotal = (form.funds || []).reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const corpusDifference = Number(form.summary?.totalCorpus || 0) - holdingsTotal;
  const portfolioFactsLocked = Boolean(form.sourcePortfolioSnapshotId && form.reportGenerationSource === "portfolio_master");
  const canModifyCurrentPortfolioBuckets = Boolean(
    portfolioFactsLocked
    && selectedInvestor?.latestPortfolioSnapshotId
    && String(selectedInvestor.latestPortfolioSnapshotId) === String(form.sourcePortfolioSnapshotId)
    && !isLocked
  );

  return (
    <div className="-mx-4 -mt-5 min-h-[calc(100dvh-5rem)] bg-[#F5F7FB] sm:-mx-6 sm:-mt-7 xl:-mx-8 xl:-mt-8">
      <ReportWorkflowHeader
        reportId={reportId}
        form={form}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        isLocked={isLocked}
        copying={copying}
        onCopyPrevious={copyLatestReport}
      />

      <div className="grid gap-4 px-4 py-4 sm:px-6 lg:py-6">
        {error ? <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertTriangle size={19} className="mt-0.5 shrink-0" /><p>{error}</p></div> : null}
        {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{success}</div> : null}
        {isLocked ? <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm font-semibold text-slate-700">This report is locked and cannot be edited.</div> : null}

        <MobileReportProgress
          steps={workflowSteps}
          activeStep={activeStep}
          onSelect={goToStep}
          progress={readinessProgress}
          open={mobileStepsOpen}
          onOpenChange={setMobileStepsOpen}
        />

        <div className="grid items-start gap-5 xl:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(0,1fr)_290px]">
          <ReportProgressRail steps={workflowSteps} activeStep={activeStep} onSelect={goToStep} progress={readinessProgress} />

          <main className="min-w-0">
            {activeStep === "investor" ? (
              <ReportStepShell number="1" title="Select Investor" description="Choose the investor for whom this monthly report is being prepared. Profile, Advisor, goals and existing holdings are inherited automatically.">
                <div className="grid gap-5">
                  <ReportOutputGuide stepId="investor" />
                  <ValueSourceLegend />
                  <InvestorSelectionStep investors={investorsForSelection} selectedInvestor={selectedInvestor} onSelect={handleInvestorChange} disabled={Boolean(reportId)} />
                </div>
              </ReportStepShell>
            ) : null}

            {activeStep === "period" ? (
              <ReportStepShell number="2" title="Reporting Period" description="Define the reporting month, statement date and report identity. The system checks for duplicate monthly reports before you continue.">
                <div className="grid gap-5">
                  <ReportOutputGuide stepId="period" />
                  <ValueSourceLegend />
                  <ReportingPeriodStep
                  form={form}
                  reportId={reportId}
                  fieldErrors={fieldErrors}
                  previousReport={previousReport}
                  duplicateReport={duplicateReport}
                  lookupLoading={periodLookupLoading}
                  copying={copying}
                  onUpdatePeriod={updatePeriod}
                  onTopLevelChange={setTopLevel}
                  onCopyPrevious={copyLatestReport}
                  periodLocked={isLocked}
                />
                </div>
              </ReportStepShell>
            ) : null}

            {activeStep === "portfolio-data" ? (
              <div className="grid gap-5">
                <StepPageIntro number="3" stepId="portfolio-data" showValueLegend icon={WalletCards} title="Portfolio Data" description="GrowVest generates the financial section from the latest verified Portfolio Master snapshot on or before the report date. Review source freshness, holding changes and cash-flow separation before continuing." />
                {form.portfolioVerification?.required ? (
                  <section className={`rounded-xl border p-4 sm:p-5 ${form.portfolioVerification.status === "blocked" ? "border-red-200 bg-red-50" : form.portfolioVerification.status === "review_required" ? "border-amber-200 bg-amber-50" : form.portfolioVerification.status === "ready" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {form.portfolioVerification.status === "ready" ? <CheckCircle2 size={19} className="text-emerald-700" /> : <AlertTriangle size={19} className={form.portfolioVerification.status === "blocked" ? "text-red-700" : "text-amber-700"} />}
                          <p className="text-sm font-black text-slate-950">Monthly Portfolio Verification</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">Portfolio verification as of {form.portfolioVerification.asOfDate || reportPortfolioAsOfDate(form.reportYear, form.reportMonth, form.statementDate)} · Snapshot {form.portfolioVerification.snapshotDate || "not available"}. A value source older than 7 days is flagged for review; data older than 31 days blocks completion.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${form.portfolioVerification.status === "ready" ? "bg-emerald-100 text-emerald-800" : form.portfolioVerification.status === "review_required" ? "bg-amber-100 text-amber-800" : form.portfolioVerification.status === "blocked" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
                          {form.portfolioVerification.status === "ready" ? "Ready" : form.portfolioVerification.status === "review_required" ? "Review required" : form.portfolioVerification.status === "blocked" ? "Blocked" : "Checking"}
                        </span>
                        <Button type="button" variant="secondary" onClick={refreshPortfolioVerification} disabled={portfolioSourceLoading}>Refresh verification</Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {(form.portfolioVerification.checks || []).map((check) => (
                        <div key={check.id} className="flex items-start gap-3 rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-slate-200/80">
                          {check.status === "pass" ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={17} className={`mt-0.5 shrink-0 ${check.status === "block" ? "text-red-600" : "text-amber-600"}`} />}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">{check.label}</p>
                            <p className="mt-0.5 text-xs leading-5 text-slate-600">{check.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {form.portfolioVerification.sourceFreshness?.length ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {form.portfolioVerification.sourceFreshness.map((item) => (
                          <div key={`${item.source}-${item.valuationDate}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{String(item.source || "Portfolio source").replaceAll("_", " ")}</p>
                            <p className="mt-1 text-sm font-bold text-slate-950">{item.valuationDate || "Date unavailable"}</p>
                            <p className={`mt-1 text-xs font-semibold ${item.status === "pass" ? "text-emerald-700" : item.status === "block" ? "text-red-700" : "text-amber-700"}`}>{item.ageDays === null || item.ageDays === undefined ? "Freshness unavailable" : item.ageDays === 0 ? "Report-date valuation" : `${item.ageDays} day${item.ageDays === 1 ? "" : "s"} before report date`}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Holdings", form.portfolioVerification.counts?.holdings || 0],
                        ["Transactions", form.portfolioVerification.counts?.transactions || 0],
                        ["New holdings", form.portfolioVerification.counts?.newHoldings || 0],
                        ["Exited holdings", form.portfolioVerification.counts?.exitedHoldings || 0]
                      ].map(([label, value]) => <div key={label} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200"><p className="text-[11px] font-semibold text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>)}
                    </div>

                    {form.portfolioVerification.status === "review_required" && !form.portfolioVerification.acknowledged ? (
                      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-amber-900">Review the warnings above. Confirming does not change Portfolio Master data; it records that the Advisor/Admin reviewed these source conditions for this monthly report.</p>
                        <Button type="button" onClick={acknowledgePortfolioVerification}>Confirm review</Button>
                      </div>
                    ) : form.portfolioVerification.acknowledged && form.portfolioVerification.status === "review_required" ? (
                      <p className="mt-4 text-xs font-bold text-emerald-700">✓ Verification warnings reviewed by {form.portfolioVerification.acknowledgedByName || "GrowVest staff"}.</p>
                    ) : null}
                  </section>
                ) : null}
                {portfolioSourceLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Checking the verified Portfolio Master for this reporting period…</div>
                ) : form.sourcePortfolioSnapshotId ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-emerald-950">Verified portfolio snapshot applied</p>
                      <p className="mt-1 text-xs leading-5 text-emerald-800">Portfolio as of {form.portfolioAsOfDate || form.statementDate}. {form.funds?.length || 0} active holdings populate this report. Verify values, then add advisor observations, recommendations and actions.</p>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">Verified portfolio</span>
                  </div>
                ) : null}
                {form.sourceImportId ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-blue-900">Portfolio values imported from {form.sourceImportFileName || "Bulk Data Upload"}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-700">{form.importedDataSummary?.sourceRowCount || form.funds?.length || 0} validated holdings were mapped to the summary, asset allocation and fund-wise details. Review before saving.</p>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-200">Imported data</span>
                  </div>
                ) : null}
            <Card id="report-summary" className="scroll-mt-28">
                    <SectionHeader number="2" title="Portfolio summary" description="All financial values are calculated automatically for the selected reporting month. Advisor entry is not required." />
                    <div className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
                      {[
                        ["totalCorpus", "Current Portfolio Value"],
                        ["lifetimeTarget", "Total Goal Target"],
                        ["overallProgress", "Goal Progress %"],
                        ["monthlySip", "Monthly SIP"],
                        ["newMoneyAdded", "Money Added This Month"],
                        ["totalWithdrawals", "Money Withdrawn This Month"],
                        ["investmentGain", "Portfolio Gain / Loss"]
                      ].map(([field, label]) => {
                        const readOnly = true;
                        return (
                          <Field key={field} label={label}>
                            <div className="grid gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={readOnly}
                                className={`${inputClassName} ${readOnly ? "border-emerald-200 bg-emerald-50/60 text-emerald-900" : ""}`}
                                value={form.summary?.[field] ?? 0}
                                onChange={(event) => { if (!readOnly) setSummary(field, event.target.value); }}
                              />
                              <span className={`text-[11px] font-semibold ${readOnly ? "text-emerald-700" : "text-blue-700"}`}>
                                {portfolioFactsLocked ? "Calculated from verified Portfolio Master" : field === "lifetimeTarget" || field === "overallProgress" ? "Calculated from Bucket List goals" : "Available automatically after a verified portfolio is selected"}
                              </span>
                            </div>
                          </Field>
                        );
                      })}
                    </div>
                  </Card>
            <Card id="report-monthly-changes" className="scroll-mt-28">
                    <SectionHeader number="2A" title="What changed this month" description="Detected automatically from Portfolio Master snapshots and confirmed transactions. Planned investor requests are shown later under Upcoming / Planned Actions and do not change these figures." />
                    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                      {(form.monthlyChanges || []).map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.title}</p><p className="mt-2 font-bold text-slate-950">{item.description || "Portfolio movement"}</p>{Number(item.amount || 0) ? <p className="mt-2 text-sm font-bold text-blue-700">{formatCurrency(item.amount)}</p> : null}{item.type?.startsWith("sip_") ? <p className="mt-1 text-xs text-slate-500">{formatCurrency(item.previousAmount || 0)} → {formatCurrency(item.amount || 0)} per month</p> : null}<p className="mt-2 text-[11px] font-semibold text-emerald-700">Confirmed portfolio activity</p></div>)}
                      {!(form.monthlyChanges || []).length ? <div className="sm:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No confirmed investment, SIP or external cash-flow change was detected for this reporting month.</div> : null}
                    </div>
                  </Card>
            <Card id="report-holdings" className="scroll-mt-28">
                    <SectionHeader number="3" title="Holdings breakdown" description={portfolioFactsLocked ? "Asset classes and values are fetched from the verified Portfolio Master. Correct portfolio facts at source, then refresh the report." : "Add asset classes for the report overview. Percentages recalculate from the total corpus."} action={portfolioFactsLocked ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Portfolio Master</span> : <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, holdings: [...(current.holdings || []), createEmptyHolding(current.holdings?.length || 0)] }))}><Plus size={16} /> Add asset class</Button>} />
                    <div className="grid gap-3 p-5">
                      {(form.holdings || []).map((item, index) => <div key={item.id || index} className={`grid gap-3 rounded-2xl border border-slate-200 p-4 ${portfolioFactsLocked ? "md:grid-cols-[1.2fr_1fr_1fr_90px]" : "md:grid-cols-[1.2fr_1fr_1fr_90px_44px]"} md:items-end`}><Field label="Asset class"><select disabled={portfolioFactsLocked} className={`${inputClassName} ${portfolioFactsLocked ? "bg-slate-50 text-slate-600" : ""}`} value={item.assetClass} onChange={(event) => updateArray("holdings", index, "assetClass", event.target.value)}>{ASSET_CLASS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Current value"><div className="grid gap-1.5"><input readOnly={portfolioFactsLocked} type="number" className={`${inputClassName} ${portfolioFactsLocked ? "border-emerald-200 bg-emerald-50/60 text-emerald-900" : ""}`} value={item.currentValue ?? 0} onChange={(event) => { if (!portfolioFactsLocked) updateArray("holdings", index, "currentValue", event.target.value); }} />{portfolioFactsLocked ? <span className="text-[11px] font-semibold text-emerald-700">Fetched from Portfolio Master</span> : null}</div></Field><Field label="Portfolio %"><div className="grid gap-1.5"><input readOnly type="number" step="0.1" className={`${inputClassName} border-emerald-200 bg-emerald-50/60 text-emerald-900`} value={item.percentage ?? 0} /><span className="text-[11px] font-semibold text-emerald-700">Calculated automatically</span></div></Field><Field label="Colour"><input type="color" className="h-11 w-full rounded-xl border border-slate-300 bg-white p-1" value={item.color || "#64748B"} onChange={(event) => updateArray("holdings", index, "color", event.target.value)} /></Field>{!portfolioFactsLocked ? <RemoveButton onClick={() => removeArrayRow("holdings", index)} /> : null}</div>)}
                      {!form.holdings?.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No holdings are available in the selected Portfolio Master snapshot.</p> : null}
                    </div>
                  </Card>
            <Card id="report-funds" className="scroll-mt-28">
                    <SectionHeader number="7" title="Investment-wise details" description={portfolioFactsLocked ? "Every investment is fetched from Portfolio Master and must map to a Bucket List goal or the default General Wealth bucket. Advisor notes remain editable." : "Review every mutual fund, delivery stock, ULIP or other instrument, its Bucket List/General Wealth allocation and current value."} action={portfolioFactsLocked ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Source values locked</span> : <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, funds: [...(current.funds || []), createEmptyFund(current.funds?.length || 0)] }))}><Plus size={16} /> Add fund</Button>} />
                    <div className="grid gap-4 p-5">
                      {(form.funds || []).map((fund, index) => <div key={fund.id || index} className="rounded-2xl border border-slate-200 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Fund / instrument"><input readOnly={portfolioFactsLocked} className={`${inputClassName} ${portfolioFactsLocked ? "bg-slate-50 text-slate-700" : ""}`} value={fund.instrumentName || ""} onChange={(event) => { if (!portfolioFactsLocked) updateArray("funds", index, "instrumentName", event.target.value); }} /></Field><Field label="Asset class"><select disabled={portfolioFactsLocked} className={`${inputClassName} ${portfolioFactsLocked ? "bg-slate-50 text-slate-700" : ""}`} value={fund.assetClass || "Other"} onChange={(event) => updateArray("funds", index, "assetClass", event.target.value)}>{ASSET_CLASS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Bucket List / default bucket"><div className="grid gap-1.5"><select disabled={portfolioFactsLocked && (!canModifyCurrentPortfolioBuckets || portfolioAllocationBusyId === fund.positionId)} className={`${inputClassName} ${portfolioFactsLocked && !canModifyCurrentPortfolioBuckets ? "bg-slate-50 text-slate-700" : ""}`} value={fund.goalId || ""} onChange={(event) => portfolioFactsLocked ? updatePortfolioBucketFromReport(fund, event.target.value) : updateArray("funds", index, "goalId", event.target.value)}><option value="">General Wealth (Default)</option>{(form.goals || []).map((goal) => <option key={goal.goalId} value={goal.goalId}>{goal.name || "Unnamed goal"}</option>)}</select>{portfolioFactsLocked ? <span className="text-[11px] font-semibold text-slate-500">{canModifyCurrentPortfolioBuckets ? (portfolioAllocationBusyId === fund.positionId ? "Updating Portfolio Master…" : "Changing this updates the live Portfolio Master, then refreshes the report.") : "Historical snapshot: allocation is frozen in this report."}</span> : null}</div></Field><Field label="Investment type"><select disabled={portfolioFactsLocked} className={`${inputClassName} ${portfolioFactsLocked ? "bg-slate-50 text-slate-700" : ""}`} value={fund.type || "Fixed"} onChange={(event) => updateArray("funds", index, "type", event.target.value)}><option>Fixed</option><option>Flexible</option><option>SIP</option><option>Lump Sum</option><option>Both</option><option>Delivery</option><option>ULIP</option></select></Field><Field label="Monthly SIP"><input readOnly={portfolioFactsLocked} type="number" className={`${inputClassName} ${portfolioFactsLocked ? "border-emerald-200 bg-emerald-50/60 text-emerald-900" : ""}`} value={fund.monthlySip ?? 0} onChange={(event) => { if (!portfolioFactsLocked) updateArray("funds", index, "monthlySip", event.target.value); }} /></Field><Field label="Current value"><input readOnly={portfolioFactsLocked} type="number" className={`${inputClassName} ${portfolioFactsLocked ? "border-emerald-200 bg-emerald-50/60 text-emerald-900" : ""}`} value={fund.currentValue ?? 0} onChange={(event) => { if (!portfolioFactsLocked) updateArray("funds", index, "currentValue", event.target.value); }} /></Field><Field label="Advisor report note"><input className={inputClassName} value={fund.notes || ""} onChange={(event) => updateArray("funds", index, "notes", event.target.value)} placeholder="Optional observation for this report" /></Field>{!portfolioFactsLocked ? <div className="flex items-end justify-end"><RemoveButton onClick={() => removeArrayRow("funds", index)} label="Remove fund" /></div> : <div className="flex items-end"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">{fund.bucketLabel || fund.goalName || "General Wealth (Default)"}</span></div>}</div></div>)}
                    </div>
                  </Card>
              </div>
            ) : null}

            {activeStep === "calculations" ? (
              <div className="grid gap-5">
                <StepPageIntro number="4" stepId="calculations" showValueLegend icon={Calculator} title="Review Calculations" description="Check the report totals before adding the monthly narrative. Calculated values are shown separately from entered values." />
                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {form.sourceImportId ? <CalculationMetric label="Opening Portfolio Value" value={formatCurrency(form.summary?.openingValue)} tone="slate" /> : null}
                    <CalculationMetric label="Closing Portfolio Value" value={formatCurrency(form.summary?.totalCorpus)} tone="blue" />
                    <CalculationMetric label="Asset-class total" value={formatCurrency(holdingsTotal)} tone="slate" />
                    <CalculationMetric label="Fund-wise total" value={formatCurrency(fundsTotal)} tone="slate" />
                    {form.sourceImportId ? <CalculationMetric label="Money Withdrawn" value={formatCurrency(form.summary?.totalWithdrawals)} tone="slate" /> : null}
                    <CalculationMetric label="Reconciliation difference" value={formatCurrency(corpusDifference)} tone={Math.abs(corpusDifference) < 1 ? "green" : "amber"} />
                  </div>
                  <div className={`mt-5 flex items-start gap-3 rounded-xl border p-4 ${Math.abs(corpusDifference) < 1 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                    {Math.abs(corpusDifference) < 1 ? <CheckCircle2 size={19} className="mt-0.5 shrink-0" /> : <AlertTriangle size={19} className="mt-0.5 shrink-0" />}
                    <div>
                      <p className="text-sm font-semibold">{Math.abs(corpusDifference) < 1 ? "Portfolio values are reconciled" : "Review the asset-class breakdown"}</p>
                      <p className="mt-1 text-sm leading-6 opacity-80">{Math.abs(corpusDifference) < 1 ? "The closing portfolio value and asset-class total match." : `The asset-class total differs from the closing portfolio value by ${formatCurrency(Math.abs(corpusDifference))}.`}</p>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {activeStep === "commentary" ? (
              <div className="grid gap-5">
                <StepPageIntro number="5" stepId="commentary" showValueLegend showInternal icon={FileCheck2} title="Commentary" description="Explain monthly performance, highlight progress and clearly separate priority attention from portfolio opportunities." />
            <Card id="report-insights" className="scroll-mt-28">
                    <SectionHeader number="4" title="Advisor note" description="Write the personal monthly commentary that will appear as the Advisor's note." action={<CommentaryLibraryPicker reportMonth={form.reportMonth} reportYear={form.reportYear} onApply={applyMarketCommentary} />} />
                    <div className="grid gap-5 p-5 xl:grid-cols-[1fr_320px]">
                      <Field label="Advisor narrative"><textarea rows="8" className={inputClassName} value={form.advisorInsights?.narrative || form.advisorNote?.content || ""} onChange={(event) => setForm((current) => ({ ...current, advisorNote: { ...current.advisorNote, content: event.target.value }, advisorInsights: { ...current.advisorInsights, narrative: event.target.value } }))} placeholder="Summarise progress, concerns and what needs attention next month." /></Field>
                      <Field label="Highlighted observation" hint="Optional key amount or short phrase"><textarea rows="8" className={inputClassName} value={form.advisorNote?.highlight || ""} onChange={(event) => setForm((current) => ({ ...current, advisorNote: { ...current.advisorNote, highlight: event.target.value } }))} placeholder="Example: Emergency fund is short by ₹2.1 lakh." /></Field>
                    </div>
                    <div className="grid gap-4 border-t border-slate-200 p-5 lg:grid-cols-3">
                      {[
                        ["progressHighlight", "Progress highlight", "Example: Europe Family Trip", "Example: 82.3% completed"],
                        ["priorityAttention", "Priority attention", "Example: Emergency Fund", "Example: ₹2.10 lakh short"],
                        ["portfolioOpportunity", "Portfolio opportunity", "Example: Allocation Review", "Example: Cash and liquid above target allocation"]
                      ].map(([key, label, titlePlaceholder, descriptionPlaceholder]) => (
                        <div key={key} className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-blue-700">{label}</p>
                          <Field label="Title"><input className={inputClassName} value={form.advisorInsights?.[key]?.title || ""} onChange={(event) => setForm((current) => ({ ...current, advisorInsights: { ...current.advisorInsights, [key]: { ...current.advisorInsights?.[key], title: event.target.value } } }))} placeholder={titlePlaceholder} /></Field>
                          <div className="mt-3"><Field label="Description"><textarea rows="3" className={inputClassName} value={form.advisorInsights?.[key]?.description || ""} onChange={(event) => setForm((current) => ({ ...current, advisorInsights: { ...current.advisorInsights, [key]: { ...current.advisorInsights?.[key], description: event.target.value } } }))} placeholder={descriptionPlaceholder} /></Field></div>
                        </div>
                      ))}
                    </div>
                    {(form.commentarySources || []).length ? (
                      <div className="border-t border-slate-200 bg-blue-50/50 p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Library sources used</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(form.commentarySources || []).map((source) => (
                            <span key={`${source.commentaryId}-${source.target}`} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-semibold text-blue-700">
                              {source.title} · v{source.version || 1}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">Copied content remains editable. Source references are stored with the draft for audit history.</p>
                      </div>
                    ) : null}
                    <div className="border-t border-slate-200 p-5"><Field label="Portfolio health observation" hint="Shown below the current versus target allocation bars"><textarea rows="4" className={inputClassName} value={form.portfolioHealth?.observation || ""} onChange={(event) => setForm((current) => ({ ...current, portfolioHealth: { ...current.portfolioHealth, observation: event.target.value } }))} placeholder="Describe allocation gaps, liquidity strengths or rebalancing needs." /></Field></div>
                    <div className="border-t border-slate-200 p-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-black text-slate-950">This Month at a Glance</p><p className="mt-1 text-xs text-slate-500">Optional custom highlights. When left blank, the report derives highlights automatically.</p></div><Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, monthlyHighlights: [...(current.monthlyHighlights || []), createEmptyHighlight(current.monthlyHighlights?.length || 0)].slice(0, 4) }))} disabled={(form.monthlyHighlights || []).length >= 4}><Plus size={16} /> Add highlight</Button></div>
                      <div className="mt-4 grid gap-4">{(form.monthlyHighlights || []).map((item, index) => <div key={item.id || index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[190px_1fr_1.4fr_44px] md:items-end"><Field label="Highlight type"><select className={inputClassName} value={item.type || "info"} onChange={(event) => updateArray("monthlyHighlights", index, "type", event.target.value)}>{HIGHLIGHT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field><Field label="Title"><input className={inputClassName} value={item.title || ""} onChange={(event) => updateArray("monthlyHighlights", index, "title", event.target.value)} /></Field><Field label="Description"><input className={inputClassName} value={item.description || ""} onChange={(event) => updateArray("monthlyHighlights", index, "description", event.target.value)} /></Field><RemoveButton onClick={() => removeArrayRow("monthlyHighlights", index)} label="Remove highlight" /></div>)}</div>
                    </div>
                  </Card>
              </div>
            ) : null}

            {activeStep === "goals" ? (
              <div className="grid gap-5">
                <StepPageIntro number="6" stepId="goals" showValueLegend icon={WalletCards} title="Goals & Allocation" description="Review specific financial goals when they exist, or retain the portfolio under General Wealth Corpus. Bucket Lists are optional." />
            <Card id="report-goals" className="scroll-mt-28">
                    <SectionHeader number="5" title="Goal & corpus progress" description="Track specific financial goals when defined. Investors without goals continue under General Wealth Corpus." action={<Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, goals: [...(current.goals || []), { goalId: `goal-${Date.now()}`, name: "", category: "", type: "Flexible", targetAmount: 0, currentAmount: 0, monthlySip: 0, targetYear: null, status: "Planning", progress: 0, isPrimary: false }] }))}><Plus size={16} /> Add goal</Button>} />
                    <div className="grid gap-4 p-5">
                      {!form.goals?.length ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm font-bold text-blue-950">General Wealth Corpus</p>
                          <p className="mt-1 text-sm leading-6 text-blue-800">No specific financial goal is required for this investor. {formatCurrency(form.summary?.generalWealthCorpus || form.summary?.totalCorpus)} remains tracked as general wealth and may be allocated to goals later.</p>
                        </div>
                      ) : null}
                      {(form.goals || []).map((goal, index) => <div key={goal.goalId || index} className="rounded-2xl border border-slate-200 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Goal name"><input className={inputClassName} value={goal.name || ""} onChange={(event) => updateArray("goals", index, "name", event.target.value)} /></Field><Field label="Goal category"><input className={inputClassName} value={goal.category || ""} onChange={(event) => updateArray("goals", index, "category", event.target.value)} placeholder="Education / Retirement / Travel" /></Field><Field label="Type"><select className={inputClassName} value={goal.type || "Flexible"} onChange={(event) => updateArray("goals", index, "type", event.target.value)}><option>Fixed</option><option>Flexible</option></select></Field><Field label="Target amount"><input type="number" className={inputClassName} value={goal.targetAmount ?? 0} onChange={(event) => updateArray("goals", index, "targetAmount", event.target.value)} /></Field><Field label="Current amount"><input type="number" className={inputClassName} value={goal.currentAmount ?? 0} onChange={(event) => updateArray("goals", index, "currentAmount", event.target.value)} /></Field><Field label="Monthly SIP"><input type="number" className={inputClassName} value={goal.monthlySip ?? 0} onChange={(event) => updateArray("goals", index, "monthlySip", event.target.value)} /></Field><Field label="Target year"><input type="number" className={inputClassName} value={goal.targetYear || ""} onChange={(event) => updateArray("goals", index, "targetYear", event.target.value ? Number(event.target.value) : null)} /></Field><Field label="Status"><select className={inputClassName} value={goal.status || "Planning"} onChange={(event) => updateArray("goals", index, "status", event.target.value)}>{GOAL_STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Progress %"><div className="grid gap-1.5"><input readOnly type="number" step="0.1" className={`${inputClassName} border-emerald-200 bg-emerald-50/60 text-emerald-900`} value={goal.progress ?? 0} /><span className="text-[11px] font-semibold text-emerald-700">Calculated automatically</span></div></Field></div><div className="mt-3 flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(goal.isPrimary)} onChange={(event) => updateArray("goals", index, "isPrimary", event.target.checked)} /> Primary goal</label><RemoveButton onClick={() => removeArrayRow("goals", index)} label="Remove goal" /></div></div>)}
                    </div>
                  </Card>
            <Card id="report-allocation" className="scroll-mt-28">
                    <SectionHeader number="6" title="Portfolio allocation" description="Compare current and target asset allocation. Variance is calculated automatically." action={<Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, allocation: [...(current.allocation || []), createEmptyAllocation(current.allocation?.length || 0)] }))}><Plus size={16} /> Add allocation</Button>} />
                    <div className="grid gap-3 p-5">
                      {(form.allocation || []).map((item, index) => <div key={item.id || index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_110px_44px] xl:items-end"><Field label="Asset class"><select className={inputClassName} value={item.assetClass} onChange={(event) => updateArray("allocation", index, "assetClass", event.target.value)}>{ASSET_CLASS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Current value"><input type="number" className={inputClassName} value={item.currentValue ?? 0} onChange={(event) => updateArray("allocation", index, "currentValue", event.target.value)} /></Field><Field label="Monthly SIP"><input type="number" className={inputClassName} value={item.monthlySip ?? 0} onChange={(event) => updateArray("allocation", index, "monthlySip", event.target.value)} /></Field><Field label="Current %"><div className="grid gap-1.5"><input readOnly type="number" step="0.1" className={`${inputClassName} border-emerald-200 bg-emerald-50/60 text-emerald-900`} value={item.currentPercentage ?? 0} /><span className="text-[11px] font-semibold text-emerald-700">Calculated automatically</span></div></Field><Field label="Target %"><input type="number" step="0.1" className={inputClassName} value={item.targetPercentage ?? 0} onChange={(event) => updateArray("allocation", index, "targetPercentage", event.target.value)} /></Field><Field label="Variance"><div className="grid gap-1.5"><input readOnly className={`${inputClassName} border-emerald-200 bg-emerald-50/60 text-emerald-900`} value={`${Number(item.variance || 0).toFixed(1)}%`} /><span className="text-[11px] font-semibold text-emerald-700">Calculated automatically</span></div></Field><RemoveButton onClick={() => removeArrayRow("allocation", index)} /></div>)}
                      {!form.allocation?.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No allocation comparison added.</p> : null}
                    </div>
                  </Card>
              </div>
            ) : null}

            {activeStep === "template" ? (
              <div className="grid gap-5">
                <StepPageIntro number="7" stepId="template" icon={LayoutTemplate} title="Select Template" description="Choose the active template used for this report. A versioned snapshot is stored so future template edits cannot change this report." />
                <ReportTemplateSelectionStep
                  templates={reportTemplates}
                  selectedTemplateId={form.templateId}
                  selectedTemplateVersion={form.templateVersion || form.templateSnapshot?.version}
                  onSelect={selectReportTemplate}
                  disabled={isLocked}
                />
                {form.templateSnapshot ? (
                  <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Selected output</p>
                        <h3 className="mt-1 font-heading text-lg font-bold text-blue-950">{form.templateSnapshot.name}</h3>
                        <p className="mt-1 text-sm text-blue-800">Version {form.templateVersion || form.templateSnapshot.version || 1} · {form.templateSnapshot.estimatedPages || "6–9 pages"} · {form.templateSnapshot.sectionOrder.filter((key) => form.templateSnapshot.sectionVisibility?.[key] !== false).length} visible sections</p>
                        <p className="mt-1 text-xs font-semibold text-blue-700">Email: {form.templateSnapshot.delivery?.emailTemplateName || "Monthly Report Ready — Premium"} · {SIGNATURE_SOURCE_LABELS[form.templateSnapshot.delivery?.signatureSource] || "Assigned Advisor's published signature"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a href={`/report-templates/${form.templateId}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700"><Eye size={16} /> Preview template</a>
                        {workingReportId ? <button type="button" onClick={() => handleSave(false, { redirectToPreview: true })} disabled={saving || isLocked} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"><Eye size={16} /> Save & preview report</button> : null}
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {activeStep === "approval" ? (
              <div className="grid gap-5">
                <StepPageIntro number="8" stepId="approval" showValueLegend showInternal icon={FileCheck2} title="Preview & Approval" description="Confirm next steps, compliance text and completion validation before creating the finished report." />
                <section className={`rounded-xl border p-4 ${completionIssues.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <div className="flex items-start gap-3">
                    {completionIssues.length ? <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-700" /> : <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-700" />}
                    <div>
                      <p className={`text-sm font-semibold ${completionIssues.length ? "text-amber-950" : "text-emerald-950"}`}>{completionIssues.length ? "Report needs attention before completion" : "Report is ready to complete"}</p>
                      {completionIssues.length ? <ul className="mt-2 grid gap-1 text-sm text-amber-800">{completionIssues.map((issue) => <li key={issue}>• {issue}</li>)}</ul> : <p className="mt-1 text-sm text-emerald-800">All required report content is present. Complete the report to continue to PDF generation.</p>}
                    </div>
                  </div>
                </section>
            <Card id="report-actions" className="scroll-mt-28">
                    <SectionHeader number="8A" title="Investor Profile actions" description="Auto-fetched and read-only. Planned withdrawals, SIP changes, new investments and other Investor Profile actions are shown here without re-entering them in the report." />
                    <div className="grid gap-3 p-5">
                      {(form.profileActions || []).length ? (form.profileActions || []).map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-heading text-base font-bold text-slate-950">{item.title || item.requestType || "Investor action"}</p><p className="mt-1 text-xs font-semibold text-blue-700">{item.requestType || item.recommendationType || "Portfolio action"} · {item.status || "Requested"}</p>{item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}</div>{item.requestedEffectiveDate ? <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">Planned {item.requestedEffectiveDate}</span> : null}</div>{isStructuredWithdrawalAction(item) ? <WithdrawalActionSummary action={item} /> : <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">{Number(item.requestedAmount || 0) ? <span className="rounded-full bg-white px-2.5 py-1">Amount {formatCurrency(item.requestedAmount)}</span> : null}{Number(item.requestedMonthlyAmount || 0) ? <span className="rounded-full bg-white px-2.5 py-1">Monthly {formatCurrency(item.requestedMonthlyAmount)}</span> : null}{item.relatedGoalName ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">{item.relatedGoalName}</span> : null}</div>}</div>) : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No Investor Profile actions are relevant to this reporting period.</div>}
                    </div>
                    <SectionHeader number="8B" title="Advisor recommendations & next steps" description="Advisor commentary and recommendations only. Withdrawal figures are not entered here; they come from Investor Profile actions and confirmed Portfolio Master transactions." action={<Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, nextSteps: [...(current.nextSteps || []), createEmptyAction(current.nextSteps?.length || 0)] }))}><Plus size={16} /> Add next step</Button>} />
                    <div className="grid gap-4 p-5">
                      {(form.nextSteps || []).map((item, index) => <div key={item.id || index} className="rounded-2xl border border-slate-200 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Recommendation / action"><input className={inputClassName} value={item.title || ""} onChange={(event) => updateArray("nextSteps", index, "title", event.target.value)} placeholder="Increase SIP by ₹5,000" /></Field><Field label="Recommendation type"><select className={inputClassName} value={item.recommendationType || "Portfolio Review"} onChange={(event) => updateArray("nextSteps", index, "recommendationType", event.target.value)}>{RECOMMENDATION_TYPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Priority"><select className={inputClassName} value={item.priority || "Planned"} onChange={(event) => updateArray("nextSteps", index, "priority", event.target.value)}>{ACTION_PRIORITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Owner"><select className={inputClassName} value={item.owner || "Advisor"} onChange={(event) => updateArray("nextSteps", index, "owner", event.target.value)}>{ACTION_OWNER_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Status"><select className={inputClassName} value={item.status || "Recommended"} onChange={(event) => updateArray("nextSteps", index, "status", event.target.value)}>{ACTION_STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Investor decision"><select className={inputClassName} value={item.investorDecision || "Pending Discussion"} onChange={(event) => updateArray("nextSteps", index, "investorDecision", event.target.value)}>{INVESTOR_DECISION_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Linked goal"><select className={inputClassName} value={item.relatedGoalId || ""} onChange={(event) => updateArray("nextSteps", index, "relatedGoalId", event.target.value)}><option value="">General Wealth (Default)</option>{(form.goals || []).map((goal) => <option key={goal.goalId} value={goal.goalId}>{goal.name || "Unnamed goal"}</option>)}</select></Field><Field label="Linked investment"><select className={inputClassName} value={item.relatedInvestmentId || ""} onChange={(event) => updateArray("nextSteps", index, "relatedInvestmentId", event.target.value)}><option value="">No specific investment</option>{(form.funds || []).map((fund) => <option key={fund.id} value={fund.positionId || fund.id}>{fund.instrumentName || "Investment"}</option>)}</select></Field><Field label="Action description"><input className={inputClassName} value={item.description || ""} onChange={(event) => updateArray("nextSteps", index, "description", event.target.value)} /></Field><Field label="Due date"><input type="date" className={inputClassName} value={item.dueDate || ""} onChange={(event) => updateArray("nextSteps", index, "dueDate", event.target.value)} /></Field><Field label="Completion date"><input type="date" className={inputClassName} value={item.completionDate || ""} onChange={(event) => updateArray("nextSteps", index, "completionDate", event.target.value)} /></Field><div className="flex items-end justify-end"><RemoveButton onClick={() => removeArrayRow("nextSteps", index)} label="Remove next step" /></div></div>{Number(item.requestedAmount || 0) || Number(item.requestedMonthlyAmount || 0) || item.requestedEffectiveDate || item.requestedTargetGoalName || item.requestedAccountReference || (item.financialImpactType && item.financialImpactType !== "none") ? <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">{Number(item.requestedAmount || 0) ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Requested {formatCurrency(item.requestedAmount)}</span> : null}{Number(item.requestedMonthlyAmount || 0) ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Monthly {formatCurrency(item.requestedMonthlyAmount)}</span> : null}{item.requestedEffectiveDate ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Preferred {item.requestedEffectiveDate}</span> : null}{item.requestedTargetGoalName ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Target {item.requestedTargetGoalName}</span> : null}{item.requestedAccountReference ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Account {item.requestedAccountReference}</span> : null}{item.financialImpactType && item.financialImpactType !== "none" ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">{item.financialImpactStatus === "awaiting_portfolio_confirmation" ? "Awaiting portfolio confirmation" : "Planned only · excluded from report cash flows"}</span> : null}</div> : null}{item.sourceReportMonthKey ? <p className="mt-3 text-xs font-semibold text-amber-700">Carried forward from {item.sourceReportMonthKey}</p> : null}</div>)}
                      <div className="grid gap-5 rounded-2xl bg-slate-50 p-5 md:grid-cols-3"><Field label="Next review date"><input type="date" className={inputClassName} value={form.nextReview?.date || ""} onChange={(event) => setForm((current) => ({ ...current, nextReview: { ...current.nextReview, date: event.target.value } }))} /></Field><Field label="Meeting mode"><input className={inputClassName} value={form.nextReview?.mode || ""} onChange={(event) => setForm((current) => ({ ...current, nextReview: { ...current.nextReview, mode: event.target.value } }))} placeholder="In person / Teams / Google Meet" /></Field><Field label="Review note"><input className={inputClassName} value={form.nextReview?.note || ""} onChange={(event) => setForm((current) => ({ ...current, nextReview: { ...current.nextReview, note: event.target.value } }))} /></Field></div>
                    </div>
                  </Card>
            <Card id="report-disclaimer" className="scroll-mt-28">
                    <SectionHeader number="9" title="Report disclaimer" description="This text will appear in the final branded report." />
                    <div className="p-5"><Field label="Disclaimer"><textarea rows="5" className={inputClassName} value={form.disclaimer || DEFAULT_REPORT_DISCLAIMER} onChange={(event) => setTopLevel("disclaimer", event.target.value)} /></Field></div>
                  </Card>
              </div>
            ) : null}

            {activeStep === "pdf" ? (
              <ReportStepShell number="9" title="Generate Secure PDF" description="PDF generation becomes available after the working report is completed.">
                <div className="grid gap-5">
                  <ReportOutputGuide stepId="pdf" />
                  <LockedFutureStep title="Complete the report first" description="The secure PDF is generated from the approved HTML report on the report review page." actionLabel="Open report review" href={workingReportId ? `/reports/${workingReportId}` : null} />
                </div>
              </ReportStepShell>
            ) : null}

            {activeStep === "delivery" ? (
              <ReportStepShell number="10" title="Deliver Report" description="Publish the approved version to the Investor Portal and send the secure report by email.">
                <div className="grid gap-5">
                  <ReportOutputGuide stepId="delivery" />
                  <LockedFutureStep title="PDF required before delivery" description="Complete the report and generate its secure PDF before publishing or emailing the investor." actionLabel="Open report review" href={workingReportId ? `/reports/${workingReportId}` : null} />
                </div>
              </ReportStepShell>
            ) : null}

            <ReportWorkflowActions
              stepIndex={activeStepIndex}
              totalSteps={workflowSteps.length}
              canGoBack={activeStepIndex > 0}
              canContinue={canContinue}
              isLocked={isLocked}
              saving={saving}
              canSave={canSaveDraft}
              primaryLabel={primaryActionLabel}
              onBack={goBackStep}
              onSave={() => handleSave(false)}
              onContinue={continueWorkflow}
            />
          </main>

          <ReportSummaryPanel form={form} progress={readinessProgress} validationIssues={completionIssues} activeStep={activeStep} />
        </div>
      </div>
    </div>
  );
}

function CalculationMetric({ label, value, tone = "slate" }) {
  const tones = {
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800"
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] opacity-70">Calculated from current report data</p>
    </div>
  );
}
