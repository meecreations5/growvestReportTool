"use client";

import {
  BarChart3,
  Binoculars,
  CalendarClock,
  CheckCircle2,
  Coins,
  Compass,
  Cog,
  Leaf,
  ShieldCheck,
  Target,
  TrendingUp
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { PdfPage as Page } from "@/components/pdf/PdfDocumentShell";
import ReportDonutChart from "@/components/reports/ReportDonutChart";
import ReportTrendChart from "@/components/reports/ReportTrendChart";
import { formatDate } from "@/lib/utils/format";
import { REPORT_TYPE, getMonthLabel } from "@/lib/constants/report";
import { resolveReportBranding, resolveReportTheme } from "@/lib/utils/reportBranding";
import {
  buildTrendData,
  compactCurrency,
  deriveAdvisorInsights,
  previousReportFor
} from "@/lib/utils/reportPresentation";

const SIGNATURE_ASSET_COLORS = {
  "Mutual Funds": "#1F4ED8",
  "Mutual Fund": "#1F4ED8",
  Equity: "#0CC0DF",
  Debt: "#6B7280",
  "Fixed Income": "#6B7280",
  Liquid: "#F5B301",
  Cash: "#F5B301",
  Gold: "#F5B301",
  Insurance: "#86DCEB",
  ULIP: "#86DCEB",
  Trading: "#E53935",
  "Real Estate": "#0B0B0F",
  Other: "#6B7280"
};

function signatureAssetColor(item = {}, index = 0) {
  const key = String(item.assetClass || item.investmentType || "Other").trim();
  return SIGNATURE_ASSET_COLORS[key] || ["#1F4ED8", "#0CC0DF", "#6B7280", "#F5B301", "#E53935", "#0B0B0F"][index % 6];
}

function balancedChunks(items = [], maximumPerPage = 6) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return [[]];
  const pageCount = Math.max(1, Math.ceil(rows.length / maximumPerPage));
  const baseSize = Math.floor(rows.length / pageCount);
  const remainder = rows.length % pageCount;
  const pages = [];
  let cursor = 0;
  for (let index = 0; index < pageCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    pages.push(rows.slice(cursor, cursor + size));
    cursor += size;
  }
  return pages;
}

function signatureCopy(value = "") {
  return String(value || "")
    .replace(/\bdisciplined contributions\b/gi, "consistent contributions")
    .replace(/\bdisciplined investing\b/gi, "consistent investing")
    .replace(/\bdiscipline\b/gi, "consistency");
}

function hasConfiguredAllocationTargets(allocation = []) {
  return (Array.isArray(allocation) ? allocation : []).some((item) => Number(item?.targetPercentage || 0) > 0);
}

function signedPercent(value) {
  const amount = Number(value || 0);
  return `${amount > 0 ? "+" : ""}${amount.toFixed(2)}%`;
}

function gainTone(value) {
  return Number(value || 0) >= 0 ? "is-positive" : "is-negative";
}

function MetricCard({ icon: Icon, label, value, helper, tone = "blue" }) {
  return (
    <div className={`signature-metric signature-metric-${tone}`}>
      <span className="signature-metric-icon"><Icon size={23} strokeWidth={2} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <p>{helper}</p> : null}
      </div>
    </div>
  );
}

