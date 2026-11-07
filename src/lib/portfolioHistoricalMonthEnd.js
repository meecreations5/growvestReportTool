/**
 * Eligibility for promoting an archived Fundbazaar valuation into a VERIFIED
 * historical Portfolio Master snapshot. This does not back-date NAVs or touch
 * the live portfolio. Financial reports read the original NAV date.
 * Keep this module pure so blocking rules are independently regression-tested.
 */
import { externalPortfolioCashFlow, isConfirmedInvestmentActivity, lastCalendarDayOfMonth } from "./portfolioPeriodCoverage.js";

const DAY_MS = 86400000;
const MAX_NAV_LAG_DAYS = 7;
const cents = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const dateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";

export function fundbazaarHoldingKey(item = {}) {
  return [String(item.isin || item.schemeName || item.instrumentName || "").trim().toUpperCase(), String(item.folioNo || "").trim().toUpperCase()].join("|");
}

/**
 * Repeated daily uploads may contain the SAME Fundbazaar NAV-date holdings
 * despite differing file hashes (or upload time). Compare source financial
 * contents, not file fingerprints alone. A shift between schemes with the
 * same grand total must still be treated as an unresolved source conflict.
 */
export function equivalentFundbazaarDatedArchives(left = {}, right = {}, leftHoldings = [], rightHoldings = []) {
  const la = left.summary || {};
  const ra = right.summary || {};
  if (!Array.isArray(leftHoldings) || !Array.isArray(rightHoldings)
    || leftHoldings.length === 0 || leftHoldings.length !== rightHoldings.length
    || Number(la.holdingCount) !== leftHoldings.length || Number(ra.holdingCount) !== rightHoldings.length
    || String(left.valuationDate || "") !== String(right.valuationDate || "")) return false;
  const near = (a, b, tolerance) => {
    const x = Number(a);
    const y = Number(b);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tolerance;
  };
  if (!near(la.currentValue, ra.currentValue, 0.02) || !near(la.totalInvested, ra.totalInvested, 0.02)) return false;
  const canonical = (holdings) => holdings.map((item) => ({
    key: fundbazaarHoldingKey(item),
    navDate: String(item.navDate || ""),
    units: Number(item.totalUnits),
    nav: Number(item.currentNav),
    value: Number(item.currentValue),
    invested: Number(item.totalInvested),
    monthlySip: Number(item.monthlySip || 0)
  })).sort((a, b) => a.key.localeCompare(b.key));
  const a = canonical(leftHoldings);
  const b = canonical(rightHoldings);
  if (new Set(a.map((item) => item.key)).size !== a.length
    || new Set(b.map((item) => item.key)).size !== b.length) return false;
  return a.every((item, i) => item.key === b[i].key && item.navDate === b[i].navDate
    && near(item.units, b[i].units, 0.000001)
    && near(item.nav, b[i].nav, 0.000001)
    && near(item.value, b[i].value, 0.02)
    && near(item.invested, b[i].invested, 0.02)
    && near(item.monthlySip, b[i].monthlySip, 0.02));
}

/**
 * A Saturday NAV is allowed as a source-dated observation when the original
 * Fundbazaar archive and all holdings/transactions reconcile. It is not
 * silently changed to the preceding Friday, and source-accepted is distinct
 * from independently verified. A Sunday NAV still needs exact official
 * corroboration; this evidence is retained in the audit.
 */
