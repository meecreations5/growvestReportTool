/**
 * Source-aware month-end reconciliation for frozen Portfolio Master positions.
 * A global snapshotDate is insufficient for MIXED mutual funds and Manual PMS:
 * each holding can have its own real NAV/valuation date. The closing snapshot
 * is ineligible if a later confirmed cash movement or internal trade could
 * change its units or value. This module only inspects, never mutates data.
 */
import { externalPortfolioCashFlow, isConfirmedInvestmentActivity } from "./portfolioPeriodCoverage.js";

const dateKey = (value) => {
  const key = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  const parsed = Date.parse(`${key}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === key ? key : "";
};
const norm = (value) => String(value || "").trim().toUpperCase();
const sourceOf = (item = {}) => {
  const source = String(item.source || "").toLowerCase();
  if (source === "fundbazaar" || source === "manual") return source;
  if (source === "investor_action_confirmation") {
    return item.manualPortfolioAccountCode || item.accountCode ? "manual" : "";
  }
  return "";
};
const sourceDate = (position) => dateKey(position.navDate || position.valuationDate || position.priceDate);
const txDate = (item) => dateKey(item.actualFinancialDate || item.transactionDate || item.entryDate || item.actionDate || item.date);

function eligibleMatchingPositions(txn, positions) {
  const source = sourceOf(txn);
  const candidates = source ? positions.filter((item) => sourceOf(item) === source) : positions;
  if (!candidates.length) return [];
  const id = norm(txn.positionId);
  if (id) {
    const matched = candidates.filter((item) => [item.positionId, item.id].some((v) => norm(v) === id));
    if (matched.length) return matched;
  }
  const isin = norm(txn.isin);
  const folio = norm(txn.folioNo || txn.folio);
  if (isin) {
    const matched = candidates.filter((item) => norm(item.isin) === isin && (!folio || !norm(item.folioNo) || norm(item.folioNo) === folio));
    if (matched.length) return matched;
  }
  const account = norm(txn.manualPortfolioAccountCode || txn.accountCode);
  if (account && source === "manual") {
    const matched = candidates.filter((item) => norm(item.manualPortfolioAccountCode || item.accountCode) === account);
    if (matched.length) return matched;
  }
  const scheme = norm(txn.schemeName || txn.instrumentName);
  if (scheme) {
    const matched = candidates.filter((item) => norm(item.schemeName || item.instrumentName) === scheme && (!folio || !norm(item.folioNo) || norm(item.folioNo) === folio));
    if (matched.length) return matched;
  }
  // Unknown scheme identity must NOT be silently assigned to the newest NAV
  // just because an unrelated holding was priced later.
  return candidates;
}

export function inspectFrozenMonthlyActivity({ snapshot = {}, positions = [], transactions = [], cutoffDate = "", startDate = "" } = {}) {
  const cutoff = dateKey(cutoffDate);
  const start = dateKey(startDate);
  const snapshotDate = dateKey(snapshot.snapshotDate);
  const frozen = Array.isArray(positions) ? positions : [];
  const sources = [...new Set(frozen.map(sourceOf))].filter(Boolean).sort();
  const result = {
    ready: true,
    snapshotDate,
    cutoffDate: cutoff,
    sources,
    postValuationCash: { count: 0, newMoney: 0, withdrawals: 0, latestDate: "" },
    postValuationActivity: { count: 0, latestDate: "" },
    invalidPositionDates: 0,
    movements: []
  };
  if (!cutoff || !snapshotDate || snapshotDate > cutoff) {
    result.ready = false;
    result.invalidPositionDates += 1;
    return result;
  }
  for (const position of frozen) {
    const d = sourceDate(position);
    if ((!d && snapshot.reportSnapshotMode?.startsWith("approved_historical")) || d > cutoff) result.invalidPositionDates += 1;
  }
  const expectedPositions = Number(snapshot.summary?.positionCount || 0);
  if (expectedPositions > 0 && frozen.length !== expectedPositions) result.invalidPositionDates += 1;
  const earliestFrozen = frozen.map(sourceDate).filter(Boolean).sort()[0] || snapshotDate;
  for (const txn of Array.isArray(transactions) ? transactions : []) {
    const d = txDate(txn);
    if (!d || d > cutoff || (start && d < start) || !isConfirmedInvestmentActivity(txn)) continue;
    const matches = eligibleMatchingPositions(txn, frozen);
    const comparisonDates = matches.map(sourceDate).filter(Boolean);
    const frozenThrough = comparisonDates.sort()[0] || (frozen.length ? earliestFrozen : snapshotDate);
    if (d <= frozenThrough) continue;
    const external = externalPortfolioCashFlow(txn);
    const amount = Number(external.newMoney || external.withdrawals || 0);
    // Keep a small diagnostic sample, never a synthetic post-valuation NAV.
    if (result.movements.length < 12) result.movements.push({
      date: d, source: sourceOf(txn) || "unresolved", type: String(txn.transactionType || txn.type || ""),
      frozenThrough, cashFlowType: String(txn.cashFlowType || ""), amount: Math.round(amount * 100) / 100
    });
    result.postValuationActivity.count += 1;
    if (d > result.postValuationActivity.latestDate) result.postValuationActivity.latestDate = d;
    if (external.newMoney || external.withdrawals) {
      result.postValuationCash.count += 1;
      result.postValuationCash.newMoney += external.newMoney;
      result.postValuationCash.withdrawals += external.withdrawals;
      if (d > result.postValuationCash.latestDate) result.postValuationCash.latestDate = d;
    }
  }
  result.postValuationCash.newMoney = Math.round(result.postValuationCash.newMoney * 100) / 100;
  result.postValuationCash.withdrawals = Math.round(result.postValuationCash.withdrawals * 100) / 100;
  result.ready = result.invalidPositionDates === 0 && result.postValuationActivity.count === 0;
  return result;
}

/**
 * Reject a supposedly complete closing snapshot when another imported source
 * has month-end financial evidence that the frozen snapshot omits. This is
 * especially important when a later Manual PMS import is added after an
 * earlier Fundbazaar-only historical closing was approved.
 */
export function inspectFrozenSourceSet({ snapshot = {}, positions = [], archives = [], cutoffDate = "" } = {}) {
  const cutoff = dateKey(cutoffDate);
  const monthKey = cutoff.slice(0, 7);
  const frozenSources = new Set((Array.isArray(positions) ? positions : []).map(sourceOf).filter(Boolean));
  const dated = (Array.isArray(archives) ? archives : [])
    .filter((item) => item.status === "available" && item.source
      && dateKey(item.valuationDate)?.slice(0, 7) === monthKey
      && dateKey(item.valuationDate) <= cutoff);
  const issues = [];
  const sameSourceDay = new Map();
  for (const item of dated) {
    const key = `${String(item.source).toLowerCase()}|${dateKey(item.valuationDate)}`;
    const prior = sameSourceDay.get(key);
    if (!prior) { sameSourceDay.set(key, item); continue; }
    // Repeated daily uploads can share the same legitimate NAV date. Only
    // contradicting financial totals (rather than different file hashes or
    // upload timestamps alone) require an explicit source-version resolution.
    if (Math.abs(Number(item.summary?.currentValue || 0) - Number(prior.summary?.currentValue || 0)) > 1
      || Math.abs(Number(item.summary?.totalInvested || 0) - Number(prior.summary?.totalInvested || 0)) > 1
      || Number(item.summary?.holdingCount || 0) !== Number(prior.summary?.holdingCount || 0)) {
      issues.push({ code: "conflicting_archive_versions", source: String(item.source), valuationDate: item.valuationDate,
        message: `Two ${item.source} archives share valuation date ${item.valuationDate} but disagree financially. Resolve the original source version before closing.` });
    }
  }
  const latest = new Map();
  for (const item of dated) {
    const source = String(item.source || "").toLowerCase();
    const old = latest.get(source);
    if (!old || String(item.valuationDate) > String(old.valuationDate)) latest.set(source, item);
  }
  for (const [source, item] of latest) {
    if (!frozenSources.has(source)) {
      issues.push({ code: "missing_source", source, archiveId: item.id, valuationDate: item.valuationDate,
        message: `A ${source} archive dated ${item.valuationDate} exists, but the frozen month-end portfolio omits that source.` });
      continue;
    }
    const frozenDate = dateKey(snapshot.sourceValuationDates?.[source]) || dateKey(snapshot.snapshotDate);
    if (frozenDate && dateKey(item.valuationDate) > frozenDate) {
      issues.push({ code: "newer_source", source, archiveId: item.id, valuationDate: item.valuationDate,
        message: `A newer ${source} archive dated ${item.valuationDate} exists after the source used by this report (${frozenDate}).` });
    }
  }
  return { ready: issues.length === 0, issues, frozenSources: [...frozenSources].sort(),
    archivedSources: [...latest.keys()].sort() };
}
