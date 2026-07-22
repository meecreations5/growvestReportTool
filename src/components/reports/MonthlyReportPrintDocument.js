"use client";

import {
  allocationStatus,
  buildTrendData,
  compactCurrency,
  deriveAdvisorInsights,
  derivePortfolioHealth,
  deriveReportHighlights,
  goalDisplayStatus,
  holdingColor,
  initials,
  investorFacingAdvisorDesignation
} from "@/lib/utils/reportPresentation";
import { formatDate } from "@/lib/utils/format";
import { getMonthLabel } from "@/lib/constants/report";
import ReportDonutChart from "@/components/reports/ReportDonutChart";
import ReportTrendChart from "@/components/reports/ReportTrendChart";
import { useBranding } from "@/contexts/BrandingContext";
import { PdfPage as Page } from "@/components/pdf/PdfDocumentShell";

function chunks(items = [], size = 8) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result.length ? result : [[]];
}

function GoalPrintCard({ goal }) {
  const attention = String(goal.status || "").toLowerCase().includes("review");
  return (
    <article className={`report-goal-card ${attention ? "is-attention" : ""}`}>
      <div className="flex justify-between gap-3">
        <div>
          <h3>{goal.name}</h3>
          <p>{goal.category || "Financial Goal"} · {goal.type}</p>
        </div>
        <span className="report-pill">{goalDisplayStatus(goal)}</span>
      </div>
      <div className="mt-4 flex items-end gap-3">
        <strong className="text-3xl">{Number(goal.progress || 0).toFixed(1)}%</strong>
        <div className="mb-2 h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={attention ? "h-full bg-red-500" : "h-full bg-blue-600"}
            style={{ width: `${Math.min(100, Number(goal.progress || 0))}%` }}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div><span>TARGET</span><strong>{compactCurrency(goal.targetAmount)}</strong></div>
        <div><span>CURRENT</span><strong>{compactCurrency(goal.currentAmount)}</strong></div>
        <div><span>MONTHLY SIP</span><strong>{Number(goal.monthlySip || 0) ? compactCurrency(goal.monthlySip) : "—"}</strong></div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Target year: {goal.targetYear || "—"}</p>
    </article>
  );
}