function officialNavEvidenceFor(holding = {}, evidence = []) {
  const matches = (Array.isArray(evidence) ? evidence : []).filter((proof) =>
    fundbazaarHoldingKey(proof) === fundbazaarHoldingKey(holding)
    && dateKey(proof.navDate) === dateKey(holding.navDate)
  );
  if (matches.length !== 1) return null;
  const proof = matches[0];
  const observedNav = Number(holding.currentNav);
  const publishedNav = Number(proof.publishedNav);
  if (!Number.isFinite(observedNav) || observedNav <= 0 || !Number.isFinite(publishedNav) || publishedNav <= 0
    || Math.abs(observedNav - publishedNav) > Math.max(0.0001, observedNav * 0.000005)) return null;
  let url;
  try { url = new URL(String(proof.referenceUrl || "")); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !["amfiindia.com", "www.amfiindia.com", "portal.amfiindia.com", "sbimf.com", "www.sbimf.com"].includes(host)
    || url.username || url.password || url.port || url.href.length > 600) return null;
  return {
    isin: String(holding.isin || ""), folioNo: String(holding.folioNo || ""),
    instrumentName: String(holding.instrumentName || holding.schemeName || ""),
    navDate: holding.navDate, publishedNav, referenceUrl: url.href,
    evidenceType: proof.evidenceType === "automated_amfi_history_match" ? "automated_amfi_history_match" : "staff_verified_official_nav_reference"
  };
}

function monthFlows(transactions, monthKey) {
  return (Array.isArray(transactions) ? transactions : []).reduce((result, txn) => {
    const date = dateKey(txn.transactionDate);
    if (!date || date.slice(0, 7) !== monthKey) return result;
    const cash = externalPortfolioCashFlow(txn);
    result.newMoney += cash.newMoney;
    result.withdrawals += cash.withdrawals;
    result.count += cash.newMoney || cash.withdrawals ? 1 : 0;
    return result;
  }, { newMoney: 0, withdrawals: 0, count: 0 });
}