function SignatureTable({ headers, widths = [], children, className = "" }) {
  return (
    <div className="signature-table-wrap">
      <table className={`signature-table ${className}`.trim()}>
        {widths.length ? <colgroup>{widths.map((width, index) => <col key={`${headers[index]}-${width}`} style={{ width: `${width}%` }} />)}</colgroup> : null}
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptySignatureState({ title, text }) {
  return (
    <div className="signature-empty-state">
      <ShieldCheck size={28} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function goalFundMatch(goal, fund) {
  const goalId = String(goal?.goalId || goal?.id || "");
  const goalName = String(goal?.name || "").trim().toLowerCase();
  if (goalId && String(fund?.goalId || "") === goalId) return true;
  if (goalName && [fund?.goalName, fund?.bucketLabel].some((value) => String(value || "").trim().toLowerCase() === goalName)) return true;
  return Array.isArray(fund?.goalAllocations) && fund.goalAllocations.some((allocation) => {
    if (goalId && String(allocation?.goalId || "") === goalId) return true;
    return goalName && String(allocation?.goalName || allocation?.name || "").trim().toLowerCase() === goalName;
  });
}

function GoalPage({ report, goal, funds, pageNumber }) {
  const progress = Math.min(100, Math.max(0, Number(goal.progress || 0)));
  const current = Number(goal.currentAmount || 0);
  const target = Number(goal.targetAmount || 0);
  const linkedFunds = funds.filter((fund) => goalFundMatch(goal, fund));
  return (
    <Page report={report} number={pageNumber} title="Bucket List & Wealth Goals" className="report-signature-page">
      <p className="signature-page-intro">Tracking your progress towards what matters most.</p>
      <section className="signature-goal-hero">
        <div className="signature-goal-heading">
          <span className="signature-goal-icon"><Target size={24} /></span>
          <div>
            <h3>{goal.name || "Financial Goal"}</h3>
            <p>{goal.description || goal.category || "Build long-term wealth around a meaningful financial milestone."}</p>
          </div>
        </div>
        <div className="signature-goal-value-row">
          <strong>{compactCurrency(current)} <span>of {compactCurrency(target)}</span></strong>
          <b>{progress.toFixed(2)}%</b>
        </div>
        <div className="signature-progress"><span style={{ width: `${progress}%` }} /></div>
        <div className="signature-goal-metrics">
          <div><span>Active SIP</span><strong>{Number(goal.monthlySip || 0) ? `${compactCurrency(goal.monthlySip)}/month` : "Not active"}</strong></div>
          <div><span>Target</span><strong>{compactCurrency(target)}</strong></div>
          <div><span>Status</span><strong>{goal.status || (current > 0 ? "Invested" : "Not Started")}</strong></div>
          <div><span>Target Horizon</span><strong>{goal.targetYear || goal.timeline || "Not set"}</strong></div>
        </div>
      </section>

      <h3 className="signature-subheading">Investments contributing to this goal</h3>
      {linkedFunds.length ? (
        <SignatureTable className="signature-goal-table signature-numeric-table" headers={["Investment", "Current Value", "Active SIP"]} widths={[58, 22, 20]}>
          {linkedFunds.slice(0, 8).map((fund) => (
            <tr key={fund.id || fund.positionId || fund.instrumentName}>
              <td><strong>{fund.instrumentName}</strong></td>
              <td>{compactCurrency(fund.currentValue)}</td>
              <td>{Number(fund.monthlySip || 0) ? compactCurrency(fund.monthlySip) : "-"}</td>
            </tr>
          ))}
          <tr className="signature-total-row"><td>Total</td><td>{compactCurrency(linkedFunds.reduce((sum, fund) => sum + Number(fund.currentValue || 0), 0))}</td><td>{compactCurrency(linkedFunds.reduce((sum, fund) => sum + Number(fund.monthlySip || 0), 0))}</td></tr>
        </SignatureTable>
      ) : <EmptySignatureState title="No investment linked yet" text="The goal exists, but no current Portfolio Master holding is linked to it in this report snapshot." />}

      <div className="signature-status-callout"><CheckCircle2 size={18} /><div><strong>{progress >= 100 ? "Goal completed" : progress > 0 ? "Progress underway" : "Ready to begin"}</strong><p>{progress > 0 ? "Your investments are contributing to this financial goal." : "Your Conscious Wealth Partner can help map investments when you are ready."}</p></div></div>
    </Page>
  );
}

export default function GrowVestSignatureReportDocument({ report, history = [] }) {
  const { branding: liveBranding } = useBranding();
  const branding = resolveReportBranding(report, liveBranding);
  const resolvedTheme = resolveReportTheme(report, branding, report.templateSnapshot || {});
  const theme = {
    ...resolvedTheme,
    primaryColor: "#1F4ED8",
    secondaryColor: "#0CC0DF",
    darkColor: "#0B0B0F",
    dangerColor: "#E53935",
    warningColor: "#F5B301",
    surfaceColor: "#F4F6F9",
    mutedColor: "#6B7280"
  };
  const summary = report.summary || {};
  const isOpening = report.reportType === REPORT_TYPE.OPENING;
  const funds = Array.isArray(report.funds) ? report.funds : [];
  const goals = Array.isArray(report.goals) ? report.goals : [];
  const allocation = Array.isArray(report.allocation) ? report.allocation : [];
  const targetAllocationConfigured = hasConfiguredAllocationTargets(allocation);
  const allocationChartHoldings = (Array.isArray(report.holdings) && report.holdings.length
    ? report.holdings
    : allocation.map((item) => ({ ...item, percentage: Number(item.currentPercentage || 0), currentValue: Number(item.currentValue || 0) })))
    .map((item, index) => ({ ...item, color: signatureAssetColor(item, index) }));
  const protection = report.protectionSnapshot || {};
  const protectionPolicies = Array.isArray(protection.policies) ? protection.policies : [];
  const insights = deriveAdvisorInsights(report);
  const trend = buildTrendData(report, history);
  const previous = isOpening ? null : previousReportFor(report, history);
  const invested = Number(summary.totalInvested || 0);
  const gain = Number(summary.portfolioGainLoss ?? (Number(summary.totalCorpus || 0) - invested));
  const overallReturn = invested ? (gain / invested) * 100 : 0;
  const reportPeriod = isOpening ? `${getMonthLabel(report.reportMonth)} ${report.reportYear}` : `${getMonthLabel(report.reportMonth)} ${report.reportYear}`;
  // Locked visual reference uses packaged, version-controlled GrowVest artwork.
  // This prevents a stale Branding/Template URL from silently reverting the PDF.
  const logo = "/brand/growvest-logo-dark.svg";
  const coverBackground = "/brand/growvest-wealth-review-cover-v03424.jpg";
  const brandIcon = "/brand/growvest-icon-blue-v03424.png";
  const brandIconWhite = "/brand/growvest-icon-white-v03424.png";
  const coverWash = "/brand/growvest-cover-wash.png";
  const pages = [];
  let pageNumber = 1;
  const add = (node) => { pages.push(node); pageNumber += 1; };

  add(
    <Page key="signature-cover" report={report} number={pageNumber} className="report-signature-page report-signature-cover-page" hideHeader hideFooter>
      <div className="signature-cover">
        <img className="signature-cover-photo" src={coverBackground} alt="" aria-hidden="true" />
        <div className="signature-cover-photo-wash" aria-hidden="true" style={{ backgroundImage: `url(${coverWash})` }} />
        <div className="signature-cover-top">
          <div className="signature-cover-brand"><img src={logo} alt={`${branding.companyName || "GrowVest"} logo`} /><p>{branding.brandPositioning || "Your Conscious Wealth Partner"}</p></div>
          <div className="signature-cover-motto">WEALTH<br />FOR A BRIGHTER<br />TOMORROW</div>
        </div>
        <div className="signature-cover-body">
          <p className="signature-cover-kicker">INVEST <span>•</span> PLAN <span>•</span> GROW <span>•</span> LIVE BETTER</p>
          <h1>{isOpening ? <>OPENING<br />WEALTH REVIEW</> : <>MONTHLY<br />WEALTH REVIEW</>}</h1>
          <p className="signature-cover-period">{reportPeriod}</p>
          <div className="signature-cover-accent" />
          <div className="signature-cover-prepared"><span>Prepared for</span><strong>{report.investorName || "Investor"}</strong></div>
          <div className="signature-cover-wealth">
            <span>Your Wealth Today</span>
            <strong>{compactCurrency(summary.totalCorpus)}</strong>
            <div><p><b>{compactCurrency(invested)}</b>Invested</p><p><b className={gainTone(gain)}>{gain >= 0 ? "+" : ""}{compactCurrency(gain)}</b>Gain / Loss</p><p><b className={gainTone(overallReturn)}>{signedPercent(overallReturn)}</b>Overall Return</p></div>
          </div>
          <p className="signature-cover-date">Portfolio position as of {formatDate(report.statementDate)}</p>
        </div>
        <div className="signature-cover-bottom"><div><strong>{branding.companyName || "GrowVest"}</strong><span>{branding.brandPositioning || "Your Conscious Wealth Partner"}</span></div><p>INVEST<br />PLAN<br />GROW<br />LIVE BETTER</p></div>
      </div>
    </Page>
  );

  add(
    <Page key="signature-summary" report={report} number={pageNumber} title="Wealth at a Glance" className="report-signature-page">
      <p className="signature-page-intro">A snapshot of your current financial position with GrowVest.</p>
      <div className="signature-metric-grid">
        <MetricCard icon={BarChart3} label="Portfolio Value" value={compactCurrency(summary.totalCorpus)} />
        <MetricCard icon={Coins} label="Total Invested" value={compactCurrency(invested)} tone="cyan" />
        <MetricCard icon={TrendingUp} label="Gain / Loss" value={`${gain >= 0 ? "+" : ""}${compactCurrency(gain)}`} helper={signedPercent(overallReturn)} tone={gain >= 0 ? "cyan" : "red"} />
        <MetricCard icon={CalendarClock} label="Active Monthly SIP" value={compactCurrency(summary.monthlySip)} />
      </div>
      <div className="signature-starting-callout">
        <span><img src={brandIcon} alt="" aria-hidden="true" /></span>
        <div><h3>{isOpening ? "Your Starting Point" : "This Month in Context"}</h3><p>{isOpening ? "This is your opening portfolio position with GrowVest. Future monthly reviews will track how your wealth, investments and Bucket List progress evolve from this starting point." : `This review captures your portfolio position for ${reportPeriod}. Use it together with the performance and goal pages to understand what changed and what matters next.`}</p></div>
      </div>
    </Page>
  );

  add(
    <Page key="signature-allocation" report={report} number={pageNumber} title="Asset Allocation" className="report-signature-page">
      <p className="signature-page-intro">Your current portfolio mix across the reported asset classes.</p>
      <section className="signature-allocation-hero">
        <ReportDonutChart holdings={allocationChartHoldings} total={summary.totalCorpus} printMode chartStyle="signature" />
      </section>
      <h3 className="signature-subheading">Current Allocation vs Target Allocation</h3>
      {allocation.length ? (
        <SignatureTable className="signature-allocation-table signature-numeric-table" headers={["Asset Class", "Current Allocation", "Target Allocation", "Variance"]} widths={[34, 23, 23, 20]}>
          {allocation.slice(0, 8).map((item) => {
            const variance = Number(item.variance ?? (Number(item.currentPercentage || 0) - Number(item.targetPercentage || 0)));
            return <tr key={item.id || item.assetClass}><td><span className="signature-asset-dot" style={{ backgroundColor: signatureAssetColor(item) }} /> <strong>{item.assetClass}</strong></td><td>{Number(item.currentPercentage || 0).toFixed(1)}%</td><td>{targetAllocationConfigured ? `${Number(item.targetPercentage || 0).toFixed(1)}%` : <span className="signature-not-set">Not set</span>}</td><td className={!targetAllocationConfigured ? "signature-not-set" : Math.abs(variance) < 1 ? "" : variance > 0 ? "is-negative" : "is-positive"}>{targetAllocationConfigured ? `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%` : "-"}</td></tr>;
          })}
        </SignatureTable>
      ) : <EmptySignatureState title="Allocation data not available" text="No asset-allocation rows were included in this report snapshot." />}
    </Page>
  );

  if (goals.length) {
    goals.forEach((goal, index) => add(<GoalPage key={`signature-goal-${goal.goalId || goal.id || index}`} report={report} goal={goal} funds={funds} pageNumber={pageNumber} />));
  } else {
    add(
      <Page key="signature-general-wealth" report={report} number={pageNumber} title="Bucket List & Wealth Goals" className="report-signature-page">
        <p className="signature-page-intro">A Bucket List is optional. Investments without a specific goal remain part of General Wealth / Corpus Creation.</p>
        <section className="signature-goal-hero">
          <div className="signature-goal-heading"><span className="signature-goal-icon"><Target size={24} /></span><div><h3>General Wealth / Corpus Creation</h3><p>Your current unallocated long-term wealth corpus.</p></div></div>
          <div className="signature-goal-value-row"><strong>{compactCurrency(summary.generalWealthCorpus || summary.totalCorpus)}</strong></div>
          <div className="signature-goal-metrics"><div><span>Active SIP</span><strong>{compactCurrency(summary.monthlySip)}</strong></div><div><span>Portfolio</span><strong>{compactCurrency(summary.totalCorpus)}</strong></div><div><span>Goal status</span><strong>General Wealth</strong></div><div><span>Specific Bucket List</span><strong>Optional</strong></div></div>
        </section>
      </Page>
    );
  }

  const holdingPages = balancedChunks(funds, 6);
  holdingPages.forEach((pageFunds, index) => add(
    <Page key={`signature-holdings-${index}`} report={report} number={pageNumber} title={index ? "Investment Portfolio - Continued" : "Investment Portfolio"} className="report-signature-page">
      <p className="signature-page-intro">A detailed view of your current investments and their Goal / Corpus allocation.</p>
      {pageFunds.length ? (
        <SignatureTable className="signature-holdings-table signature-numeric-table" headers={["Investment", "Invested", "Current Value", "Gain / Loss", "Active SIP"]} widths={[38, 15, 17, 16, 14]}>
          {pageFunds.map((fund) => {
            const cost = Number(fund.totalInvested || 0);
            const value = Number(fund.currentValue || 0);
            const fundGain = Number(fund.profitLoss ?? (value - cost));
            const fundReturn = cost ? fundGain / cost * 100 : Number(fund.returnPercentage || 0);
            return (
              <tr key={fund.id || fund.positionId || fund.instrumentName}>
                <td><strong>{fund.instrumentName}</strong><span className="signature-table-note">Allocated to: {fund.bucketLabel || fund.goalName || "General Wealth / Corpus Creation"}</span></td>
                <td>{compactCurrency(cost)}</td>
                <td><strong>{compactCurrency(value)}</strong></td>
                <td><strong className={gainTone(fundGain)}>{fundGain >= 0 ? "+" : ""}{compactCurrency(fundGain)}</strong><span className={`signature-table-note ${gainTone(fundReturn)}`}>{signedPercent(fundReturn)}</span></td>
                <td>{Number(fund.monthlySip || 0) ? compactCurrency(fund.monthlySip) : "-"}</td>
              </tr>
            );
          })}
          {index === holdingPages.length - 1 ? <tr className="signature-total-row"><td>Total</td><td>{compactCurrency(invested)}</td><td>{compactCurrency(summary.totalCorpus)}</td><td><span className={gainTone(gain)}>{gain >= 0 ? "+" : ""}{compactCurrency(gain)}</span></td><td>{compactCurrency(summary.monthlySip)}</td></tr> : null}
        </SignatureTable>
      ) : <EmptySignatureState title="No holdings available" text="No investment holdings were included in this report snapshot." />}
      <div className="signature-quote">“Consistency today creates more choice tomorrow.” <span>- GrowVest</span></div>
    </Page>
  ));

  add(
    <Page key="signature-performance" report={report} number={pageNumber} title="Performance" className="report-signature-page">
      <p className="signature-page-intro">{isOpening ? "Your overall portfolio position at the start of GrowVest reporting." : "Your portfolio movement and performance for the reporting period."}</p>
      {isOpening ? (
        <div className="signature-performance-card">
          <div className="signature-performance-title"><BarChart3 size={24} /><div><strong>Your Starting Position</strong><span>Baseline as of {formatDate(report.statementDate)}</span></div></div>
          <dl>
            <div><dt>Portfolio Value</dt><dd>{compactCurrency(summary.totalCorpus)}</dd></div>
            <div><dt>Total Invested</dt><dd>{compactCurrency(invested)}</dd></div>
            <div><dt>Overall Gain</dt><dd className={gainTone(gain)}>{gain >= 0 ? "+" : ""}{compactCurrency(gain)}</dd></div>
            <div><dt>Overall Return</dt><dd className={gainTone(overallReturn)}>{signedPercent(overallReturn)}</dd></div>
          </dl>
        </div>
      ) : (
        <>
          <div className="signature-performance-card">
            <div className="signature-performance-title"><TrendingUp size={24} /><strong>Monthly Movement</strong></div>
            <dl>
              <div><dt>Opening Portfolio</dt><dd>{compactCurrency(summary.openingValue || previous?.summary?.totalCorpus || 0)}</dd></div>
              <div><dt>Money Added</dt><dd>{compactCurrency(summary.newMoneyAdded || 0)}</dd></div>
              <div><dt>Money Withdrawn</dt><dd>{compactCurrency(summary.totalWithdrawals || 0)}</dd></div>
              <div><dt>Investment Gain / Loss</dt><dd className={gainTone(summary.investmentGain)}>{Number(summary.investmentGain || 0) >= 0 ? "+" : ""}{compactCurrency(summary.investmentGain || 0)}</dd></div>
            </dl>
          </div>
          <div className="signature-trend-panel"><ReportTrendChart data={trend} primaryColor={theme.primaryColor || "#1F4ED8"} chartStyle="signature" printMode /></div>
        </>
      )}
      <div className="signature-information-callout"><BarChart3 size={21} /><p>{isOpening ? "Monthly performance comparison will begin from your next Wealth Review." : "Monthly performance excludes confirmed external money added and withdrawn so portfolio movement is not overstated."}</p></div>
    </Page>
  );

  if (protectionPolicies.length) {
    add(
      <Page key="signature-protection" report={report} number={pageNumber} title="Protection Overview" className="report-signature-page">
        <p className="signature-page-intro">Helping you stay financially secure for life's uncertainties.</p>
        <SignatureTable headers={["Type", "Status", "Renewal / Next Due", "Notes"]} widths={[27, 19, 25, 29]}>
          {protectionPolicies.slice(0, 9).map((policy) => (
            <tr key={policy.id || policy.policyNumber || policy.productName}>
              <td><strong>{policy.insuranceType || "Insurance"}</strong>{Number(policy.coverAmount || 0) ? <span className="signature-table-note">Cover: {compactCurrency(policy.coverAmount)}</span> : null}</td>
              <td><span className={`signature-status-dot ${String(policy.policyStatus || "active").toLowerCase().includes("active") ? "is-active" : "is-due"}`} />{policy.policyStatus || "Active"}</td>
              <td>{policy.nextDueDate ? formatDate(policy.nextDueDate) : "-"}</td>
              <td>{policy.nextDueType || policy.notes || "-"}</td>
            </tr>
          ))}
        </SignatureTable>
        <div className="signature-protection-callout"><ShieldCheck size={22} /><div><strong>Protection and wealth are reviewed separately.</strong><p>Insurance cover is not included in your investment portfolio value.</p></div></div>
      </Page>
    );
  }

  add(
    <Page key="signature-view" report={report} number={pageNumber} title="GrowVest View" className="report-signature-page">
      <p className="signature-page-intro">Our perspective on your financial journey.</p>
      <div className="signature-view-list">
        <div><span><Binoculars size={25} strokeWidth={2} /></span><section><strong>What We Observe</strong><p>{signatureCopy(insights.narrative)}</p></section></div>
        <div><span><Compass size={24} /></span><section><strong>What Matters Now</strong><p>{signatureCopy(insights.priorityAttention?.description || "Continue reviewing your portfolio, goal allocation and protection needs as your life evolves.")}</p></section></div>
        <div><span><Cog size={25} strokeWidth={2} /></span><section><strong>What We Recommend Next</strong><p>{signatureCopy(insights.portfolioOpportunity?.description || "Review the next agreed portfolio action with your Conscious Wealth Partner.")}</p></section></div>
      </div>
      {report.advisorNote?.content && signatureCopy(report.advisorNote.content).trim() !== signatureCopy(insights.narrative).trim() ? <div className="signature-partner-note"><p>{signatureCopy(report.advisorNote.content)}</p><strong>{report.advisorName || `${branding.companyName || "GrowVest"} Team`}</strong><span>Conscious Wealth Partner</span></div> : <div className="signature-partner-strip"><div><span>Connect GrowVest</span><strong>{report.advisorName || `${branding.companyName || "GrowVest"} Team`}</strong></div><p>Conscious Wealth Partner</p></div>}
    </Page>
  );

  const actions = [...(report.profileActions || []), ...(report.nextSteps || [])].filter((item) => item?.title || item?.description).slice(0, 3);
  add(
    <Page key="signature-actions" report={report} number={pageNumber} title="Your Next Steps" className="report-signature-page">
      <p className="signature-page-intro">Simple actions for continued progress.</p>
      <div className={`signature-action-list ${actions.length <= 1 ? "is-single" : ""}`}>
        {actions.length ? actions.map((item, index) => <div key={item.id || index}><span>{index + 1}</span><section><strong>{item.title || item.description}</strong>{item.title && item.description && item.description !== item.title ? <p>{item.description}</p> : null}{item.dueDate ? <small>Due {formatDate(item.dueDate)}</small> : null}</section></div>) : <div><span>1</span><section><strong>Continue your current plan</strong><p>No new action has been recorded for this review.</p></section></div>}
      </div>
      {report.nextReview?.date ? <div className="signature-next-review"><CalendarClock size={22} /><div><span>Upcoming</span><strong>Your next Wealth Review: {formatDate(report.nextReview.date)}</strong></div></div> : null}
      {!protectionPolicies.length ? <div className="signature-protection-inline"><ShieldCheck size={19} /><div><strong>Protection details not yet added</strong><p>Protection is reviewed separately and is not included in your investment portfolio value.</p></div></div> : null}
      <div className={`signature-closing-banner ${actions.length <= 1 ? "is-single" : ""}`}><span><img src={brandIconWhite} alt="" aria-hidden="true" /></span><div><strong>Grow and Invest With Us</strong><p>Building a more secure, fulfilling tomorrow, together.</p></div></div>
      <div className="signature-closing-brand"><div><strong>{branding.companyName || "GrowVest"}</strong><span>{branding.brandPositioning || "Your Conscious Wealth Partner"}</span></div><p>INVEST<br />PLAN<br />GROW<br />LIVE BETTER</p></div>
      <p className="signature-disclaimer-inline">{report.disclaimer || "This report is for your personal use only. Past performance is not a guarantee of future results."}</p>
    </Page>
  );

  const disclaimer = String(report.disclaimer || "").trim();
  if (disclaimer.length > 520) {
    add(
      <Page key="signature-disclaimer" report={report} number={pageNumber} title="Report Information & Disclaimer" className="report-signature-page">
        <p className="signature-page-intro">Important information about this GrowVest Wealth Review.</p>
        <div className="signature-legal-card"><p><strong>Report reference:</strong> {report.reportCode || "-"}</p><p><strong>Statement date:</strong> {formatDate(report.statementDate)}</p><p><strong>Version:</strong> {report.publishedVersion || report.version || 1}</p><hr /><p>{disclaimer}</p></div>
      </Page>
    );
  }

  return <div className="monthly-report-print-document report-signature-document">{pages}</div>;
}
