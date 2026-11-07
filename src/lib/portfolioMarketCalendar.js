/**
 * Source-specific Indian market calendar for monthly reporting.
 * A stock-exchange trading session does NOT establish a mutual-fund NAV date:
 * AMCs/AMFI remain the authority for published scheme NAV observations.
 *
 * Official 2026 NSE reference:
 * https://www.nseindia.com/resources/exchange-communication-holidays
 * NSE/CMTR/71775 and NSE/FAOP/71777 confirm the special 2026-11-08
 * Sunday Diwali Muhurat trading session. This calendar is intentionally
 * versioned; dates outside the documented year are only weekday estimates.
 */
const NSE_2026_CASH_HOLIDAYS = new Set([
  "2026-01-15", "2026-01-26", "2026-03-03", "2026-03-26",
  "2026-03-31", "2026-04-03", "2026-04-14", "2026-05-01",
  "2026-05-28", "2026-06-26", "2026-09-14", "2026-10-02",
  "2026-10-20", "2026-11-10", "2026-11-24", "2026-12-25"
]);

const SPECIAL_EXCHANGE_SESSIONS = Object.freeze({
  "2026-11-08": Object.freeze({
    segments: ["nse_cash", "nse_derivatives", "bse_cash"],
    name: "Diwali Muhurat trading",
    source: "NSE 2026 exchange holiday circulars and NSE/CMTR/76941"
  })
});

function validDate(value = "") {
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? date : "";
}

const exchangeSegments = new Set(["nse_cash", "nse_derivatives", "bse_cash"]);
const subtractDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

export function marketSessionOn(date, segment = "nse_cash") {
  const key = validDate(date);
  if (!key) return { date: "", segment, trading: false, definitive: false, reason: "invalid_date" };
  // The NAV calendar is controlled by the fund house. Sunday Muhurat trading
  // of equities must NEVER be interpreted as a Sunday mutual-fund NAV.
  if (segment === "mutual_fund_nav") return {
    date: key, segment, trading: null, definitive: false,
    reason: "requires_actual_amc_nav_publication"
  };
  if (!exchangeSegments.has(segment)) return {
    date: key, segment, trading: null, definitive: false,
    reason: "instrument_source_calendar_required"
  };
  const special = SPECIAL_EXCHANGE_SESSIONS[key];
  if (special && special.segments.includes(segment)) return {
    date: key, segment, trading: true, definitive: true,
    reason: "official_special_session", sessionName: special.name, source: special.source
  };
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
  if (key.slice(0, 4) === "2026" && NSE_2026_CASH_HOLIDAYS.has(key)) return {
    date: key, segment, trading: false, definitive: true, reason: "official_exchange_holiday"
  };
  return {
    date: key, segment, trading: weekday !== 0 && weekday !== 6,
    definitive: key.slice(0, 4) === "2026" && segment === "nse_cash",
    reason: weekday === 0 || weekday === 6 ? "normal_weekend" : "weekday_session",
    source: key.slice(0, 4) === "2026" ? "NSE 2026 trading calendar" : "provisional_weekday_only"
  };
}

/** Never use this for AMC/NAV publication, only for an exchange instrument. */
export function lastExchangeSessionOnOrBefore(date, segment = "nse_cash") {
  let candidate = validDate(date);
  if (!candidate || !exchangeSegments.has(segment)) return { date: "", definitive: false, reason: "invalid_exchange_date_or_segment" };
  for (let attempts = 0; attempts < 16; attempts++) {
    const session = marketSessionOn(candidate, segment);
    if (session.trading) return session;
    candidate = subtractDay(candidate);
  }
  return { date: "", definitive: false, reason: "calendar_lookup_unavailable", segment };
}

export function portfolioValuationCalendar(position = {}) {
  const source = String(position.source || "").toLowerCase();
  const product = String(position.productType || "").toLowerCase();
  const asset = String(position.assetClass || "").toLowerCase();
  if (source === "fundbazaar" || /mutual[_ -]?fund/.test(product)) return "mutual_fund_nav";
  if (source === "manual" || /pms|ulip|insurance|fixed[_ -]?deposit|bond/.test(product)) return "source_reported";
  if (/stock|equity|delivery|intraday|listed/.test(`${product} ${asset}`)) return "nse_cash";
  return "source_reported";
}

export const OFFICIAL_SPECIAL_MARKET_SESSIONS = SPECIAL_EXCHANGE_SESSIONS;
