import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { PORTFOLIO_IMPORT_STATUS, PORTFOLIO_MATCH_STATUS, PORTFOLIO_SOURCES } from "@/lib/constants/portfolio";
import { stableHash } from "@/lib/server/portfolioImportParser";
import { createPortfolioSnapshot, getAccessibleInvestor, indiaDateKey } from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

function isAdmin(actor) {
  return ["super_admin", "admin"].includes(actor?.role);
}

function externalMappingDocumentIds(file = {}) {
  const source = file.source || PORTFOLIO_SOURCES.FUNDBAZAAR;
  const ids = [];
  if (file.normalizedExternalClientName) {
    ids.push(source === PORTFOLIO_SOURCES.FUNDBAZAAR
      ? `${source}_${stableHash(file.normalizedExternalClientName, 32)}`
      : `${source}_name_${stableHash(file.normalizedExternalClientName, 32)}`);
  }
  if (file.externalPan) ids.push(`${source}_pan_${stableHash(String(file.externalPan).toUpperCase(), 32)}`);
  if (file.externalClientCode) ids.push(`${source}_client_${stableHash(String(file.externalClientCode).toUpperCase(), 32)}`);
  if (source === PORTFOLIO_SOURCES.ULIP) {
    (file.policies || []).forEach((policy) => {
      const policyNumber = String(policy?.policyNumber || "").trim().toUpperCase();
      if (policyNumber) ids.push(`${source}_policy_${stableHash(policyNumber, 32)}`);
    });
  }
  return [...new Set(ids.filter(Boolean))];
}

function publicFile(file = {}, recovery = null) {
  return {
    id: file.id,
    fileName: file.fileName || "",
    source: file.source || "",
    reportType: file.reportType || "",
    status: file.status || "",
    matchStatus: file.matchStatus || "",
    matchedInvestorId: file.matchedInvestorId || "",
    matchedInvestorName: file.matchedInvestorName || "",
    matchedClientCode: file.matchedClientCode || "",
    externalClientName: file.externalClientName || "",
    externalPan: file.externalPan || "",
    externalClientCode: file.externalClientCode || "",
    summary: file.summary || null,
    recovery: recovery ? {
      status: recovery.status || "",
      reversible: recovery.reversible === true && ["committed", "commit_failed"].includes(recovery.status),
      positionCount: Number(recovery.positionCount || 0),
      policyCount: Number(recovery.policyCount || 0),
      transactionCount: Number(recovery.transactionCount || 0),
      replacementBatchId: recovery.replacementBatchId || "",
      recoveryReason: recovery.recoveryReason || ""
    } : {
      status: "legacy",
      reversible: false,
      positionCount: 0,
      policyCount: 0,
      transactionCount: 0,
      replacementBatchId: "",
      recoveryReason: ""
    }
  };
}

async function getBatchFiles(batchId) {
  const batchRef = adminDb.collection("portfolioImports").doc(batchId);
  const batchSnapshot = await batchRef.get();
  if (!batchSnapshot.exists) throw new Error("Portfolio import batch was not found.");
  const batch = { id: batchSnapshot.id, ...batchSnapshot.data() };
  const fileIds = Array.isArray(batch.fileIds) ? batch.fileIds : [];
  const fileSnapshots = fileIds.length
    ? await adminDb.getAll(...fileIds.map((id) => adminDb.collection("portfolioImportFiles").doc(id)))
    : [];
  const files = fileSnapshots.filter((item) => item.exists).map((item) => ({ id: item.id, ...item.data() }));
  return { batchRef, batch, files };
}