export default function MonthlyReportPrintDocument({ report, history = [] }) {
  const { branding } = useBranding();
  const summary = report.summary || {};
  const insights = deriveAdvisorInsights(report);
  const highlights = deriveReportHighlights(report);
  const health = derivePortfolioHealth(report);
  const trend = buildTrendData(report, history);
  const goalPages = chunks(report.goals || [], 6);
  const fundPages = chunks(report.funds || [], 7);
  const advisorDesignation = investorFacingAdvisorDesignation(report.advisorDesignation);
  const advisorOrganization = branding.legalName || branding.companyName || "GrowVest Advisors Private Limited";
  let pageNumber = 1;

  return (
    <div className="monthly-report-print-document">
      <Page report={report} number={pageNumber++}>
        <div className="report-cover">
          <p className="report-cover-kicker">MONTHLY WEALTH PROGRESS REPORT</p>
          <h1>{getMonthLabel(report.reportMonth)}<br />{report.reportYear}</h1>
          <p className="report-cover-subtitle">{branding.tagline || "Your Conscious Wealth Partner"}</p>
          <p className="report-cover-date">Statement date · {formatDate(report.statementDate)}</p>
          <div className="report-cover-people">
            <div>
              <p>PREPARED FOR</p>
              <div className="flex items-center gap-4">
                <span className="report-avatar is-dark">{initials(report.investorName)}</span>
                <div><strong>{report.investorName}</strong><span>Client ID · {report.clientCode}</span></div>
              </div>
            </div>
            <div>
              <p>YOUR ADVISOR</p>
              <div className="flex items-center gap-4">
                <span className="report-avatar is-blue">{initials(report.advisorName)}</span>
                <div><strong>{report.advisorName || `${branding.companyName || "GrowVest"} Advisor`}</strong><span>{advisorDesignation}</span></div>
              </div>
            </div>
          </div>
          <div className="report-cover-summary">
            <div><span>Total Portfolio</span><strong>{compactCurrency(summary.totalCorpus)}</strong></div>
            <div><span>Monthly SIP</span><strong>{compactCurrency(summary.monthlySip)}</strong></div>
            <div><span>Overall Progress</span><strong>{Number(summary.overallProgress || 0).toFixed(1)}%</strong></div>
          </div>
        </div>
      </Page>

      <Page report={report} number={pageNumber++} title="EXECUTIVE SUMMARY & PORTFOLIO PERFORMANCE">
        <div className="report-dark-kpi">
          <div><p>TOTAL PORTFOLIO VALUE</p><strong>{compactCurrency(summary.totalCorpus)}</strong><span>of {compactCurrency(summary.lifetimeTarget)} lifetime target</span></div>
          <div className="text-right"><p>OVERALL PROGRESS</p><strong className="text-cyan-400">{Number(summary.overallProgress || 0).toFixed(1)}%</strong><span>across all Bucket List goals</span></div>
          <div className="col-span-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Number(summary.overallProgress || 0))}%` }} /></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4">
          <div className="report-stat"><span>TOTAL MONTHLY SIP</span><strong>{compactCurrency(summary.monthlySip)}</strong><p>running this month</p></div>
          <div className="report-stat"><span>NEW MONEY ADDED</span><strong>{compactCurrency(summary.newMoneyAdded)}</strong><p>contributions received</p></div>
          <div className="report-stat"><span>INVESTMENT GAIN</span><strong>{compactCurrency(summary.investmentGain)}</strong><p>portfolio movement</p></div>
        </div>
        <div className="mt-7 grid grid-cols-[1.2fr_0.8fr] gap-5">
          <div className="report-panel"><h3>PORTFOLIO VALUE TREND</h3><div className="mt-4"><ReportTrendChart data={trend} /></div></div>
          <div className="report-panel"><h3>THIS MONTH AT A GLANCE</h3><div className="mt-4 grid gap-3">{highlights.map((item, index) => <div key={item.id || index} className="rounded-xl bg-slate-50 p-3"><strong>{item.title}</strong><p className="mt-1 text-sm text-slate-600">{item.description}</p></div>)}</div></div>
        </div>
      </Page>

      {goalPages.map((pageGoals, goalPageIndex) => (
        <Page key={`goal-page-${goalPageIndex}`} report={report} number={pageNumber++} title={goalPageIndex === 0 ? "BUCKET LIST PROGRESS" : "BUCKET LIST PROGRESS — CONTINUED"}>
          <p className="report-intro">Every goal in your plan, its target and how close you are today.</p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {pageGoals.length ? pageGoals.map((goal) => <GoalPrintCard key={goal.goalId} goal={goal} />) : <div className="col-span-2 rounded-2xl border border-slate-200 p-8 text-center text-slate-500">No Bucket List goals were included in this report.</div>}
          </div>
        </Page>
      ))}

      <Page report={report} number={pageNumber++} title="PORTFOLIO ALLOCATION">
        <div className="grid grid-cols-4 gap-3">
          <div className="report-health-stat"><span>Diversification</span><strong>{health.needsRebalancing ? "Needs Rebalancing" : "On Track"}</strong></div>
          <div className="report-health-stat"><span>Growth Assets</span><strong>{health.growth.toFixed(1)}%</strong></div>
          <div className="report-health-stat"><span>Stable &amp; Liquid</span><strong>{health.stable.toFixed(1)}%</strong></div>
          <div className="report-health-stat"><span>Allocation Gaps</span><strong>{health.gaps} classes</strong></div>
        </div>
        <div className="mt-6 grid gap-4">
          {(report.allocation || []).map((item) => (
            <div key={item.id} className="grid grid-cols-[110px_1fr_190px] items-center gap-4">
              <strong>{item.assetClass}</strong>
              <div className="relative h-5 overflow-hidden rounded-full bg-slate-100">
                <div className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${Math.min(100, Number(item.targetPercentage || 0))}%`, backgroundColor: holdingColor(item) }} />
                <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, Number(item.currentPercentage || 0))}%`, backgroundColor: holdingColor(item) }} />
              </div>
              <div className="grid grid-cols-3 text-right text-sm"><span>{Number(item.currentPercentage || 0).toFixed(1)}%</span><span className="text-slate-400">{Number(item.targetPercentage || 0).toFixed(1)}%</span><strong className={Number(item.variance || 0) > 0 ? "text-red-600" : "text-emerald-600"}>{Number(item.variance || 0) > 0 ? "+" : ""}{Number(item.variance || 0).toFixed(1)}%</strong></div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7"><strong className="text-amber-600">Observation:</strong> {health.observation}</div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-white"><tr><th>Asset Class</th><th>Current Value</th><th>Monthly SIP</th><th>Current</th><th>Target</th><th>Variance</th><th>Status</th></tr></thead>
            <tbody>{(report.allocation || []).map((item) => { const status = allocationStatus(item); return <tr key={item.id}><td><strong>{item.assetClass}</strong></td><td>{compactCurrency(item.currentValue)}</td><td>{Number(item.monthlySip || 0) ? compactCurrency(item.monthlySip) : "—"}</td><td>{Number(item.currentPercentage || 0).toFixed(1)}%</td><td>{Number(item.targetPercentage || 0).toFixed(1)}%</td><td>{Number(item.variance || 0) > 0 ? "+" : ""}{Number(item.variance || 0).toFixed(1)}%</td><td>{status.label}</td></tr>; })}</tbody>
          </table>
        </div>
      </Page>

      {fundPages.map((pageFunds, fundPageIndex) => (
        <Page key={`fund-page-${fundPageIndex}`} report={report} number={pageNumber++} title={fundPageIndex === 0 ? "DETAILED HOLDINGS" : "DETAILED HOLDINGS — CONTINUED"}>
          <p className="report-intro">Every instrument in your portfolio, the Bucket List goal it supports and its current value.</p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-white"><tr><th>Fund / Instrument</th><th>Class</th><th>Linked Goal</th><th>SIP</th><th>Value</th><th>Weight</th><th>Type</th></tr></thead>
              <tbody>{pageFunds.map((item) => { const weight = summary.totalCorpus ? (Number(item.currentValue || 0) / Number(summary.totalCorpus)) * 100 : 0; return <tr key={item.id}><td><strong>{item.instrumentName}</strong></td><td>{item.assetClass}</td><td>{item.goalName || "Flexible Pool"}</td><td>{Number(item.monthlySip || 0) ? compactCurrency(item.monthlySip) : "—"}</td><td><strong>{compactCurrency(item.currentValue)}</strong></td><td>{weight.toFixed(1)}%</td><td>{item.type}</td></tr>; })}</tbody>
            </table>
          </div>
        </Page>
      ))}

      <Page report={report} number={pageNumber++} title="ADVISOR COMMENTARY">
        <div className="report-panel"><ReportDonutChart holdings={report.holdings || []} total={summary.totalCorpus} /></div>
        <div className="report-advisor-note mt-7">
          <p>ADVISOR INSIGHTS · {getMonthLabel(report.reportMonth).toUpperCase()} {report.reportYear}</p>
          <blockquote>&quot;{insights.narrative}&quot;</blockquote>
          <div className="mt-5 flex items-center gap-3"><span className="report-avatar is-blue">{initials(report.advisorName)}</span><div><strong>{report.advisorName || `${branding.companyName || "GrowVest"} Advisor`}</strong><span>{advisorDesignation} · {advisorOrganization}</span></div></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4">
          <div className="report-insight is-cyan"><span>Progress Highlight</span><strong>{insights.progressHighlight.title}</strong><p>{insights.progressHighlight.description}</p></div>
          <div className="report-insight is-red"><span>Priority Attention</span><strong>{insights.priorityAttention.title}</strong><p>{insights.priorityAttention.description}</p></div>
          <div className="report-insight is-amber"><span>Portfolio Opportunity</span><strong>{insights.portfolioOpportunity.title}</strong><p>{insights.portfolioOpportunity.description}</p></div>
        </div>
      </Page>

      <Page report={report} number={pageNumber++} title="RECOMMENDED ACTIONS & NEXT REVIEW">
        <div className="grid gap-3">
          {(report.nextSteps || []).length ? (report.nextSteps || []).map((item, index) => (
            <div key={item.id} className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">{index + 1}</span>
              <div><strong>{item.title || item.description}</strong>{item.title && item.description && item.description !== item.title ? <p className="mt-1 text-sm text-slate-500">{item.description}</p> : null}<p className="mt-2 text-xs text-slate-400">{item.owner} · {item.priority || "Planned"} · {item.status}{item.dueDate ? ` · Due ${formatDate(item.dueDate)}` : ""}</p></div>
            </div>
          )) : <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-500">No Advisor-recommended actions were recorded for this month.</div>}
        </div>
        <div className="mt-5 rounded-2xl bg-blue-50 p-5"><strong className="text-blue-700">NEXT REVIEW</strong><p className="mt-2 text-lg font-black">{formatDate(report.nextReview?.date)}</p><p className="mt-1 text-sm text-slate-600">{report.nextReview?.note || report.nextReview?.mode || "Your Advisor will be in touch."}</p></div>
        <div className="mt-6 rounded-2xl bg-slate-50 p-5">
          <strong className="text-slate-700">REPORT INFORMATION & DISCLAIMER</strong>
          <p className="mt-3 text-xs leading-6 text-slate-500">Report reference: {report.reportCode} · Version {report.version || 1} · Generated {formatDate(report.completedAt || report.updatedAt)}</p>
          <p className="mt-4 text-xs leading-6 text-slate-500">{report.disclaimer}</p>
        </div>
      </Page>
    </div>
  );
}
