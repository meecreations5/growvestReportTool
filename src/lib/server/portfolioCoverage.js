import { adminDb } from "@/lib/server/firebaseAdmin";
import { PORTFOLIO_SOURCES } from "@/lib/constants/portfolio";
import { indiaDateKey } from "@/lib/server/portfolioServer";

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function timestampIso(value) {
  const millis = timestampMillis(value);
  return millis ? new Date(millis).toISOString() : "";
}

function dateKeyFromTimestamp(value) {
  const millis = timestampMillis(value);
  return millis ? indiaDateKey(new Date(millis)) : "";
}

function indiaDayRange(dateKey) {
  const safeDateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || "")) ? dateKey : indiaDateKey();
  const start = new Date(`${safeDateKey}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateKey: safeDateKey, start, end };
}

function daysBetween(leftDateKey = "", rightDateKey = "") {
  if (!leftDateKey || !rightDateKey) return null;
  const left = new Date(`${leftDateKey}T00:00:00Z`).getTime();
  const right = new Date(`${rightDateKey}T00:00:00Z`).getTime();
  if (!left || !right) return null;
  return Math.max(0, Math.round((right - left) / (24 * 60 * 60 * 1000)));
}

function latestTimestamp(left, right) {
  return timestampMillis(left) >= timestampMillis(right) ? left : right;
}

function statusPriority(status = "") {
  const priorities = {
    imported: 5,
    review_required: 4,
    failed: 4,
    conflict: 4,
    unsupported: 4,
    needs_package: 4,
    previewed: 3,
    duplicate: 2
  };
  return priorities[status] || 1;
}

function recordStatus(record = {}) {
  if (record.status === "imported") return "updated";
  if (record.matchStatus === "duplicate" || record.status === "duplicate") return "received_duplicate";
  if (["review_required", "failed", "conflict", "unsupported", "needs_package"].includes(record.status)
    || ["review_required", "unmatched", "conflict", "failed", "unsupported"].includes(record.matchStatus)) return "attention";
  return "received";
}

function mergeExpectedMapping(current, mapping) {
  if (!current) {
    return {
      investorId: mapping.investorId,
      investorName: mapping.investorName || "",
      clientCode: mapping.clientCode || "",
      advisorUid: mapping.advisorUid || "",
      coverageEnabled: mapping.coverageEnabled !== false,
      lastSuccessfulImportAt: mapping.lastSuccessfulImportAt || null,
      lastSuccessfulImportId: mapping.lastSuccessfulImportId || "",
      externalClientName: mapping.externalClientName || "",
      externalPan: mapping.externalPan || ""
    };
  }

  return {
    ...current,
    investorName: current.investorName || mapping.investorName || "",
    clientCode: current.clientCode || mapping.clientCode || "",
    advisorUid: current.advisorUid || mapping.advisorUid || "",
    coverageEnabled: current.coverageEnabled !== false && mapping.coverageEnabled !== false,
    lastSuccessfulImportAt: latestTimestamp(current.lastSuccessfulImportAt, mapping.lastSuccessfulImportAt),
    lastSuccessfulImportId: timestampMillis(mapping.lastSuccessfulImportAt) > timestampMillis(current.lastSuccessfulImportAt)
      ? mapping.lastSuccessfulImportId || ""
      : current.lastSuccessfulImportId || "",
    externalClientName: current.externalClientName || mapping.externalClientName || "",
    externalPan: current.externalPan || mapping.externalPan || ""
  };
}

async function dailyFileRecords({ start, end }) {
  const [createdSnapshot, importedSnapshot] = await Promise.all([
    adminDb.collection("portfolioImportFiles")
      .where("createdAt", ">=", start)
      .where("createdAt", "<", end)
      .get(),
    adminDb.collection("portfolioImportFiles")
      .where("importedAt", ">=", start)
      .where("importedAt", "<", end)
      .get()
  ]);

  const records = new Map();
  [...createdSnapshot.docs, ...importedSnapshot.docs].forEach((item) => {
    const data = { id: item.id, ...item.data() };
    if (data.source !== PORTFOLIO_SOURCES.FUNDBAZAAR) return;
    records.set(item.id, data);
  });
  return [...records.values()];
}

export async function buildDailyPortfolioCoverage(actor, { dateKey = indiaDateKey() } = {}) {
  const range = indiaDayRange(dateKey);
  const mappingSnapshot = await adminDb.collection("externalInvestorMappings")
    .where("source", "==", PORTFOLIO_SOURCES.FUNDBAZAAR)
    .get();

  const expectedMap = new Map();
  mappingSnapshot.docs.forEach((item) => {
    const mapping = item.data();
    if (!mapping.investorId || mapping.status !== "verified") return;
    if (actor.role === "advisor" && mapping.advisorUid !== actor.uid) return;
    expectedMap.set(mapping.investorId, mergeExpectedMapping(expectedMap.get(mapping.investorId), mapping));
  });

  const investorIds = [...expectedMap.keys()];
  const investorSnapshots = investorIds.length
    ? await adminDb.getAll(...investorIds.map((investorId) => adminDb.collection("investors").doc(investorId)))
    : [];
  const investorsById = new Map();
  investorSnapshots.forEach((snapshot) => {
    if (!snapshot.exists) return;
    const investor = { id: snapshot.id, ...snapshot.data() };
    if (investor.isDeleted === true) return;
    if (actor.role === "advisor" && investor.assignedAdvisorUid !== actor.uid && investor.advisorUid !== actor.uid) return;
    investorsById.set(investor.id, investor);
  });

  const records = await dailyFileRecords(range);
  const recordsByInvestor = new Map();
  records.forEach((record) => {
    if (!record.matchedInvestorId || !investorsById.has(record.matchedInvestorId)) return;
    const current = recordsByInvestor.get(record.matchedInvestorId) || [];
    current.push(record);
    recordsByInvestor.set(record.matchedInvestorId, current);
  });

  const rows = [];
  const paused = [];
  expectedMap.forEach((mapping, investorId) => {
    const investor = investorsById.get(investorId);
    if (!investor) return;
    const investorRecords = recordsByInvestor.get(investorId) || [];
    const orderedRecords = [...investorRecords].sort((a, b) => {
      const statusDelta = statusPriority(b.status || b.matchStatus) - statusPriority(a.status || a.matchStatus);
      if (statusDelta) return statusDelta;
      return Math.max(timestampMillis(b.importedAt), timestampMillis(b.createdAt)) - Math.max(timestampMillis(a.importedAt), timestampMillis(a.createdAt));
    });
    const selectedRecord = orderedRecords[0] || null;
    const updatedRecord = orderedRecords.find((item) => item.status === "imported") || null;
    const issueRecord = orderedRecords.find((item) => recordStatus(item) === "attention") || null;
    const duplicateRecord = orderedRecords.find((item) => recordStatus(item) === "received_duplicate") || null;

    let status = "missing";
    if (updatedRecord && issueRecord) status = "updated_attention";
    else if (updatedRecord) status = "updated";
    else if (issueRecord) status = "attention";
    else if (duplicateRecord) status = "received_duplicate";
    else if (selectedRecord) status = "received";

    const lastSourceDate = dateKeyFromTimestamp(mapping.lastSuccessfulImportAt);
    const lastPortfolioDate = investor.latestPortfolioSnapshotDate || lastSourceDate;
    const row = {
      investorId,
      investorName: investor.fullName || mapping.investorName || "Investor",
      clientCode: investor.clientCode || mapping.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || mapping.advisorUid || "",
      status: mapping.coverageEnabled === false ? "paused" : status,
      coverageEnabled: mapping.coverageEnabled !== false,
      receivedToday: Boolean(selectedRecord),
      updatedToday: Boolean(updatedRecord),
      issueToday: Boolean(issueRecord),
      duplicateToday: Boolean(duplicateRecord),
      todayFileName: (issueRecord || selectedRecord)?.fileName || "",
      todayReportType: (issueRecord || selectedRecord)?.reportType || "",
      todayFileStatus: (issueRecord || selectedRecord)?.status || (issueRecord || selectedRecord)?.matchStatus || "",
      lastSuccessfulImportAt: timestampIso(mapping.lastSuccessfulImportAt),
      lastSuccessfulImportId: mapping.lastSuccessfulImportId || "",
      lastSourceDate: lastSourceDate || "",
      lastPortfolioDate: lastPortfolioDate || "",
      staleDays: daysBetween(lastSourceDate, range.dateKey),
      portfolioValue: Number(investor.latestPortfolioValue || 0),
      portfolioInvested: Number(investor.latestPortfolioInvested || 0),
      portfolioGainLoss: Number(investor.latestPortfolioGainLoss || 0),
      externalClientName: mapping.externalClientName || "",
      externalPanLast4: String(mapping.externalPan || "").slice(-4)
    };

    if (row.coverageEnabled) rows.push(row);
    else paused.push(row);
  });

  rows.sort((a, b) => {
    const order = { updated_attention: 0, attention: 1, missing: 2, received_duplicate: 3, received: 4, updated: 5 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.investorName.localeCompare(b.investorName);
  });
  paused.sort((a, b) => a.investorName.localeCompare(b.investorName));

  const expectedCount = rows.length;
  const receivedCount = rows.filter((item) => item.receivedToday).length;
  const updatedCount = rows.filter((item) => item.updatedToday).length;
  const missingRows = rows.filter((item) => item.status === "missing");
  const attentionRows = rows.filter((item) => ["attention", "updated_attention"].includes(item.status));
  const duplicateRows = rows.filter((item) => item.status === "received_duplicate");

  const unmatchedIssues = records
    .filter((record) => !record.matchedInvestorId && recordStatus(record) === "attention")
    .filter((record) => actor.role !== "advisor")
    .map((record) => ({
      fileId: record.id,
      fileName: record.fileName || "Portfolio report",
      status: record.status || record.matchStatus || "review_required",
      externalClientName: record.externalClientName || "",
      error: record.importError || record.parseError || "Investor mapping or file review is required."
    }));

  const attentionCount = attentionRows.length + unmatchedIssues.length;
  const completionPercentage = expectedCount ? Number(((receivedCount / expectedCount) * 100).toFixed(1)) : 100;

  return {
    dateKey: range.dateKey,
    source: PORTFOLIO_SOURCES.FUNDBAZAAR,
    primaryReportType: "fundbazaar_portfolio_ledger",
    expectedCount,
    receivedCount,
    updatedCount,
    attentionCount,
    missingCount: missingRows.length,
    duplicateCount: duplicateRows.length,
    pausedCount: paused.length,
    completionPercentage,
    rows,
    paused,
    unmatchedIssues
  };
}
