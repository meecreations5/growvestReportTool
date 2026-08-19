import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";

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
  if (Array.isArray(file.suggestions) && file.suggestions.some((item) => clean(item?.investorId) === investorId)) return true;

  const clientCode = upper(investor.clientCode);
  if (clientCode && [file.matchedClientCode, file.externalClientCode].some((value) => upper(value) === clientCode)) return true;

  const pan = upper(investor.panNumber || investor.panNormalized);
  if (pan && upper(file.externalPan) === pan) return true;
  return false;
}

async function loadImportFiles(investor) {
  const investorId = investor.id;
  const queries = [adminDb.collection("portfolioImportFiles").where("matchedInvestorId", "==", investorId).get()];
  if (investor.clientCode) queries.push(adminDb.collection("portfolioImportFiles").where("matchedClientCode", "==", investor.clientCode).get());
  const pan = upper(investor.panNumber || investor.panNormalized);
  if (pan) queries.push(adminDb.collection("portfolioImportFiles").where("externalPan", "==", pan).get());
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
