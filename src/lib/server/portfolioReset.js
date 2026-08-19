import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { PORTFOLIO_SOURCES } from "@/lib/constants/portfolio";
import { normaliseExternalName } from "@/lib/server/portfolioImportParser";

const PORTFOLIO_META_FIELDS = [
  "latestPortfolioSnapshotId",
  "latestPortfolioSnapshotDate",
  "latestPortfolioValue",
  "latestPortfolioInvested",
  "latestPortfolioGainLoss",
  "latestPortfolioMonthlySip",
  "latestPortfolioReconciliationStatus",
  "latestPortfolioIssueCount",
  "latestPortfolioNewHoldingCount",
  "latestPortfolioExitedHoldingCount",
  "latestPortfolioUnassignedCount",
  "latestPortfolioUpdatedAt",
  "fundbazaarDailyTrackingEnabled"
];

function clean(value) {
  return String(value ?? "").trim();
}

function upper(value) {
  return clean(value).toUpperCase();
}

function docRows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
}

function uniqueDocs(...groups) {
  const rows = new Map();
  groups.flat().filter(Boolean).forEach((item) => rows.set(item.ref.path, item));
  return [...rows.values()];
}

async function investorRows(collectionName, investorId) {
  const snapshot = await adminDb.collection(collectionName).where("investorId", "==", investorId).get();
  return docRows(snapshot);
}

function isPortfolioActivity(row = {}) {
  const recordType = clean(row.recordType).toLowerCase();
  const action = clean(row.action).toLowerCase();
  return recordType.includes("portfolio")
    || recordType.includes("trading")
    || recordType === "sip_funding"
    || action.includes("portfolio")
    || action.includes("trading")
    || action.includes("sip_funding");
}

function positionValue(rows = []) {
  return Number(rows.reduce((sum, item) => sum + Number(item.currentValue || 0), 0).toFixed(2));
}

function importFileBelongsToInvestor(file = {}, investor = {}) {
  const investorId = clean(investor.id);
  if (clean(file.matchedInvestorId) === investorId || clean(file.investorId) === investorId) return true;

  // Preview suggestions are useful for reset attribution, but a weak fuzzy
  // suggestion must never be enough to delete another investor's file.
  if (Array.isArray(file.suggestions) && file.suggestions.some((item) => {
    if (clean(item?.investorId) !== investorId) return false;
    return item?.exact === true || Number(item?.score || 0) >= 0.9;
  })) return true;

  const clientCode = upper(investor.clientCode);
  if (clientCode && [file.matchedClientCode, file.externalClientCode].some((value) => upper(value) === clientCode)) return true;

  const pan = upper(investor.panNumber || investor.panNormalized);
  if (pan && upper(file.externalPan) === pan) return true;

  const externalName = normaliseExternalName(file.normalizedExternalClientName || file.externalClientName || "");
  const investorNames = [investor.fullName, investor.name]
    .map((value) => normaliseExternalName(value || ""))
    .filter(Boolean);
  if (externalName && investorNames.includes(externalName)) return true;
  return false;
}

async function loadImportFiles(investor) {
  const investorId = investor.id;
  const queries = [adminDb.collection("portfolioImportFiles").where("matchedInvestorId", "==", investorId).get()];
  if (investor.clientCode) queries.push(adminDb.collection("portfolioImportFiles").where("matchedClientCode", "==", investor.clientCode).get());
  const pan = upper(investor.panNumber || investor.panNormalized);
  if (pan) queries.push(adminDb.collection("portfolioImportFiles").where("externalPan", "==", pan).get());
  const normalizedNames = [...new Set([investor.fullName, investor.name]
    .map((value) => normaliseExternalName(value || ""))
    .filter(Boolean))];
  normalizedNames.forEach((name) => {
    queries.push(adminDb.collection("portfolioImportFiles").where("normalizedExternalClientName", "==", name).get());
  });
  const snapshots = await Promise.all(queries);
  return uniqueDocs(...snapshots.map(docRows)).filter((item) => importFileBelongsToInvestor(item, investor));
}

