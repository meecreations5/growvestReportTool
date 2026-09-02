"use client";

import {
  allocationStatus,
  buildTrendData,
  compactCurrency,
  deriveAdvisorInsights,
  derivePortfolioHealth,
  deriveReportHighlights,
  deriveReportTransactions,
  goalDisplayStatus,
  holdingColor,
  initials,
  investorFacingAdvisorDesignation,
  previousReportFor
} from "@/lib/utils/reportPresentation";
import { formatDate } from "@/lib/utils/format";
import { getMonthLabel } from "@/lib/constants/report";
import { resolveReportTemplate } from "@/lib/constants/reportTemplates";
import ReportDonutChart from "@/components/reports/ReportDonutChart";
import ReportTrendChart from "@/components/reports/ReportTrendChart";
import { useBranding } from "@/contexts/BrandingContext";
import { resolveReportBranding } from "@/lib/utils/reportBranding";
import { PdfPage as Page } from "@/components/pdf/PdfDocumentShell";

function chunks(items = [], size = 8) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result.length ? result : [[]];
}

function textChunks(value = "", maximumWords = 170) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const pages = [];
  for (let index = 0; index < words.length; index += maximumWords) pages.push(words.slice(index, index + maximumWords).join(" "));
  return pages;
}

function GoalPrintCard({ goal }) {
  const attention = String(goal.status || "").toLowerCase().includes("review");
  return (
    <article className={`report-goal-card ${attention ? "is-attention" : ""}`}>
      <div className="flex justify-between gap-3">
        <div className="min-w-0"><h3>{goal.name}</h3><p>{goal.category || "Financial Goal"} · {goal.type}</p></div>
        <span className="report-pill shrink-0">{goalDisplayStatus(goal)}</span>
      </div>
      <div className="mt-4 flex items-end gap-3"><strong className="text-3xl">{Number(goal.progress || 0).toFixed(1)}%</strong><div className="mb-2 h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={attention ? "h-full bg-red-500" : "h-full bg-[var(--report-primary)]"} style={{ width: `${Math.min(100, Number(goal.progress || 0))}%` }} /></div></div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs"><div><span>TARGET</span><strong>{compactCurrency(goal.targetAmount)}</strong></div><div><span>CURRENT</span><strong>{compactCurrency(goal.currentAmount)}</strong></div><div><span>MONTHLY SIP</span><strong>{Number(goal.monthlySip || 0) ? compactCurrency(goal.monthlySip) : "—"}</strong></div></div>
      <p className="mt-3 text-xs text-slate-400">Target year: {goal.targetYear || "—"}</p>
    </article>
  );
}

function EmptyPrintState({ children }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">{children}</div>;
}