export function assessFundbazaarHistoricalMonthEnd({
  archive = {}, holdings = [], archiveTransactions = [], ledgerTransactions = [],
  currentPositions = [], historicalPositions = [], snapshots = [], monthKey = "", laterCashFlows = {}, otherMonthArchives = [], weekendNavEvidence = [], supplementalManual = null
} = {}) {
  const blockers = [];
  const notes = [];
  const cutoffDate = lastCalendarDayOfMonth(monthKey);
  const valuationDate = dateKey(archive.valuationDate);
  const ageDays = cutoffDate && valuationDate
    ? Math.floor((Date.parse(`${cutoffDate}T00:00:00Z`) - Date.parse(`${valuationDate}T00:00:00Z`)) / DAY_MS)
    : Infinity;
  if (!cutoffDate) blockers.push("A valid reporting month is required.");
  if (archive.status !== "available" || archive.source !== "fundbazaar") blockers.push("Only available Fundbazaar dated valuation archives can be approved.");
  if (!valuationDate || !cutoffDate || valuationDate.slice(0, 7) !== monthKey || ageDays < 0 || ageDays > MAX_NAV_LAG_DAYS) blockers.push("The NAV date must belong to the reporting month and be no more than seven calendar days before its cutoff.");
  // A legitimate month-end portfolio can have different last-published NAV
  // dates per fund. An old `historyReady: false` on a MIXED-NAV archive only
  // describes the former single-date restriction; it is not proof the prices
  // themselves are invalid. Re-evaluate every holding from immutable evidence.
  if (Number(archive.postValuationTransactionCount || 0) > 0) blockers.push("The source contains transactions after its latest NAV date.");
  if (archive.uniformNavDate === true && archive.historyReady !== true) blockers.push("The archived source did not pass its original completeness checks.");
  if (!Array.isArray(holdings) || !holdings.length || holdings.length !== Number(archive.summary?.holdingCount || 0)) blockers.push("Archived holdings are missing or their count differs from the source summary.");
  const navDates = [...new Set(holdings.map((item) => dateKey(item.navDate)))].filter(Boolean).sort();
  const earliestNavDate = navDates[0] || "";
  const latestNavDate = navDates.at(-1) || "";
  if (!latestNavDate || latestNavDate !== valuationDate) blockers.push("The archived valuation label does not match the newest underlying holding NAV date.");
  // A dated archive may pass all per-source checks while being stale relative
  // to another saved statement for the SAME reporting month.  Do not let staff
  // approve Oct 29 as the closing source when an Oct 30/31 archive exists but
  // needs its own NAV evidence corrected.  This protects month-end performance
  // from quietly falling back to an outdated, easier-to-approve valuation.
  const newerMonthArchives = (Array.isArray(otherMonthArchives) ? otherMonthArchives : [])
    .filter((item) => item.id !== archive.id
      && item.investorId === archive.investorId
      && item.source === "fundbazaar"
      && item.status === "available"
      && dateKey(item.valuationDate).slice(0, 7) === monthKey
      && dateKey(item.valuationDate) > valuationDate
      && dateKey(item.valuationDate) <= cutoffDate)
    .sort((a, b) => String(b.valuationDate || "").localeCompare(String(a.valuationDate || "")));
  if (newerMonthArchives.length) {
    blockers.push(`A newer Fundbazaar source through ${newerMonthArchives[0].valuationDate} is archived for this reporting month. Verify or correct that newer source before approving the older ${valuationDate} valuation; do not bypass a date discrepancy by choosing an earlier NAV.`);
  }
  const invalidDatedHoldings = holdings.filter((item) => {
    const navDate = dateKey(item.navDate);
    const lag = navDate && cutoffDate ? Math.floor((Date.parse(`${cutoffDate}T00:00:00Z`) - Date.parse(`${navDate}T00:00:00Z`)) / DAY_MS) : Infinity;
    return !navDate || navDate.slice(0, 7) !== monthKey || lag < 0 || lag > MAX_NAV_LAG_DAYS;
  });
  if (invalidDatedHoldings.length) blockers.push(`${invalidDatedHoldings.length} holding(s) lack an eligible reporting-month NAV. Each actual NAV must be dated within the reporting month and no more than seven days before its cutoff.`);
  // Treat Saturday just like a weekday when the immutable Fundbazaar source,
  // holding identity, portfolio totals and cash flow ledger reconcile.
  // Separately check that the Saturday holding has a plausible unit x NAV
  // valuation, since a report-as-of date can otherwise masquerade as NAV date.
  // This is source acceptance, NOT an assertion that AMFI verified the NAV.
  const saturdayNavHoldings = holdings.filter((item) => {
    const navDate = dateKey(item.navDate);
    return navDate && new Date(`${navDate}T00:00:00Z`).getUTCDay() === 6;
  });
  const invalidSaturdayNavHoldings = saturdayNavHoldings.filter((item) => {
    const units = Number(item.totalUnits);
    const nav = Number(item.currentNav);
    const current = Number(item.currentValue);
    return !Number.isFinite(units) || units <= 0 || !Number.isFinite(nav) || nav <= 0
      || !Number.isFinite(current) || current <= 0
      || Math.abs(units * nav - current) > Math.max(2, current * 0.0002);
  });
  if (invalidSaturdayNavHoldings.length) blockers.push(`${invalidSaturdayNavHoldings.length} Saturday NAV holding(s) have missing or inconsistent units, NAV or valuation. Reconcile the original Fundbazaar source before approval.`);
  const acceptedSaturdayNavs = saturdayNavHoldings.filter((item) => !invalidSaturdayNavHoldings.includes(item)).map((item) => ({
    isin: String(item.isin || ""), folioNo: String(item.folioNo || ""),
    instrumentName: String(item.instrumentName || item.schemeName || ""),
    navDate: dateKey(item.navDate), sourceNav: Number(item.currentNav),
    evidenceType: "reconciled_fundbazaar_source"
  }));
  if (acceptedSaturdayNavs.length) notes.push(`${acceptedSaturdayNavs.length} Saturday NAV holding(s) accepted as originally dated in the imported Fundbazaar source, subject to the remaining portfolio and transaction checks. This is not an independent AMFI confirmation.`);
  // Sunday remains an exceptional case requiring exact corroboration.
  const weekendNavHoldings = holdings.filter((item) => {
    const navDate = dateKey(item.navDate);
    return navDate && new Date(`${navDate}T00:00:00Z`).getUTCDay() === 0;
  });
  const verifiedWeekendNavs = weekendNavHoldings.map((holding) => officialNavEvidenceFor(holding, weekendNavEvidence));
  const unverifiedWeekendNavs = weekendNavHoldings.filter((_, index) => !verifiedWeekendNavs[index]);
  if (unverifiedWeekendNavs.length) blockers.push(`Unverified Sunday mutual-fund NAV date(s): ${unverifiedWeekendNavs.slice(0, 3).map((item) => `${item.instrumentName || item.schemeName || item.isin || "Holding"} (${item.navDate})`).join(", ")}. Enter exact officially published NAV, matching scheme identity and date, plus AMFI/fund-house reference. Never invent or backdate NAV dates.`);
  if (weekendNavHoldings.length && !unverifiedWeekendNavs.length) notes.push(`Exceptional Sunday NAV date(s) verified against an official NAV record; actual dates are preserved in the report.`);
  if (navDates.length > 1) notes.push(`Different actual NAV dates are present (${navDates.join(", ")}). Each holding retains its original NAV date; these must be the last applicable NAVs for the month-end cutoff.`);
  if (holdings.some((item) => !fundbazaarHoldingKey(item).split("|")[0] || !Number.isFinite(Number(item.currentValue)) || Number(item.currentValue) < 0 || !Number.isFinite(Number(item.totalInvested)) || Number(item.totalInvested) < 0 || !Number.isFinite(Number(item.totalUnits)) || Number(item.totalUnits) < 0)) blockers.push("Some holdings lack valid investment identity, units, invested amount or current value.");
  const holdingsKeys = holdings.map(fundbazaarHoldingKey);
  if (new Set(holdingsKeys).size !== holdingsKeys.length) blockers.push("Duplicate scheme/folio holdings exist in this archived valuation.");
  const sumCurrent = cents(holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0));
  const sumInvested = cents(holdings.reduce((sum, item) => sum + Number(item.totalInvested || 0), 0));
  if (Math.abs(sumCurrent - Number(archive.summary?.currentValue || 0)) > 1 || Math.abs(sumInvested - Number(archive.summary?.totalInvested || 0)) > 1) blockers.push("The archived holding values do not reconcile to the original source totals.");
  const managedIds = new Set((supplementalManual?.ready ? supplementalManual.holdings : []).map((item) => String(item.positionId || item.id || "")));
  const nonFundbazaar = [...currentPositions, ...historicalPositions].filter((item) => {
    if (String(item.source || "").toLowerCase() === "fundbazaar") return false;
    // Additional holdings may only be covered by a separately reconciled,
    // original Manual PMS archive for this same reporting month. A simple
    // manual row or unidentified source must never disappear from reporting.
    return !(supplementalManual?.ready && item.source === "manual" && item.manualPortfolioManaged === true
      && managedIds.has(String(item.positionId || item.id || "")));
  });
  if (nonFundbazaar.length) blockers.push("Other investment sources lack a complete dated month-end archive. Build a full multi-source closing snapshot; do not approve Fundbazaar-only totals.");
  if (supplementalManual && !supplementalManual.ready) blockers.push(...supplementalManual.blockers);
  const combinedClosingDate = supplementalManual?.ready
    ? [valuationDate, supplementalManual.assessment.valuationDate].sort().at(-1)
    : valuationDate;
  const futureVerified = (Array.isArray(snapshots) ? snapshots : []).filter((item) =>
    item.verificationStatus === "verified" && item.snapshotDate > combinedClosingDate && item.snapshotDate <= cutoffDate);
  if (futureVerified.length) blockers.push("A newer verified Portfolio Master snapshot exists after the complete combined source valuation; do not overwrite later financial facts.");
  const laterCount = Number(laterCashFlows?.count || 0);
  if (laterCount) blockers.push(`${laterCount} confirmed cash movement(s) occurred after the source's latest NAV date and before the month-end cutoff.`);
  // A switch/SIP dated after an INDIVIDUAL fund's older NAV invalidates that
  // fund's frozen units even when all other schemes have newer prices.
  const identity = (item) => ({
    isin: String(item.isin || "").trim().toUpperCase(),
    folio: String(item.folioNo || "").trim().toUpperCase(),
    scheme: String(item.schemeName || item.instrumentName || "").trim().toUpperCase()
  });
  const findHoldingForTxn = (txn) => {
    const transaction = identity(txn);
    if (!transaction.isin && !transaction.scheme) return null;
    const matches = holdings.filter((holding) => {
      const target = identity(holding);
      if (transaction.folio && target.folio && transaction.folio !== target.folio) return false;
      return (transaction.isin && target.isin && transaction.isin === target.isin)
        || (transaction.scheme && target.scheme && transaction.scheme === target.scheme);
    });
    return matches.length === 1 ? matches[0] : null;
  };
  const postHoldingNavActivity = [...archiveTransactions, ...ledgerTransactions.filter((item) => String(item.source || "").toLowerCase() === "fundbazaar")].filter((txn) => {
    const transactionDate = dateKey(txn.transactionDate);
    const status = String(txn.transactionStatus || txn.financialImpactStatus || "confirmed").toLowerCase();
    if (!transactionDate || transactionDate <= earliestNavDate || transactionDate > cutoffDate || !isConfirmedInvestmentActivity(txn)) return false;
    const matchingHolding = findHoldingForTxn(txn);
    // If we cannot identify which scheme changed, fail closed. We cannot
    // prove that an earlier NAV still captures that transaction.
    return !matchingHolding || transactionDate > dateKey(matchingHolding.navDate);
  });
  if (postHoldingNavActivity.length) blockers.push(`${postHoldingNavActivity.length} source/ledger investment activity record(s) occurred after a holding's own NAV or could not be matched to a holding. Confirm per-scheme positions before approval.`);
  // Purchases, switch transactions, reinvestments and non-cash quantity changes
  // can invalidate the dated holdings even when external cash movement is zero.
  const laterLedgerTransactions = (Array.isArray(ledgerTransactions) ? ledgerTransactions : []).filter((item) => {
    const d = dateKey(item.transactionDate);
    const status = String(item.transactionStatus || item.financialImpactStatus || "confirmed").toLowerCase();
    return d && d > valuationDate && d <= cutoffDate
      && String(item.source || "").toLowerCase() !== "manual"
      && isConfirmedInvestmentActivity(item);
  });
  if (laterLedgerTransactions.length) blockers.push(`${laterLedgerTransactions.length} investment ledger transaction(s) are dated after the archived NAV and before the reporting cutoff. A later valuation is required.`);
  const imported = monthFlows(archiveTransactions, monthKey);
  const ledger = monthFlows(ledgerTransactions.filter((item) => item.source === "fundbazaar"), monthKey);
  if (imported.count !== ledger.count || Math.abs(imported.newMoney - ledger.newMoney) > 1 || Math.abs(imported.withdrawals - ledger.withdrawals) > 1) blockers.push("Fundbazaar source transactions do not reconcile to the confirmed monthly investment ledger.");
  if (!archiveTransactions.length && ledger.count) blockers.push("Historical transactions are missing from this archive.");
  if (!currentPositions.length && !historicalPositions.length) blockers.push("No Portfolio Master holdings exist to corroborate that the historical archive covers this investor's investment sources.");
  if (ageDays > 0 && Number.isFinite(ageDays)) notes.push(`The statement cutoff is ${cutoffDate}, but holdings have actual NAV dates from ${earliestNavDate || valuationDate} through ${latestNavDate || valuationDate}. Confirm these are the last applicable available NAVs. Never label them as ${cutoffDate} NAVs.`);
  return {
    ready: blockers.length === 0,
    blockers, notes, monthKey, cutoffDate, valuationDate,
    ageDays: Number.isFinite(ageDays) ? ageDays : null,
    navDates, earliestNavDate, latestNavDate,
    verifiedWeekendNavs: verifiedWeekendNavs.filter(Boolean),
    acceptedSaturdayNavs,
    weekendNavsPendingVerification: unverifiedWeekendNavs.length,
    sourceValue: sumCurrent, sourceInvested: sumInvested,
    holdingCount: holdings.length,
    sourceCashFlows: { newMoney: cents(imported.newMoney), withdrawals: cents(imported.withdrawals), count: imported.count },
    ledgerCashFlows: { newMoney: cents(ledger.newMoney), withdrawals: cents(ledger.withdrawals), count: ledger.count }
  };
}
