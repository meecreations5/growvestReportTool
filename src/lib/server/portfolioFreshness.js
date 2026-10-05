const DAY_MS = 24 * 60 * 60 * 1000;

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((number(value) + Number.EPSILON) * factor) / factor;
}

export function safeDateKey(value = "") {
  if (value && typeof value.toDate === "function") return safeDateKey(value.toDate());
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function dateKeyFromManualBulkImportId(value = "") {
  const match = /^manual_pms_(\d{11,})_/i.exec(String(value || "").trim());
  if (!match) return "";
  const millis = Number(match[1]);
  if (!Number.isFinite(millis) || millis <= 0) return "";
  // Convert the UTC epoch into the India calendar date used by GrowVest.
  return new Date(millis + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function manualPortfolioRefreshDate(position = {}) {
  if (String(position.source || "").toLowerCase() !== "manual") return "";
  const explicit = [
    position.manualImportDate,
    position.manualSourceRefreshDate,
    position.sourceRefreshDate,
    position.manualPortfolioImportDate
  ].map(safeDateKey).find(Boolean);
  if (explicit) return explicit;
  return dateKeyFromManualBulkImportId(position.manualBulkImportId);
}

export function portfolioPositionFreshnessDate(position = {}) {
  const manualRefreshDate = manualPortfolioRefreshDate(position);
  if (manualRefreshDate) return manualRefreshDate;
  return safeDateKey(position.navDate || position.valuationDate || position.priceDate || "");
}

export function freshnessAgeDays(referenceDate = "", sourceDate = "") {
  const reference = safeDateKey(referenceDate);
  const source = safeDateKey(sourceDate);
  if (!reference || !source) return null;
  const left = Date.parse(`${reference}T00:00:00Z`);
  const right = Date.parse(`${source}T00:00:00Z`);
  if (Number.isNaN(left) || Number.isNaN(right)) return null;
  return Math.max(0, Math.floor((left - right) / DAY_MS));
}

export function buildPortfolioSourceFreshness(positions = [], referenceDate = "", thresholds = {}) {
  const freshDays = Number(thresholds.FRESH_DAYS ?? 3);
  const staleDays = Number(thresholds.STALE_DAYS ?? 7);
  const criticalDays = Number(thresholds.CRITICAL_STALE_DAYS ?? 31);
  const bySource = new Map();

  for (const position of Array.isArray(positions) ? positions : []) {
    const source = String(position.source || "manual");
    const manualManaged = source === "manual" && Boolean(position.manualPortfolioManaged || position.manualInvestmentTemplate || manualPortfolioRefreshDate(position));
    const current = bySource.get(source) || {
      source,
      sourceLabel: manualManaged ? "Manual Portfolio" : (position.provider || source),
      valuationDate: "",
      oldestValuationDate: "",
      sourceRefreshDate: "",
      oldestSourceRefreshDate: "",
      freshnessBasis: manualManaged ? "manual_import" : "valuation_date",
      missingDateCount: 0,
      positionCount: 0,
      currentValue: 0
    };

    current.positionCount += 1;
    current.currentValue += number(position.currentValue);
    if (manualManaged) {
      current.sourceLabel = current.sourceLabel === source ? "Manual Portfolio" : current.sourceLabel;
      current.freshnessBasis = "manual_import";
    }

    const date = portfolioPositionFreshnessDate(position);
    if (!date) current.missingDateCount += 1;
    if (date && (!current.valuationDate || date > current.valuationDate)) current.valuationDate = date;
    if (date && (!current.oldestValuationDate || date < current.oldestValuationDate)) current.oldestValuationDate = date;
    if (date && (!current.sourceRefreshDate || date > current.sourceRefreshDate)) current.sourceRefreshDate = date;
    if (date && (!current.oldestSourceRefreshDate || date < current.oldestSourceRefreshDate)) current.oldestSourceRefreshDate = date;
    bySource.set(source, current);
  }

  return [...bySource.values()].map((item) => {
    const latestAgeDays = freshnessAgeDays(referenceDate, item.valuationDate);
    const oldestAgeDays = freshnessAgeDays(referenceDate, item.oldestValuationDate || item.valuationDate);
    let freshnessStatus = "fresh";
    if (item.missingDateCount > 0 || oldestAgeDays === null) freshnessStatus = "missing";
    else if (oldestAgeDays > criticalDays) freshnessStatus = "critical";
    else if (oldestAgeDays > staleDays) freshnessStatus = "stale";
    else if (oldestAgeDays > freshDays) freshnessStatus = "aging";
    return {
      ...item,
      currentValue: round(item.currentValue),
      ageDays: oldestAgeDays,
      latestAgeDays,
      oldestAgeDays,
      freshnessStatus
    };
  });
}
