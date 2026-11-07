/** Strict parser for AMFI public historical NAV text files. Never infer a NAV date. */
const monthNames = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
export function amfiDateKey(input = "") {
  const match = String(input || "").trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return "";
  const month = monthNames[match[2].toUpperCase()];
  const day = Number(match[1]);
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31) return "";
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso ? "" : iso;
}
export function amfiApiDate(iso = "") {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso)) return "";
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return "";
  const month = Object.keys(monthNames)[parsed.getUTCMonth()];
  return `${String(parsed.getUTCDate()).padStart(2, "0")}-${month[0]}${month.slice(1).toLowerCase()}-${parsed.getUTCFullYear()}`;
}
/**
 * NAV history text: Scheme Code;Scheme Name;ISIN Growth/Div Payout;ISIN Div Reinvestment;
 * Net Asset Value;Repurchase Price;Sale Price;Date
 * Unlike name guessing, we only match the exact ISIN, date and reported NAV.
 */
export function parseAmfiHistoricalNav(text = "") {
  const records = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const parts = line.trim().split(";");
    if (parts.length !== 8) continue;
    const date = amfiDateKey(parts[7]);
    const nav = Number(parts[4]);
    const isins = [parts[2], parts[3]].map((x) => String(x || "").trim().toUpperCase()).filter((x) => /^INF[A-Z0-9]{9}$/.test(x));
    if (!date || !Number.isFinite(nav) || nav <= 0 || !isins.length) continue;
    records.push({ code: String(parts[0]).trim(), scheme: String(parts[1]).trim(), isins, date, nav });
  }
  return records;
}
export function matchOfficialNav(holding = {}, records = [], navDate = "") {
  const isin = String(holding.isin || "").trim().toUpperCase();
  const date = String(navDate || holding.navDate || "").slice(0, 10);
  const observedNav = Number(holding.currentNav);
  if (!/^INF[A-Z0-9]{9}$/.test(isin) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(observedNav) || observedNav <= 0) return null;
  const matched = records.filter((row) => row.date === date && row.isins.includes(isin));
  if (matched.length !== 1) return null;
  const published = Number(matched[0].nav);
  if (Math.abs(published - observedNav) > Math.max(0.0001, observedNav * 0.000005)) return null;
  return { isin, folioNo: String(holding.folioNo || ""), schemeName: String(holding.schemeName || holding.instrumentName || ""), navDate: date, publishedNav: published, schemeCode: matched[0].code };
}

/**
 * Prefer independently fetched AMFI evidence over any browser-supplied proof.
 * The latter remains an explicit staff-attestation fallback only; an empty
 * submitted form cannot shadow the server's valid official record.
 */
export function mergeOfficialNavEvidence(official = [], supplied = []) {
  const identity = (item) => [
    String(item.isin || item.schemeName || item.instrumentName || "").trim().toUpperCase(),
    String(item.folioNo || "").trim().toUpperCase(),
    String(item.navDate || "").slice(0, 10)
  ].join("|");
  const primary = Array.isArray(official) ? official : [];
  const primaryKeys = new Set(primary.map(identity));
  return [...primary, ...(Array.isArray(supplied) ? supplied : []).filter((item) => !primaryKeys.has(identity(item)))];
}
