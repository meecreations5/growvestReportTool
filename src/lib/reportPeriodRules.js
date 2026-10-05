function dateKey(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function previousCompletedMonthPeriod(year, month) {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  if (!Number.isFinite(numericYear) || !Number.isFinite(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    return { month: 0, year: 0 };
  }
  const previous = new Date(Date.UTC(numericYear, numericMonth - 2, 1));
  return { month: previous.getUTCMonth() + 1, year: previous.getUTCFullYear() };
}

export function openingReportMonthKey(openingReport = {}) {
  const explicit = String(openingReport?.reportMonthKey || "").trim();
  if (/^\d{4}-\d{2}$/.test(explicit)) return explicit;
  const statementDate = dateKey(
    openingReport?.statementDate
      || openingReport?.openingBaseline?.statementDate
      || openingReport?.portfolioAsOfDate
  );
  return statementDate ? statementDate.slice(0, 7) : "";
}

export function openingReportStatementDate(openingReport = {}) {
  return dateKey(
    openingReport?.statementDate
      || openingReport?.openingBaseline?.statementDate
      || openingReport?.portfolioAsOfDate
  );
}

export function sameMonthOpeningBaselineDate(openingReport, monthlyStatementDate = "") {
  const openingDate = openingReportStatementDate(openingReport);
  const monthlyDate = dateKey(monthlyStatementDate);
  if (!openingDate || !monthlyDate) return "";
  if (openingDate.slice(0, 7) !== monthlyDate.slice(0, 7)) return "";
  return openingDate < monthlyDate ? openingDate : "";
}

// A Monthly Wealth Review may follow an Opening Wealth Review in the same
// calendar month when the monthly cutoff is strictly later than the opening
// baseline snapshot. Example: Opening 11 Sep -> Monthly 30 Sep is valid.
// If the Opening baseline itself is 30 Sep, September cannot also be a Monthly
// period because no later September portfolio cutoff exists.
export function isMonthlyPeriodAfterOpening(openingReport, reportMonthKey, statementDate = "") {
  if (!openingReport) return true;
  const monthlyMonthKey = String(reportMonthKey || "").trim();
  const openingMonth = openingReportMonthKey(openingReport);
  if (!/^\d{4}-\d{2}$/.test(monthlyMonthKey) || !openingMonth) return false;
  if (monthlyMonthKey > openingMonth) return true;
  if (monthlyMonthKey < openingMonth) return false;

  const openingDate = openingReportStatementDate(openingReport);
  const monthlyDate = dateKey(statementDate);
  if (!openingDate || !monthlyDate) return false;
  return monthlyDate > openingDate;
}