function ReportTable({ headers, children }) {
  return (
    <div className="report-table-wrap mt-5 overflow-hidden rounded-2xl border border-slate-200">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-[var(--report-dark)] text-white"><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function MonthlyReportPrintDocument({ report, history = [] }) {
  const { branding: liveBranding } = useBranding();
  const branding = resolveReportBranding(report, liveBranding);
  const template = resolveReportTemplate(report);
  const appearance = template.appearance || {};
  const documentSettings = appearance.document || {};
  const visible = (key) => template.sectionVisibility?.[key] !== false;
  const summary = report.summary || {};
  const goals = report.goals || [];
  const hasGoals = goals.length > 0;
  const tradingSummary = report.tradingSummary || null;
  const transactions = deriveReportTransactions(report);
  const monthlyChanges = Array.isArray(report.monthlyChanges) ? report.monthlyChanges : [];
  const insights = deriveAdvisorInsights(report);
  const baseHighlights = deriveReportHighlights(report);
  const health = derivePortfolioHealth(report);
  const trend = buildTrendData(report, history);
  const previous = previousReportFor(report, history);
  const portfolioGainLoss = Number(summary.investmentGain || 0);
  const highlights = previous
    ? [{
        id: "portfolio-gain-loss",
        title: "Portfolio gain / loss",
        description: `${portfolioGainLoss >= 0 ? "Gain" : "Loss"} of ${compactCurrency(Math.abs(portfolioGainLoss))} from investment performance, excluding confirmed money added or withdrawn.`
      }, ...baseHighlights].slice(0, 4)
    : baseHighlights.slice(0, 4);
  const advisorDesignation = investorFacingAdvisorDesignation(report.advisorDesignation);
  const advisorOrganization = branding.legalName || branding.companyName || "GrowVest Advisors Private Limited";
  const pages = [];
  let pageNumber = 1;

  function addPage(key, title, content, className = "") {
    pages.push(<Page key={`${key}-${pageNumber}`} report={report} number={pageNumber++} title={title} className={className}>{content}</Page>);
  }

  const renderers = {
    cover() {
      addPage("cover", undefined, (
        <div className={`report-cover report-cover-${appearance.coverStyle || "premium-dark"}`} style={branding.coverBackgroundUrl ? { backgroundImage: `linear-gradient(rgba(255,255,255,.94), rgba(255,255,255,.94)), url(${branding.coverBackgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: "18px", padding: "22px" } : undefined}>
          {documentSettings.showConfidentialLabel !== false && branding.showConfidentialLabel !== false ? <p className="report-cover-confidential">{branding.confidentialLabel || "Confidential client report"}</p> : null}
          <p className="report-cover-kicker">MONTHLY WEALTH PROGRESS REPORT</p>
          <h1>{getMonthLabel(report.reportMonth)}<br />{report.reportYear}</h1>
          <p className="report-cover-subtitle">{branding.tagline || branding.brandPositioning || "Your Conscious Wealth Partner"}</p>
          <p className="report-cover-date">Statement date · {formatDate(report.statementDate)}</p>
          <div className={`report-cover-people ${appearance.advisorCardVisible === false ? "grid-cols-1" : ""}`}>
            <div><p>PREPARED FOR</p><div className="flex items-center gap-4"><span className="report-avatar is-dark">{initials(report.investorName)}</span><div><strong>{report.investorName}</strong>{documentSettings.showClientCode !== false ? <span>Client ID · {report.clientCode}</span> : null}</div></div></div>
            {appearance.advisorCardVisible !== false ? <div><p>YOUR ADVISOR</p><div className="flex items-center gap-4"><span className="report-avatar is-blue">{initials(report.advisorName)}</span><div><strong>{report.advisorName || `${branding.companyName || "GrowVest"} Advisor`}</strong><span>{advisorDesignation}</span></div></div></div> : null}
          </div>
          <div className="report-cover-summary"><div><span>Total Portfolio</span><strong>{compactCurrency(summary.totalCorpus)}</strong></div><div><span>Monthly SIP</span><strong>{compactCurrency(summary.monthlySip)}</strong></div><div><span>{hasGoals ? "Overall Goal Progress" : "General Wealth Corpus"}</span><strong>{hasGoals ? `${Number(summary.overallProgress || 0).toFixed(1)}%` : compactCurrency(summary.generalWealthCorpus || summary.totalCorpus)}</strong></div></div>
        </div>
      ));
    },
    executiveSummary() {
      addPage("summary", "EXECUTIVE SUMMARY", (
        <>
          <div className="report-dark-kpi"><div><p>TOTAL PORTFOLIO VALUE</p><strong>{compactCurrency(summary.totalCorpus)}</strong><span>{hasGoals ? `of ${compactCurrency(summary.lifetimeTarget)} combined goal target` : "latest verified investment corpus"}</span></div><div className="text-right"><p>{hasGoals ? "OVERALL GOAL PROGRESS" : "GENERAL WEALTH CORPUS"}</p><strong className="text-[var(--report-secondary)]">{hasGoals ? `${Number(summary.overallProgress || 0).toFixed(1)}%` : compactCurrency(summary.generalWealthCorpus || summary.totalCorpus)}</strong><span>{hasGoals ? "across financial goals" : "no specific goal assigned"}</span></div>{hasGoals ? <div className="col-span-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[var(--report-primary)]" style={{ width: `${Math.min(100, Number(summary.overallProgress || 0))}%` }} /></div> : null}</div>
          <div className="mt-5 grid grid-cols-4 gap-3"><div className="report-stat"><span>MONTHLY SIP</span><strong>{compactCurrency(summary.monthlySip)}</strong><p>current running SIP</p></div><div className="report-stat"><span>MONEY ADDED</span><strong>{compactCurrency(summary.newMoneyAdded)}</strong><p>confirmed external inflow</p></div><div className="report-stat"><span>MONEY WITHDRAWN</span><strong>{compactCurrency(summary.totalWithdrawals)}</strong><p>confirmed external outflow</p></div><div className="report-stat"><span>PORTFOLIO GAIN / LOSS</span><strong>{compactCurrency(summary.investmentGain)}</strong><p>investment performance only</p></div></div>
          <div className="mt-7 report-panel"><h3>PORTFOLIO COMPOSITION</h3><div className="mt-4"><ReportDonutChart holdings={report.holdings || []} total={summary.totalCorpus} /></div></div>
        </>
      ));
    },
    performance() {
      addPage("performance", "PORTFOLIO PERFORMANCE", (
        <div className="grid gap-5">
          <div className="report-panel"><h3>PORTFOLIO VALUE TREND</h3><div className="mt-4"><ReportTrendChart data={trend} /></div></div>
          <div className="report-panel"><h3>WHAT CHANGED THIS MONTH</h3><p className="mt-1 text-xs text-slate-500">Confirmed portfolio activity only. Planned investor requests are shown separately under Upcoming / Planned Actions.</p><div className="mt-4 grid grid-cols-2 gap-3">{monthlyChanges.length ? monthlyChanges.slice(0, 8).map((item, index) => <div key={item.id || index} className="rounded-xl bg-slate-50 p-3"><strong>{item.title || "Portfolio change"}</strong><p className="mt-1 text-sm text-slate-600">{item.description || "Confirmed portfolio activity"}{Number(item.amount || 0) ? ` · ${compactCurrency(item.amount)}` : ""}{Number(item.previousAmount || 0) && Number(item.amount || 0) ? ` (from ${compactCurrency(item.previousAmount)})` : ""}</p></div>) : <div className="col-span-2"><EmptyPrintState>No confirmed portfolio changes were recorded for this reporting month.</EmptyPrintState></div>}</div></div>
          <div className="report-panel"><h3>THIS MONTH AT A GLANCE</h3><div className="mt-4 grid grid-cols-2 gap-3">{highlights.length ? highlights.map((item, index) => <div key={item.id || index} className="rounded-xl bg-slate-50 p-3"><strong>{item.title}</strong><p className="mt-1 text-sm text-slate-600">{item.description}</p></div>) : <div className="col-span-2"><EmptyPrintState>No monthly performance highlights were recorded.</EmptyPrintState></div>}</div></div>
        </div>
      ));
    },
    performanceTrend() {
      if (!visible("performance")) this.performance();
    },
    goals() {
      chunks(goals, 6).forEach((pageGoals, index) => addPage(`goals-${index}`, index === 0 ? (hasGoals ? "GOALS & BUCKET LIST PROGRESS" : "GENERAL WEALTH CORPUS") : "GOAL PROGRESS — CONTINUED", <><p className="report-intro">{hasGoals ? "Every financial goal in your plan, its target and how close you are today." : "Investments not linked to a specific Bucket List are mapped to General Wealth (Default)."}</p><div className="mt-5 grid grid-cols-2 gap-4">{pageGoals.length ? pageGoals.map((goal) => <GoalPrintCard key={goal.goalId || goal.id || goal.name} goal={goal} />) : <div className="col-span-2"><EmptyPrintState>General Wealth (Default): <strong>{compactCurrency(summary.generalWealthCorpus || summary.totalCorpus)}</strong>. This is the default bucket until a specific Bucket List allocation is chosen.</EmptyPrintState></div>}</div></>));
    },
    allocation() {
      addPage("allocation-summary", "PORTFOLIO ALLOCATION", <><div className="grid grid-cols-4 gap-3"><div className="report-health-stat"><span>Diversification</span><strong>{health.needsRebalancing ? "Needs Rebalancing" : "On Track"}</strong></div><div className="report-health-stat"><span>Growth Assets</span><strong>{health.growth.toFixed(1)}%</strong></div><div className="report-health-stat"><span>Stable &amp; Liquid</span><strong>{health.stable.toFixed(1)}%</strong></div><div className="report-health-stat"><span>Allocation Gaps</span><strong>{health.gaps} classes</strong></div></div><div className="mt-6 grid gap-4">{(report.allocation || []).slice(0, 8).map((item) => <div key={item.id || item.assetClass} className="grid grid-cols-[110px_1fr_190px] items-center gap-4"><strong>{item.assetClass}</strong><div className="relative h-5 overflow-hidden rounded-full bg-slate-100"><div className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${Math.min(100, Number(item.targetPercentage || 0))}%`, backgroundColor: holdingColor(item) }} /><div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, Number(item.currentPercentage || 0))}%`, backgroundColor: holdingColor(item) }} /></div><div className="grid grid-cols-3 text-right text-sm"><span>{Number(item.currentPercentage || 0).toFixed(1)}%</span><span className="text-slate-400">{Number(item.targetPercentage || 0).toFixed(1)}%</span><strong className={Math.abs(Number(item.variance || 0)) < 1 ? "text-emerald-600" : "text-red-600"}>{Number(item.variance || 0) > 0 ? "+" : ""}{Number(item.variance || 0).toFixed(1)}%</strong></div></div>)}</div><div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7"><strong className="text-amber-600">Observation:</strong> {health.observation}</div></>);

      chunks(report.allocation || [], appearance.tableDensity === "compact" ? 13 : 10).forEach((pageAllocation, index) => addPage(`allocation-table-${index}`, index === 0 ? "ALLOCATION DETAILS" : "ALLOCATION DETAILS — CONTINUED", pageAllocation.length ? <ReportTable headers={["Asset Class", "Current Value", "Monthly SIP", "Current", "Target", "Variance", "Status"]}>{pageAllocation.map((item) => { const status = allocationStatus(item); return <tr key={item.id || item.assetClass}><td><strong>{item.assetClass}</strong></td><td>{compactCurrency(item.currentValue)}</td><td>{Number(item.monthlySip || 0) ? compactCurrency(item.monthlySip) : "—"}</td><td>{Number(item.currentPercentage || 0).toFixed(1)}%</td><td>{Number(item.targetPercentage || 0).toFixed(1)}%</td><td>{Number(item.variance || 0) > 0 ? "+" : ""}{Number(item.variance || 0).toFixed(1)}%</td><td>{status.label}</td></tr>; })}</ReportTable> : <EmptyPrintState>No asset-allocation data was included in this report.</EmptyPrintState>));
    },
    holdings() {
      chunks(report.funds || [], appearance.tableDensity === "compact" ? 11 : 8).forEach((pageFunds, index) => addPage(`holdings-${index}`, index === 0 ? "DETAILED HOLDINGS" : "DETAILED HOLDINGS — CONTINUED", <><p className="report-intro">Every investment in your portfolio, its goal or General Wealth assignment, and its current value.</p>{pageFunds.length ? <ReportTable headers={["Investment / Instrument", "Class", "Goal / Corpus", "SIP", "Value", "Weight", "Type"]}>{pageFunds.map((item) => { const weight = summary.totalCorpus ? Number(item.currentValue || 0) / Number(summary.totalCorpus) * 100 : 0; return <tr key={item.id || item.instrumentName}><td><strong>{item.instrumentName}</strong>{item.productType === "ulip" && item.policyNumber ? <><br /><span>Policy {item.policyNumber}{item.fundCode ? ` · ${item.fundCode}` : ""}</span></> : null}</td><td>{item.assetClass}</td><td>{item.bucketLabel || item.goalName || "General Wealth (Default)"}</td><td>{Number(item.monthlySip || 0) ? compactCurrency(item.monthlySip) : "—"}</td><td><strong>{compactCurrency(item.currentValue)}</strong></td><td>{weight.toFixed(1)}%</td><td>{item.type}</td></tr>; })}</ReportTable> : <EmptyPrintState>No investment holdings were included in this report.</EmptyPrintState>}</>));
      if (tradingSummary && Number(tradingSummary.totalTrades || 0) > 0) addPage("trading-summary", "STOCK INTRADAY TRADING", <><p className="report-intro">Monthly intraday performance is shown separately and is not automatically included in long-term goal corpus.</p><div className="grid grid-cols-4 gap-4"><div className="report-stat"><span>TOTAL TRADES</span><strong>{Number(tradingSummary.totalTrades || 0)}</strong><p>{Number(tradingSummary.winningTrades || 0)} winning · {Number(tradingSummary.losingTrades || 0)} losing</p></div><div className="report-stat"><span>GROSS P&amp;L</span><strong>{compactCurrency(tradingSummary.grossPnl || 0)}</strong><p>before charges</p></div><div className="report-stat"><span>CHARGES</span><strong>{compactCurrency(tradingSummary.totalCharges || 0)}</strong><p>recorded charges</p></div><div className="report-stat"><span>NET REALISED P&amp;L</span><strong>{compactCurrency(tradingSummary.netPnl || 0)}</strong><p>kept separate from goals</p></div></div></>);
    },
    transactions() {
      chunks(transactions, appearance.tableDensity === "compact" ? 13 : 9).forEach((pageTransactions, index) => addPage(`transactions-${index}`, index === 0 ? "TRANSACTIONS" : "TRANSACTIONS — CONTINUED", pageTransactions.length ? <><p className="report-intro">Monthly investments and withdrawals included in this report.</p><ReportTable headers={["Date", "Transaction Type", "Instrument", "Amount", "Notes"]}>{pageTransactions.map((item) => <tr key={item.id}><td>{formatDate(item.date)}</td><td>{item.type}</td><td><strong>{item.instrumentName}</strong></td><td><strong>{compactCurrency(item.amount)}</strong></td><td>{item.notes || "—"}</td></tr>)}</ReportTable></> : <EmptyPrintState>No transaction-level data was recorded for this report.</EmptyPrintState>));
    },
    commentary() {
      addPage("commentary", "ADVISOR COMMENTARY", <><div className="report-panel"><h3>PORTFOLIO COMPOSITION</h3><div className="mt-4"><ReportDonutChart holdings={report.holdings || []} total={summary.totalCorpus} /></div></div><div className="report-advisor-note mt-7"><p>ADVISOR INSIGHTS · {getMonthLabel(report.reportMonth).toUpperCase()} {report.reportYear}</p><blockquote>&quot;{insights.narrative}&quot;</blockquote><div className="mt-5 flex items-center gap-3"><span className="report-avatar is-blue">{initials(report.advisorName)}</span><div><strong>{report.advisorName || `${branding.companyName || "GrowVest"} Advisor`}</strong><span>{advisorDesignation} · {advisorOrganization}</span></div></div></div><div className="mt-5 grid grid-cols-3 gap-4"><div className="report-insight is-cyan"><span>Progress Highlight</span><strong>{insights.progressHighlight.title}</strong><p>{insights.progressHighlight.description}</p></div><div className="report-insight is-red"><span>Priority Attention</span><strong>{insights.priorityAttention.title}</strong><p>{insights.priorityAttention.description}</p></div><div className="report-insight is-amber"><span>Portfolio Opportunity</span><strong>{insights.portfolioOpportunity.title}</strong><p>{insights.portfolioOpportunity.description}</p></div></div></>);
    },
    actions() {
      const plan = report.financialPlan || {};
      const surplusAllocations = plan.surplusAllocations || [];
      const loans = plan.loans || [];
      if (Number(plan.monthlySurplus || 0) > 0 || surplusAllocations.length || loans.length) addPage("financial-plan", "SURPLUS ALLOCATION & LOAN POSITION", <><p className="report-intro">Cash-flow allocation and active debt position captured for this monthly review.</p><div className="grid grid-cols-2 gap-5"><div className="report-panel"><h3>MONTHLY SURPLUS · {compactCurrency(plan.monthlySurplus || 0)}</h3><div className="mt-4 grid gap-2">{surplusAllocations.length ? surplusAllocations.map((item) => <div key={item.id} className="flex justify-between gap-4 rounded-lg bg-slate-50 p-3 text-sm"><span>{item.category}</span><strong>{compactCurrency(item.calculatedAmount || 0)}</strong></div>) : <p className="text-sm text-slate-500">No surplus allocation plan recorded.</p>}</div></div><div className="report-panel"><h3>ACTIVE LOANS · {compactCurrency(loans.reduce((sum, item) => sum + Number(item.outstandingAmount || 0), 0))}</h3><div className="mt-4 grid gap-2">{loans.length ? loans.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{item.type}{item.lender ? ` · ${item.lender}` : ""}</strong><p className="mt-1 text-slate-500">{compactCurrency(item.outstandingAmount || 0)} outstanding · EMI {compactCurrency(item.emiAmount || 0)}</p></div>) : <p className="text-sm text-slate-500">No active liabilities recorded.</p>}</div></div></div></>);
      const reportActions = [...(report.profileActions || []).map((item) => ({ ...item, reportActionSource: "Investor Profile" })), ...(report.nextSteps || []).map((item) => ({ ...item, reportActionSource: "Advisor Recommendation" }))];
      chunks(reportActions, 6).forEach((pageActions, index, all) => addPage(`actions-${index}`, index === 0 ? "PROFILE ACTIONS & ADVISOR NEXT STEPS" : "ACTIONS & NEXT STEPS — CONTINUED", <><p className="report-intro">Investor Profile actions are fetched automatically and read-only. Planned withdrawals affect portfolio cash-flow figures only after actual execution is confirmed.</p><div className="grid gap-3">{pageActions.length ? pageActions.map((item, actionIndex) => <div key={item.id || `${index}-${actionIndex}`} className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--report-primary)] text-xs font-black text-white">{index * 6 + actionIndex + 1}</span><div className="min-w-0 flex-1"><strong>{item.title || item.description}</strong>{item.title && item.description && item.description !== item.title ? <p className="mt-1 text-sm text-slate-500">{item.description}</p> : null}<p className="mt-2 text-xs text-slate-400">{item.reportActionSource || "Advisor Recommendation"} · {item.recommendationType || item.requestType || "Portfolio Review"} · {item.owner} · {item.priority || "Planned"} · {item.status}{item.dueDate ? ` · Due ${formatDate(item.dueDate)}` : ""}</p><p className="mt-1 text-xs text-slate-400">{Number(item.requestedAmount || 0) ? `Requested ${compactCurrency(item.requestedAmount)} · ` : ""}{Number(item.requestedMonthlyAmount || 0) ? `Monthly ${compactCurrency(item.requestedMonthlyAmount)} · ` : ""}{item.requestedEffectiveDate ? `Preferred ${formatDate(item.requestedEffectiveDate)} · ` : ""}{item.requestedTargetGoalName ? `Target ${item.requestedTargetGoalName} · ` : ""}{item.requestedAccountReference ? `Account ${item.requestedAccountReference} · ` : ""}{item.financialImpactStatus === "awaiting_portfolio_confirmation" ? "Awaiting portfolio confirmation" : item.financialImpactType && item.financialImpactType !== "none" ? "Planned only" : "Non-financial action"}</p><p className="mt-1 text-xs text-slate-400">Investor decision: {item.investorDecision || "Pending Discussion"}{item.sourceReportMonthKey ? ` · Carried from ${item.sourceReportMonthKey}` : ""}</p></div></div>) : <EmptyPrintState>No planned or follow-up actions were recorded for this month.</EmptyPrintState>}</div>{index === all.length - 1 ? <div className="mt-5 rounded-2xl bg-blue-50 p-5"><strong className="text-[var(--report-primary)]">NEXT REVIEW</strong><p className="mt-2 text-lg font-black">{formatDate(report.nextReview?.date)}</p><p className="mt-1 text-sm text-slate-600">{report.nextReview?.note || report.nextReview?.mode || "Your Advisor will be in touch."}</p></div> : null}</>));
    },
    disclaimer() {
      textChunks(report.disclaimer || "No additional disclaimer text was supplied for this report.", documentSettings.disclaimerStyle === "compact" ? 220 : 170).forEach((text, index) => addPage(`disclaimer-${index}`, index === 0 ? "REPORT INFORMATION & DISCLAIMER" : "DISCLAIMER — CONTINUED", <><div className={`rounded-2xl bg-slate-50 ${documentSettings.disclaimerStyle === "compact" ? "p-4" : "p-6"}`}>{index === 0 ? <p className="text-xs leading-6 text-slate-500">Report reference: {report.reportCode} · Published version {report.publishedVersion || report.version || 1} · Template {template.name} v{report.templateVersion || template.version || 1} · Generated {formatDate(report.pdfGeneratedAt || report.completedAt || report.updatedAt)}</p> : null}<p className={`${index === 0 ? "mt-4" : ""} text-sm leading-7 text-slate-500`}>{text}</p></div></>));
    }
  };

  const rendered = new Set();
  template.sectionOrder.forEach((key) => {
    if (!visible(key) || rendered.has(key) || !renderers[key]) return;
    if (key === "performanceTrend" && visible("performance")) return;
    renderers[key]();
    rendered.add(key);
  });

  return <div className="monthly-report-print-document">{pages}</div>;
}