async function loadImportBatchPlans(importFiles, investorId) {
  const deletedFileIds = new Set(importFiles.map((item) => item.id));
  const referencedBatchIds = new Set(importFiles.map((item) => clean(item.batchId)).filter(Boolean));
  // An Investor can exist only in a historical daily-coverage missing list
  // for a batch that contains no file attributable to them. Full Reset must
  // clear those old coverage references too, so this rare Super Admin action
  // deliberately scans the import batch history.
  const batchHistorySnapshot = await adminDb.collection("portfolioImports").get();
  const batchSnapshots = batchHistorySnapshot.docs.filter((snapshot) => {
    const batch = snapshot.data() || {};
    return referencedBatchIds.has(snapshot.id)
      || (Array.isArray(batch.missingInvestors) && batch.missingInvestors.some((item) => clean(item?.investorId) === investorId));
  });
  if (!batchSnapshots.length) return [];
  const plans = [];

  for (const batchSnapshot of batchSnapshots) {
    const batch = { id: batchSnapshot.id, ref: batchSnapshot.ref, ...batchSnapshot.data() };
    const fileIds = Array.isArray(batch.fileIds) ? batch.fileIds : [];
    const candidateRemainingIds = fileIds.filter((id) => !deletedFileIds.has(id));
    const remainingSnapshots = candidateRemainingIds.length
      ? await adminDb.getAll(...candidateRemainingIds.map((id) => adminDb.collection("portfolioImportFiles").doc(id)))
      : [];
    const remainingFiles = remainingSnapshots.filter((item) => item.exists).map((item) => ({ id: item.id, ...item.data() }));
    const remainingIds = remainingFiles.map((item) => item.id);
    const previewCounts = remainingFiles.reduce((total, file) => {
      const key = file.matchStatus || "unknown";
      total[key] = (total[key] || 0) + 1;
      return total;
    }, {});
    const sourceCounts = remainingFiles.reduce((total, file) => {
      const key = file.source || "manual";
      total[key] = (total[key] || 0) + 1;
      return total;
    }, {});
    const importedFiles = remainingFiles.filter((file) => file.status === "imported");
    const duplicateFiles = remainingFiles.filter((file) => file.status === "duplicate" || file.matchStatus === "duplicate");
    const readyCount = remainingFiles.filter((file) => file.adapterStatus === "ready" && !["duplicate", "conflict"].includes(file.matchStatus)).length;
    const issueCount = remainingFiles.filter((file) => !["imported", "duplicate"].includes(file.status)).length;
    const investorCount = new Set(importedFiles.map((file) => clean(file.matchedInvestorId)).filter(Boolean)).size;
    const missingInvestors = Array.isArray(batch.missingInvestors)
      ? batch.missingInvestors.filter((item) => clean(item?.investorId) !== investorId)
      : [];

    plans.push({
      batch,
      remainingIds,
      remainingFiles,
      deleteBatch: remainingIds.length === 0 && missingInvestors.length === 0,
      update: {
        fileIds: remainingIds,
        fileCount: remainingIds.length,
        previewCounts,
        sourceCounts,
        readyCount,
        previewIssueCount: issueCount,
        importedCount: importedFiles.length,
        duplicateCount: duplicateFiles.length,
        issueCount,
        investorCount,
        totalCurrentValue: Number(importedFiles.reduce((sum, file) => sum + Number(file.summary?.currentValue || file.currentValue || 0), 0).toFixed(2)),
        missingInvestors,
        missingInvestorCount: missingInvestors.length,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  }
  return plans;
}


function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isOrphanFundbazaarIssueFile(file = {}, cutoffMillis = Date.now()) {
  if (file.source !== PORTFOLIO_SOURCES.FUNDBAZAAR) return false;
  if (clean(file.matchedInvestorId) || clean(file.investorId)) return false;
  if (["imported", "duplicate"].includes(clean(file.status).toLowerCase())) return false;
  if (clean(file.matchStatus).toLowerCase() === "duplicate") return false;
  const createdMillis = timestampMillis(file.createdAt);
  return !createdMillis || createdMillis <= cutoffMillis;
}

async function rebuildImportBatchAfterFileRemoval(batchId, deletedFileIds) {
  const batchRef = adminDb.collection("portfolioImports").doc(batchId);
  const batchSnapshot = await batchRef.get();
  if (!batchSnapshot.exists) return { batchId, deleted: false, updated: false };
  const batch = batchSnapshot.data() || {};
  const fileIds = Array.isArray(batch.fileIds) ? batch.fileIds : [];
  const remainingCandidateIds = fileIds.filter((id) => !deletedFileIds.has(id));
  const remainingSnapshots = remainingCandidateIds.length
    ? await adminDb.getAll(...remainingCandidateIds.map((id) => adminDb.collection("portfolioImportFiles").doc(id)))
    : [];
  const remainingFiles = remainingSnapshots
    .filter((item) => item.exists)
    .map((item) => ({ id: item.id, ...item.data() }));

  if (!remainingFiles.length && Number(batch.importedCount || 0) === 0) {
    await batchRef.delete();
    return { batchId, deleted: true, updated: false };
  }

  const previewCounts = remainingFiles.reduce((total, file) => {
    const key = file.matchStatus || "unknown";
    total[key] = (total[key] || 0) + 1;
    return total;
  }, {});
  const sourceCounts = remainingFiles.reduce((total, file) => {
    const key = file.source || "manual";
    total[key] = (total[key] || 0) + 1;
    return total;
  }, {});
  const importedFiles = remainingFiles.filter((file) => file.status === "imported");
  const duplicateFiles = remainingFiles.filter((file) => file.status === "duplicate" || file.matchStatus === "duplicate");
  const issueCount = remainingFiles.filter((file) => !["imported", "duplicate"].includes(file.status)).length;
  const readyCount = remainingFiles.filter((file) => file.adapterStatus === "ready" && !["duplicate", "conflict"].includes(file.matchStatus)).length;
  const investorCount = new Set(importedFiles.map((file) => clean(file.matchedInvestorId)).filter(Boolean)).size;

  await batchRef.set({
    fileIds: remainingFiles.map((file) => file.id),
    fileCount: remainingFiles.length,
    previewCounts,
    sourceCounts,
    readyCount,
    previewIssueCount: issueCount,
    importedCount: importedFiles.length,
    duplicateCount: duplicateFiles.length,
    issueCount,
    investorCount,
    totalCurrentValue: Number(importedFiles.reduce((sum, file) => sum + Number(file.summary?.currentValue || file.currentValue || 0), 0).toFixed(2)),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { batchId, deleted: false, updated: true };
}

/**
 * A system with no verified Fundbazaar mapping has no active Fundbazaar daily
 * coverage population. After a destructive Full Reset, old unmatched/failed
 * Fundbazaar preview attempts are pure orphan state. Clearing those attempts
 * prevents a reset system from immediately showing historical "Need Attention"
 * files that cannot belong to any currently tracked investor. Imported records
 * and shared non-Fundbazaar files are never deleted here.
 */
export async function purgeOrphanFundbazaarImportAttempts({ before = new Date() } = {}) {
  const cutoffMillis = before instanceof Date ? before.getTime() : timestampMillis(before) || Date.now();
  const mappingSnapshot = await adminDb.collection("externalInvestorMappings")
    .where("source", "==", PORTFOLIO_SOURCES.FUNDBAZAAR)
    .get();
  const verifiedMappings = mappingSnapshot.docs.filter((item) => item.data()?.status === "verified");
  if (verifiedMappings.length) {
    return { skipped: true, reason: "verified_fundbazaar_mappings_exist", removedFiles: 0, removedBatches: 0, updatedBatches: 0 };
  }

  const filesSnapshot = await adminDb.collection("portfolioImportFiles")
    .where("source", "==", PORTFOLIO_SOURCES.FUNDBAZAAR)
    .get();
  const orphanFiles = docRows(filesSnapshot).filter((file) => isOrphanFundbazaarIssueFile(file, cutoffMillis));
  if (!orphanFiles.length) {
    return { skipped: false, reason: "no_orphan_attempts", removedFiles: 0, removedBatches: 0, updatedBatches: 0 };
  }

  const deletedFileIds = new Set(orphanFiles.map((file) => file.id));
  const batchIds = [...new Set(orphanFiles.map((file) => clean(file.batchId)).filter(Boolean))];
  const writer = adminDb.bulkWriter();
  orphanFiles.forEach((file) => writer.delete(file.ref));
  await writer.close();

  let removedBatches = 0;
  let updatedBatches = 0;
  for (const batchId of batchIds) {
    const result = await rebuildImportBatchAfterFileRemoval(batchId, deletedFileIds);
    if (result.deleted) removedBatches += 1;
    if (result.updated) updatedBatches += 1;
  }

  return {
    skipped: false,
    reason: "fresh_start_orphan_cleanup",
    removedFiles: orphanFiles.length,
    removedBatches,
    updatedBatches
  };
}

export async function loadPortfolioResetContext(investor) {
  const investorId = investor.id;
  const [
    positions,
    transactions,
    policies,
    trades,
    tradingSummaries,
    snapshots,
    snapshotPositions,
    recoveryJournals,
    recoveryItems,
    fingerprints,
    mappings,
    sipSchedules,
    sipCycles,
    activityRows,
    actions,
    actionEvents,
    clientQueries,
    notifications,
    importFiles
  ] = await Promise.all([
    investorRows("portfolioPositions", investorId),
    investorRows("investmentTransactions", investorId),
    investorRows("ulipPolicies", investorId),
    investorRows("tradingTransactions", investorId),
    investorRows("tradingMonthlySummaries", investorId),
    investorRows("portfolioSnapshots", investorId),
    investorRows("portfolioSnapshotPositions", investorId),
    investorRows("portfolioImportChanges", investorId),
    investorRows("portfolioImportChangeItems", investorId),
    investorRows("portfolioFileFingerprints", investorId),
    investorRows("externalInvestorMappings", investorId),
    investorRows("sipFundingSchedules", investorId),
    investorRows("sipFundingCycles", investorId),
    investorRows("activityLogs", investorId),
    investorRows("investorActions", investorId),
    investorRows("investorActionEvents", investorId),
    investorRows("clientQueries", investorId),
    investorRows("notifications", investorId),
    loadImportFiles(investor)
  ]);

  const positionIds = new Set(positions.map((item) => item.id));
  const sipScheduleIds = new Set(sipSchedules.map((item) => item.id));
  const portfolioActions = actions.filter((item) => item.sourceType === "sip_funding" || positionIds.has(clean(item.relatedInvestmentId)));
  const portfolioActionIds = new Set(portfolioActions.map((item) => item.id));
  const portfolioActionEvents = actionEvents.filter((item) => portfolioActionIds.has(clean(item.actionId)) || clean(item.eventType).startsWith("sip_funding"));
  const portfolioClientQueries = clientQueries.filter((item) => item.sourceType === "sip_funding" || sipScheduleIds.has(clean(item.sourceSipScheduleId)));
  const portfolioNotifications = notifications.filter((item) => clean(item.eventType).startsWith("sip_funding") || portfolioActionIds.has(clean(item.actionId)) || sipScheduleIds.has(clean(item.sipScheduleId)));
  const portfolioActivity = activityRows.filter(isPortfolioActivity);
  const batchPlans = await loadImportBatchPlans(importFiles, investorId);
  const portfolioMetaFields = PORTFOLIO_META_FIELDS.filter((field) => investor[field] !== undefined && investor[field] !== null && investor[field] !== "");

  return {
    investor,
    positions,
    transactions,
    policies,
    trades,
    tradingSummaries,
    snapshots,
    snapshotPositions,
    recoveryJournals,
    recoveryItems,
    fingerprints,
    mappings,
    importFiles,
    batchPlans,
    sipSchedules,
    sipCycles,
    portfolioActivity,
    portfolioActions,
    portfolioActionEvents,
    portfolioClientQueries,
    portfolioNotifications,
    portfolioMetaFields
  };
}

export function portfolioContextHasResettableState(context, { excludeImportBatchIds = [] } = {}) {
  const excludedBatches = new Set((excludeImportBatchIds || []).map(clean).filter(Boolean));
  const importFiles = (context.importFiles || []).filter((item) => !excludedBatches.has(clean(item.batchId)));
  const batchPlans = (context.batchPlans || []).filter((item) => !excludedBatches.has(clean(item?.batch?.id)));
  const groups = [
    context.positions,
    context.transactions,
    context.policies,
    context.trades,
    context.tradingSummaries,
    context.snapshots,
    context.snapshotPositions,
    context.recoveryJournals,
    context.recoveryItems,
    context.fingerprints,
    context.mappings,
    importFiles,
    context.sipSchedules,
    context.sipCycles,
    context.portfolioActivity,
    context.portfolioActions,
    context.portfolioActionEvents,
    context.portfolioClientQueries,
    context.portfolioNotifications
  ];

  return groups.some((rows) => Array.isArray(rows) && rows.length > 0)
    || batchPlans.length > 0
    || (context.portfolioMetaFields || []).length > 0;
}

export function portfolioResetPreview(context) {
  const currentValue = positionValue(context.positions);
  const deletableCount = [
    context.positions,
    context.transactions,
    context.policies,
    context.trades,
    context.tradingSummaries,
    context.snapshots,
    context.snapshotPositions,
    context.recoveryJournals,
    context.recoveryItems,
    context.fingerprints,
    context.mappings,
    context.importFiles,
    context.sipSchedules,
    context.sipCycles,
    context.portfolioActivity,
    context.portfolioActions,
    context.portfolioActionEvents,
    context.portfolioClientQueries,
    context.portfolioNotifications
  ].reduce((sum, rows) => sum + rows.length, 0) + context.batchPlans.length + context.portfolioMetaFields.length;

  return {
    investorId: context.investor.id,
    investorName: context.investor.fullName || context.investor.name || "Investor",
    clientCode: context.investor.clientCode || "",
    currentValue,
    counts: {
      holdings: context.positions.length,
      transactions: context.transactions.length,
      policies: context.policies.length,
      snapshots: context.snapshots.length,
      snapshotPositions: context.snapshotPositions.length,
      importFiles: context.importFiles.length,
      importBatches: context.batchPlans.length,
      mappings: context.mappings.length,
      fingerprints: context.fingerprints.length,
      recoveryJournals: context.recoveryJournals.length,
      recoveryItems: context.recoveryItems.length,
      tradingRecords: context.trades.length,
      tradingSummaries: context.tradingSummaries.length,
      sipSchedules: context.sipSchedules.length,
      sipCycles: context.sipCycles.length,
      portfolioHistory: context.portfolioActivity.length,
      linkedActions: context.portfolioActions.length,
      linkedActionEvents: context.portfolioActionEvents.length,
      linkedServiceRequests: context.portfolioClientQueries.length,
      linkedNotifications: context.portfolioNotifications.length,
      investorPortfolioFields: context.portfolioMetaFields.length,
      totalResetRecords: deletableCount
    },
    state: {
      portfolioStatus: context.positions.length ? "portfolio_data_available" : "no_portfolio_data",
      lastUpdate: context.investor.latestPortfolioUpdatedAt || null,
      dailyUpdate: context.mappings.length ? "configured" : "not_started",
      fundbazaarMapping: context.mappings.some((item) => item.source === "fundbazaar") ? "mapped" : "not_mapped",
      importHistory: context.importFiles.length ? "available" : "no_imports",
      snapshots: context.snapshots.length ? "available" : "no_snapshots",
      trading: context.trades.length || context.tradingSummaries.length ? "available" : "no_trading_data"
    },
    hasResettableData: deletableCount > 0
  };
}

export async function resetInvestorPortfolio(context) {
  const writer = adminDb.bulkWriter();
  const groups = [
    context.positions,
    context.transactions,
    context.policies,
    context.trades,
    context.tradingSummaries,
    context.snapshots,
    context.snapshotPositions,
    context.recoveryJournals,
    context.recoveryItems,
    context.fingerprints,
    context.mappings,
    context.importFiles,
    context.sipSchedules,
    context.sipCycles,
    context.portfolioActivity,
    context.portfolioActions,
    context.portfolioActionEvents,
    context.portfolioClientQueries,
    context.portfolioNotifications
  ];
  uniqueDocs(...groups).forEach((item) => writer.delete(item.ref));

  context.batchPlans.forEach(({ batch, deleteBatch, update }) => {
    if (deleteBatch) writer.delete(batch.ref);
    else writer.set(batch.ref, update, { merge: true });
  });

  if (context.portfolioMetaFields.length) {
    writer.set(adminDb.collection("investors").doc(context.investor.id), Object.fromEntries(context.portfolioMetaFields.map((field) => [field, FieldValue.delete()])), { merge: true });
  }

  await writer.close();

  return {
    investorId: context.investor.id,
    investorName: context.investor.fullName || context.investor.name || "Investor",
    removed: portfolioResetPreview(context).counts,
    state: {
      portfolioStatus: "no_portfolio_data",
      lastUpdate: null,
      dailyUpdate: "not_started",
      fundbazaarMapping: "not_mapped",
      importHistory: "no_imports",
      snapshots: "no_snapshots",
      trading: "no_trading_data"
    }
  };
}
