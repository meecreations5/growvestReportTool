function dateKey(value = "") {
  return String(value || "").slice(0, 10);
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return Number(value.toMillis() || 0);
  if (typeof value?.toDate === "function") return Number(value.toDate()?.getTime?.() || 0);
  if (typeof value === "object" && Number.isFinite(Number(value.seconds))) {
    return Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function snapshotRevisionValue(snapshot = {}) {
  const version = Number(snapshot.snapshotVersion || 0);
  const updated = timestampMillis(snapshot.updatedAt || snapshot.capturedAt || snapshot.createdAt);
  return { version: Number.isFinite(version) ? version : 0, updated };
}

export function comparePortfolioSnapshots(a = {}, b = {}) {
  const dateCompare = dateKey(a.snapshotDate).localeCompare(dateKey(b.snapshotDate));
  if (dateCompare) return dateCompare;
  const ar = snapshotRevisionValue(a);
  const br = snapshotRevisionValue(b);
  if (ar.version !== br.version) return ar.version - br.version;
  if (ar.updated !== br.updated) return ar.updated - br.updated;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function latestVerifiedPortfolioSnapshot(snapshots = [], predicate = () => true) {
  return [...(Array.isArray(snapshots) ? snapshots : [])]
    .filter((item) => item?.verificationStatus === "verified" && predicate(item))
    .sort(comparePortfolioSnapshots)
    .at(-1) || null;
}

export function latestPortfolioSnapshotByMonth(snapshots = []) {
  const latestByMonth = new Map();
  [...(Array.isArray(snapshots) ? snapshots : [])]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey(item?.snapshotDate)))
    .sort(comparePortfolioSnapshots)
    .forEach((item) => latestByMonth.set(dateKey(item.snapshotDate).slice(0, 7), item));
  return latestByMonth;
}

/**
 * Select a verified portfolio snapshot for report creation. Historical Monthly
 * Reviews must never look beyond the requested cutoff. A first Opening Review
 * may instead establish its baseline from the latest verified snapshot through
 * today when no on/before-cutoff source exists; its displayed statement date
 * must then be the actual snapshot date, never the previous month's cutoff.
 */
export function selectVerifiedReportSnapshot(snapshots = [], cutoffDate = "", { reportType = "monthly", todayDate = "" } = {}) {
  const date = dateKey(cutoffDate);
  const selected = latestVerifiedPortfolioSnapshot(snapshots, (item) =>
    Boolean(dateKey(item.snapshotDate) && dateKey(item.snapshotDate) <= date)
  );
  if (selected || reportType !== "opening") return selected;
  const today = dateKey(todayDate);
  if (!today) return null;
  return latestVerifiedPortfolioSnapshot(snapshots, (item) =>
    Boolean(dateKey(item.snapshotDate) && dateKey(item.snapshotDate) <= today)
  );
}

/**
 * Monthly reports prefer a specifically approved historical close over a
 * same-date operational snapshot. The latter can carry a high revision number
 * while still containing old NAVs from a different investment source.
 * Future-dated or incomplete approvals are excluded; newer actual dates win.
 */
export function selectVerifiedMonthEndClosingSnapshot(snapshots = [], cutoffDate = "") {
  const cutoff = dateKey(cutoffDate);
  const ordinary = latestVerifiedPortfolioSnapshot(snapshots, (item) => dateKey(item.snapshotDate) <= cutoff);
  const approved = [...(Array.isArray(snapshots) ? snapshots : [])]
    .filter((item) => item?.verificationStatus === "verified" && dateKey(item.snapshotDate) <= cutoff
      && dateKey(item.reportCutoffDate) === cutoff
      && ["approved_historical_source", "approved_historical_multi_source"].includes(item.reportSnapshotMode))
    .sort((a, b) => {
      const dateCompare = dateKey(a.snapshotDate).localeCompare(dateKey(b.snapshotDate));
      if (dateCompare) return dateCompare;
      const aMulti = a.reportSnapshotMode === "approved_historical_multi_source" ? 1 : 0;
      const bMulti = b.reportSnapshotMode === "approved_historical_multi_source" ? 1 : 0;
      if (aMulti !== bMulti) return aMulti - bMulti;
      return comparePortfolioSnapshots(a, b);
    }).at(-1);
  if (!approved || (ordinary && dateKey(ordinary.snapshotDate) > dateKey(approved.snapshotDate))) return ordinary;
  return approved;
}