async function getRecovery(fileId) {
  const snapshot = await adminDb.collection("portfolioImportChanges").doc(fileId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getRecoveryItems(recovery) {
  const itemIds = Array.isArray(recovery?.itemIds) ? recovery.itemIds : [];
  if (!itemIds.length) return [];
  const snapshots = await adminDb.getAll(...itemIds.map((id) => adminDb.collection("portfolioImportChangeItems").doc(id)));
  return snapshots.filter((item) => item.exists).map((item) => ({ id: item.id, ...item.data() }));
}

async function assertRecoverySafe(batchId, fileId, items) {
  const refs = items.map((item) => adminDb.collection(item.collectionName).doc(item.entityId));
  const currentSnapshots = refs.length ? await adminDb.getAll(...refs) : [];
  const conflicts = [];
  currentSnapshots.forEach((snapshot, index) => {
    const item = items[index];
    if (!snapshot.exists) return;
    const data = snapshot.data();
    if (item.collectionName === "portfolioPositions") {
      const belongsToFile = data.sourceImportFileId === fileId || data.exitDetectedByFileId === fileId;
      if (!belongsToFile) conflicts.push(`${data.instrumentName || data.schemeName || item.entityId} has a newer portfolio update.`);
    } else if (item.collectionName === "investmentTransactions") {
      if (data.sourceImportFileId !== fileId) conflicts.push(`${data.instrumentName || data.schemeName || item.entityId} transaction has a newer portfolio update.`);
    } else if (item.collectionName === "tradingTransactions") {
      if (data.sourceImportFileId !== fileId) conflicts.push(`${data.instrumentName || data.stockName || item.entityId} trade has a newer update.`);
    } else if (item.collectionName === "tradingMonthlySummaries") {
      if (data.sourceImportFileId !== fileId) conflicts.push(`${data.monthKey || item.entityId} trading summary has a newer update.`);
    } else if (item.collectionName === "ulipPolicies") {
      if (data.sourceImportFileId !== fileId) conflicts.push(`${data.policyNumber || item.entityId} ULIP policy has a newer update.`);
    } else if (item.collectionName === "externalInvestorMappings") {
      if (data.lastSuccessfulImportId && data.lastSuccessfulImportId !== batchId) conflicts.push("The investor mapping has been used by a newer import.");
    } else if (item.collectionName === "portfolioFileFingerprints") {
      if (data.batchId && data.batchId !== batchId) conflicts.push("The file fingerprint belongs to a newer import.");
    }
  });
  if (conflicts.length) throw new Error(`Recovery is blocked because newer data exists. ${[...new Set(conflicts)].slice(0, 3).join(" ")}`);
}

async function restoreRecoveryItems(items) {
  const writer = adminDb.bulkWriter();
  items.forEach((item) => {
    const ref = adminDb.collection(item.collectionName).doc(item.entityId);
    if (item.existedBefore && item.before) writer.set(ref, item.before);
    else writer.delete(ref);
  });
  await writer.close();
}

async function resetMappingsForCorrection(file, oldInvestorId) {
  const mappingIds = externalMappingDocumentIds(file);
  if (!mappingIds.length) return;
  const snapshots = await adminDb.getAll(...mappingIds.map((id) => adminDb.collection("externalInvestorMappings").doc(id)));
  const batch = adminDb.batch();
  snapshots.forEach((snapshot) => {
    if (!snapshot.exists) return;
    const data = snapshot.data();
    if (data.investorId === oldInvestorId) batch.delete(snapshot.ref);
  });
  await batch.commit();
}

async function rollbackFile({ actor, batchRef, batch, file, recovery, reason, resetMapping = false }) {
  if (!recovery || recovery.reversible !== true || !["committed", "commit_failed"].includes(recovery.status)) {
    throw new Error("Safe rollback is unavailable for this import. Recovery journals are available for imports processed from v0.31.7 onward.");
  }
  const items = await getRecoveryItems(recovery);
  await assertRecoverySafe(batch.id, file.id, items);
  await restoreRecoveryItems(items);
  if (resetMapping) await resetMappingsForCorrection(file, recovery.investorId || file.matchedInvestorId || "");

  const recoveryRef = adminDb.collection("portfolioImportChanges").doc(file.id);
  const fileRef = adminDb.collection("portfolioImportFiles").doc(file.id);
  await Promise.all([
    recoveryRef.set({
      status: "rolled_back",
      reversible: false,
      recoveryReason: reason,
      rolledBackAt: FieldValue.serverTimestamp(),
      rolledBackByUid: actor.uid,
      rolledBackByName: actor.fullName || actor.email || "GrowVest User",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }),
    fileRef.set({
      status: "rolled_back",
      recoveryStatus: "rolled_back",
      recoveryReason: reason,
      rolledBackAt: FieldValue.serverTimestamp(),
      rolledBackByUid: actor.uid,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }),
    batchRef.set({
      recoveryStatus: "corrected",
      lastRecoveryAt: FieldValue.serverTimestamp(),
      lastRecoveryByUid: actor.uid,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true })
  ]);

  const investorId = recovery.investorId || file.matchedInvestorId || "";
  let snapshot = null;
  if (investorId) {
    snapshot = await createPortfolioSnapshot(investorId, actor, {
      snapshotDate: indiaDateKey(),
      verificationStatus: "corrected",
      sourceImportId: `recovery_${file.id}`
    });
  }

  await adminDb.collection("activityLogs").add({
    recordType: "portfolio_import",
    recordId: batch.id,
    investorId,
    advisorUid: actor.uid,
    assignedAdvisorUid: actor.uid,
    action: "portfolio_import_rolled_back",
    title: "Portfolio import rolled back",
    description: `${file.fileName || "Portfolio import"} was rolled back by ${actor.fullName || actor.email || "GrowVest User"}.`,
    metadata: { batchId: batch.id, fileId: file.id, reason },
    createdByUid: actor.uid,
    createdByName: actor.fullName || actor.email || "GrowVest User",
    createdAt: FieldValue.serverTimestamp()
  });
  return { investorId, snapshot };
}

async function captureGoalAllocations(file, investorId) {
  if (!investorId) return [];
  const snapshot = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
  const holdings = Array.isArray(file.holdings) ? file.holdings : [];
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((position) => position.source === file.source)
    .filter((position) => holdings.some((holding) => {
      if (file.source === PORTFOLIO_SOURCES.BAJAJ_BROKING) {
        if (position.isin && holding.isin) return String(position.isin).trim().toUpperCase() === String(holding.isin).trim().toUpperCase();
        const left = String(position.symbol || position.instrumentName || "").trim().toUpperCase();
        const right = String(holding.symbol || holding.instrumentName || holding.stockName || "").trim().toUpperCase();
        return Boolean(left && right && left === right);
      }
      if (file.source === PORTFOLIO_SOURCES.ULIP) {
        const samePolicy = String(position.policyNumber || position.folioNo || "").trim().toUpperCase() === String(holding.policyNumber || "").trim().toUpperCase();
        if (!samePolicy) return false;
        if (position.fundCode && holding.fundCode) return String(position.fundCode).trim().toUpperCase() === String(holding.fundCode).trim().toUpperCase();
        return String(position.fundName || position.instrumentName || "").trim().toLowerCase() === String(holding.fundName || holding.instrumentName || "").trim().toLowerCase();
      }
      if (file.source === PORTFOLIO_SOURCES.GROWVEST_STANDARD) {
        if (position.productType && holding.productType && position.productType !== holding.productType) return false;
        const leftProvider = String(position.provider || "").trim().toLowerCase();
        const rightProvider = String(holding.provider || "").trim().toLowerCase();
        if (leftProvider && rightProvider && leftProvider !== rightProvider) return false;
        const leftRef = String(position.accountReference || position.folioNo || position.policyNumber || "").trim().toUpperCase();
        const rightRef = String(holding.accountReference || holding.folioNo || holding.policyNumber || "").trim().toUpperCase();
        if (leftRef && rightRef) return leftRef === rightRef;
        if (position.isin && holding.isin) return String(position.isin).trim().toUpperCase() === String(holding.isin).trim().toUpperCase();
        if (position.symbol && holding.symbol) return String(position.symbol).trim().toUpperCase() === String(holding.symbol).trim().toUpperCase();
        return String(position.instrumentName || "").trim().toLowerCase() === String(holding.instrumentName || "").trim().toLowerCase();
      }
      const folioMatches = String(position.folioNo || "").trim() && String(position.folioNo || "").trim() === String(holding.folioNo || "").trim();
      if (!folioMatches) return false;
      if (position.isin && holding.isin) return String(position.isin) === String(holding.isin);
      return String(position.instrumentName || position.schemeName || "").trim().toLowerCase() === String(holding.instrumentName || holding.schemeName || "").trim().toLowerCase();
    }))
    .map((position) => ({
      folioNo: position.folioNo || "",
      accountReference: position.accountReference || position.folioNo || position.policyNumber || "",
      provider: position.provider || "",
      productType: position.productType || "",
      isin: position.isin || "",
      symbol: position.symbol || "",
      policyNumber: position.policyNumber || position.folioNo || "",
      fundCode: position.fundCode || "",
      instrumentName: position.instrumentName || position.schemeName || position.stockName || position.fundName || "",
      goalAllocations: position.goalAllocations || [],
      allocationStatus: position.allocationStatus || "allocated"
    }));
}

async function cloneForReprocess({ actor, originalBatch, file, targetInvestor, reason, recoveryGoalAllocations = [] }) {
  const newBatchRef = adminDb.collection("portfolioImports").doc();
  const newFileRef = adminDb.collection("portfolioImportFiles").doc(`${newBatchRef.id}_001`);
  const { id, batchId, createdAt, updatedAt, importedAt, recoveryStatus, recoveryReason, rolledBackAt, rolledBackByUid, ...sourceFile } = file;
  const newFile = {
    ...sourceFile,
    batchId: newBatchRef.id,
    advisorUid: actor.uid,
    createdByUid: actor.uid,
    createdByName: actor.fullName || actor.email || "GrowVest User",
    matchedInvestorId: targetInvestor.id,
    matchedInvestorName: targetInvestor.fullName || "",
    matchedClientCode: targetInvestor.clientCode || "",
    matchStatus: PORTFOLIO_MATCH_STATUS.VERIFIED,
    status: "previewed",
    duplicateOfImportId: "",
    duplicateImportedAt: null,
    recoveryOfImportId: originalBatch.id,
    recoveryOfFileId: file.id,
    recoveryReason: reason,
    recoveryGoalAllocations,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  const writer = adminDb.bulkWriter();
  writer.set(newFileRef, newFile);
  writer.set(newBatchRef, {
    source: file.source || PORTFOLIO_SOURCES.FUNDBAZAAR,
    importMode: "recovery_reprocess",
    status: PORTFOLIO_IMPORT_STATUS.AWAITING_REVIEW,
    advisorUid: actor.uid,
    createdByUid: actor.uid,
    createdByName: actor.fullName || actor.email || "GrowVest User",
    fileCount: 1,
    fileIds: [newFileRef.id],
    readyCount: 1,
    previewIssueCount: 0,
    recoveryOfImportId: originalBatch.id,
    recoveryOfFileId: file.id,
    recoveryReason: reason,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await writer.close();
  return { batchId: newBatchRef.id, fileId: newFileRef.id, investorId: targetInvestor.id };
}

export async function GET(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!isAdmin(actor)) return Response.json({ error: "Import recovery is restricted to Admin and Super Admin." }, { status: 403 });
    const { batchId } = await params;
    const { batch, files } = await getBatchFiles(String(batchId || ""));
    const recoveries = await Promise.all(files.map((file) => getRecovery(file.id)));
    return Response.json({
      batch: {
        id: batch.id,
        source: batch.source || "",
        status: batch.status || "",
        fileCount: Number(batch.fileCount || files.length),
        importedCount: Number(batch.importedCount || 0),
        issueCount: Number(batch.issueCount || batch.previewIssueCount || 0),
        totalCurrentValue: Number(batch.totalCurrentValue || 0),
        createdByName: batch.createdByName || "",
        createdAt: batch.createdAt || null,
        recoveryStatus: batch.recoveryStatus || ""
      },
      files: files.map((file, index) => publicFile(file, recoveries[index]))
    });
  } catch (error) {
    console.error("Portfolio recovery details failed", error);
    return Response.json({ error: error?.message || "Unable to load import recovery details." }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!isAdmin(actor)) return Response.json({ error: "Import recovery is restricted to Admin and Super Admin." }, { status: 403 });
    const { batchId } = await params;
    const payload = await request.json();
    const action = String(payload?.action || "");
    const fileId = String(payload?.fileId || "");
    const reason = String(payload?.reason || "").trim();
    if (!fileId) return Response.json({ error: "Select an import file to recover." }, { status: 400 });
    if (reason.length < 5) return Response.json({ error: "Enter a correction reason of at least 5 characters." }, { status: 400 });

    const { batchRef, batch, files } = await getBatchFiles(String(batchId || ""));
    const file = files.find((item) => item.id === fileId);
    if (!file) return Response.json({ error: "Import file was not found in this batch." }, { status: 404 });
    const recovery = await getRecovery(file.id);

    if (action === "rollback") {
      const rolledBack = await rollbackFile({ actor, batchRef, batch, file, recovery, reason });
      return Response.json({ action, status: "rolled_back", ...rolledBack });
    }

    if (["reprocess", "correct_investor"].includes(action)) {
      const targetInvestorId = action === "correct_investor"
        ? String(payload?.targetInvestorId || "")
        : String(recovery?.investorId || file.matchedInvestorId || "");
      if (!targetInvestorId) return Response.json({ error: "Select the correct investor." }, { status: 400 });
      const targetInvestor = await getAccessibleInvestor(actor, targetInvestorId);
      const oldInvestorId = String(recovery?.investorId || file.matchedInvestorId || "");
      const recoveryGoalAllocations = action === "reprocess" && targetInvestorId === oldInvestorId
        ? await captureGoalAllocations(file, oldInvestorId)
        : [];
      await rollbackFile({
        actor,
        batchRef,
        batch,
        file,
        recovery,
        reason,
        resetMapping: action === "correct_investor" && targetInvestorId !== oldInvestorId
      });
      const replacement = await cloneForReprocess({ actor, originalBatch: batch, file, targetInvestor, reason, recoveryGoalAllocations });
      await adminDb.collection("portfolioImportChanges").doc(file.id).set({
        status: "reprocess_prepared",
        replacementBatchId: replacement.batchId,
        replacementFileId: replacement.fileId,
        replacementInvestorId: replacement.investorId,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await adminDb.collection("portfolioImportFiles").doc(file.id).set({
        recoveryStatus: action === "correct_investor" ? "correct_investor_prepared" : "reprocess_prepared",
        replacementBatchId: replacement.batchId,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return Response.json({ action, status: "ready_to_reprocess", ...replacement });
    }

    return Response.json({ error: "Unsupported recovery action." }, { status: 400 });
  } catch (error) {
    console.error("Portfolio recovery action failed", error);
    return Response.json({ error: error?.message || "Unable to complete import recovery." }, { status: 500 });
  }
}
