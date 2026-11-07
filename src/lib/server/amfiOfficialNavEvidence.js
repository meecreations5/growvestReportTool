import { amfiApiDate, matchOfficialNav, parseAmfiHistoricalNav } from "../amfiNavHistory.js";

/**
 * Verified NAV records are fetched only from AMFI's public historical feed.
 * Keep a short server-instance cache for repeated monthly close checks across
 * investors. Cache expiry is not permission to accept unverified NAVs.
 */
const navHistoryCache = new Map();
const NAV_CACHE_MS = 15 * 60 * 1000;
const FAILURE_CACHE_MS = 30 * 1000;
const NAV_REQUEST_TIMEOUT_MS = 19000;
const MAX_RESPONSE_LENGTH = 12000000;

// Saturday observations are accepted from a reconciled, original Fundbazaar
// archive. Reserve mandatory official NAV lookup for the rarer Sunday cases.
const isExceptionalNav = (holding = {}) => {
  const date = String(holding.navDate || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    && new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0;
};

function endpoint(fromDate, toDate) {
  return `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=${amfiApiDate(fromDate)}&todt=${amfiApiDate(toDate)}`;
}

function earlierDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

async function downloadOfficialRows(fromDate, toDate) {
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), NAV_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint(fromDate, toDate), {
      signal: controller.signal, redirect: "error", cache: "no-store", headers: { Accept: "text/plain" }
    });
    if (!response.ok) throw new Error(`AMFI returned HTTP ${response.status}`);
    if (Number(response.headers.get("content-length") || 0) > MAX_RESPONSE_LENGTH) throw new Error("AMFI response too large");
    const body = await response.text();
    if (body.length > MAX_RESPONSE_LENGTH) throw new Error("AMFI response too large");
    const records = parseAmfiHistoricalNav(body);
    // AMFI occasionally returns a success status with a no-data stub. This
    // must not be treated as an authoritative declaration that no NAV exists.
    if (!records.length) throw new Error("AMFI returned no usable NAV history rows");
    return records;
  } finally {
    clearTimeout(abort);
  }
}

async function fetchOfficialHistory(date) {
  const now = Date.now();
  const cached = navHistoryCache.get(date);
  if (cached && cached.expiresAt > now) {
    const result = await cached.promise;
    if (result?.error) throw result.error;
    return result;
  }
  // First request a single date. If AMFI times out or serves an incomplete
  // historical response, retry once with a short surrounding date range.
  const promise = (async () => {
    let firstIssue = "";
    try {
      const rows = await downloadOfficialRows(date, date);
      if (rows.some((row) => row.date === date)) return { records: rows, referenceUrl: endpoint(date, date) };
      firstIssue = "Exact-date response omitted the requested NAV date";
    } catch (error) { firstIssue = String(error?.message || "AMFI lookup failed"); }
    try {
      const fromDate = earlierDate(date, 3);
      const rows = await downloadOfficialRows(fromDate, date);
      if (rows.some((row) => row.date === date)) return { records: rows, referenceUrl: endpoint(fromDate, date) };
      throw new Error("No NAV record exists for the requested date in the official AMFI range");
    } catch (error) {
      throw new Error(`${firstIssue}; retry: ${String(error?.message || "AMFI lookup failed")}`);
    }
  })();
  const entry = { promise, expiresAt: now + NAV_CACHE_MS };
  navHistoryCache.set(date, entry);
  try {
    return await promise;
  } catch (error) {
    navHistoryCache.set(date, { promise: Promise.resolve({ error }), expiresAt: Date.now() + FAILURE_CACHE_MS });
    throw error;
  }
}

/**
 * Return exact ISIN + date + observed NAV evidence for exceptional SUNDAY dates.
 * Saturdays do not invoke the slow AMFI lookup and are assessed instead against
 * the immutable Fundbazaar source and per-holding financial reconciliation.
 * Network failure or mismatch for an exceptional Sunday remains blocking.
 */
export async function loadOfficialWeekendNavEvidence(holdings = []) {
  const exceptional = holdings.filter(isExceptionalNav);
  if (!exceptional.length) return { evidence: [], verified: 0, required: 0, issue: "" };
  const dates = [...new Set(exceptional.map((x) => String(x.navDate).slice(0, 10)))];
  if (dates.length > 5 || exceptional.length > 50) return { evidence: [], verified: 0, required: exceptional.length, issue: "Too many exceptional NAV dates to verify automatically." };
  const evidence = [];
  const issues = [];
  const fetched = await Promise.all(dates.map(async (date) => {
    try { return { date, ...(await fetchOfficialHistory(date)) }; }
    catch (error) { return { date, records: [], issue: String(error?.message || "AMFI unavailable").slice(0, 180) }; }
  }));
  for (const { date, records, referenceUrl, issue } of fetched) {
    if (issue) issues.push(`${date}: ${issue}`);
    for (const holding of exceptional.filter((x) => x.navDate === date)) {
      const match = matchOfficialNav(holding, records, date);
      if (match) {
        evidence.push({ ...match, referenceUrl, evidenceType: "automated_amfi_history_match" });
      }
    }
  }
  const unmatched = exceptional.length - evidence.length;
  return {
    evidence,
    verified: evidence.length,
    required: exceptional.length,
    issue: unmatched > 0
      ? issues.join("; ") || `${unmatched} NAV(s) could not be matched exactly by ISIN, date, and amount against official AMFI data.`
      : ""
  };
}
