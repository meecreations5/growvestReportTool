import { FieldValue } from "firebase-admin/firestore";
import {
  adminDb,
  verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_PRODUCT_TYPES,
  PORTFOLIO_SOURCE_LABELS
} from "@/lib/constants/portfolio";
import {
  createPortfolioSnapshot,
  getAccessibleInvestor,
  indiaDateKey
} from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

const MAX_SELECTION = 1000;

function isAdmin(actor) {
  return ["super_admin", "admin"].includes(actor?.role);
}

function clean(value) {
  return String(value || "").trim();
}

function normalise(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function upper(value) {
  return clean(value).toUpperCase();
}

function positionName(position = {}) {
  return position.instrumentName
    || position.schemeName
    || position.stockName
    || position.fundName
    || position.symbol
    || "Investment";
}

function positionIdentity(position = {}) {
  const productType = position.productType || "other";
  const source = position.source || "manual";
  const isin = upper(position.isin);
  const folioNo = upper(position.folioNo || position.accountReference);
  const policyNumber = upper(position.policyNumber || position.accountReference || position.folioNo);
  const fundCode = upper(position.fundCode);
  const symbol = upper(position.symbol);
  const name = normalise(position.instrumentName || position.schemeName || position.stockName || position.fundName);

  if (productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND) {
    return { source, productType, primary: isin && folioNo ? `${isin}|${folioNo}` : folioNo || isin || name, isin, folioNo, name };
  }
  if (productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) {
    return { source, productType, primary: isin || symbol || name, isin, symbol, name };
  }
  if (productType === PORTFOLIO_PRODUCT_TYPES.ULIP) {
    return { source, productType, primary: `${policyNumber}|${fundCode || name}`, policyNumber, fundCode, name };
  }
  return {
    source,
    productType,
    primary: folioNo || policyNumber || isin || symbol || name,
    isin,
    folioNo,
    policyNumber,
    symbol,
    name
  };
}

function transactionMatchesPosition(transaction = {}, position = {}) {
  if (transaction.positionId && String(transaction.positionId) === String(position.id)) return true;
  if (transaction.source && position.source && transaction.source !== position.source) return false;
  if (transaction.productType && position.productType && transaction.productType !== position.productType) return false;

  const left = positionIdentity(position);
  const right = positionIdentity(transaction);

  if (left.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND) {
    if (left.isin && right.isin && left.isin !== right.isin) return false;
    if (left.folioNo && right.folioNo) return left.folioNo === right.folioNo;
    return Boolean(left.primary && right.primary && left.primary === right.primary);
  }

  if (left.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) {
    if (left.isin && right.isin) return left.isin === right.isin;
    if (left.symbol && right.symbol) return left.symbol === right.symbol;
    return Boolean(left.name && right.name && left.name === right.name);
  }

  if (left.productType === PORTFOLIO_PRODUCT_TYPES.ULIP) {
    if (left.policyNumber && right.policyNumber && left.policyNumber !== right.policyNumber) return false;
    if (left.fundCode && right.fundCode) return left.fundCode === right.fundCode;
    return Boolean(left.name && right.name && left.name === right.name);
  }

  return Boolean(left.primary && right.primary && left.primary === right.primary);
}

function relatedTransactions(transactions, positions, mode = "imported") {
  return transactions.filter((transaction) => {
    if (mode !== "all" && !transaction.sourceImportFileId) return false;
    return positions.some((position) => transactionMatchesPosition(transaction, position));
  });
}

async function loadSelection(investorId, positionIds) {
  if (!Array.isArray(positionIds) || !positionIds.length) throw new Error("Select at least one portfolio holding.");
  if (positionIds.length > MAX_SELECTION) throw new Error(`You can clean up to ${MAX_SELECTION} holdings at a time.`);

  const uniqueIds = [...new Set(positionIds.map((value) => clean(value)).filter(Boolean))];
  const snapshots = await adminDb.getAll(...uniqueIds.map((id) => adminDb.collection("portfolioPositions").doc(id)));
  const positions = snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, ref: snapshot.ref, ...snapshot.data() }));

  if (positions.length !== uniqueIds.length) throw new Error("One or more selected portfolio holdings no longer exist. Refresh and try again.");
  if (positions.some((position) => String(position.investorId || "") !== String(investorId))) {
    throw new Error("One or more selected holdings belong to another investor.");
  }

  return positions;
}

async function loadInvestorContext(investorId) {
  const [positionsSnapshot, transactionsSnapshot, policiesSnapshot] = await Promise.all([
    adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get(),
    adminDb.collection("investmentTransactions").where("investorId", "==", investorId).get(),
    adminDb.collection("ulipPolicies").where("investorId", "==", investorId).get()
  ]);

  return {
    positions: positionsSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    transactions: transactionsSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    policies: policiesSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }))
  };
}

function selectedFileImpact(allPositions, selectedPositions) {
  const selectedIds = new Set(selectedPositions.map((item) => item.id));
  const fileIds = [...new Set(selectedPositions.map((item) => clean(item.sourceImportFileId)).filter(Boolean))];
  const fullyRemovedFileIds = fileIds.filter((fileId) => {
    const currentForFile = allPositions.filter((item) => clean(item.sourceImportFileId) === fileId && !["inactive", "exited", "removed"].includes(item.status));
    return currentForFile.length > 0 && currentForFile.every((item) => selectedIds.has(item.id));
  });
  return { fileIds, fullyRemovedFileIds };
}

function selectedSummary(positions) {
  const currentValue = positions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const investedAmount = positions.reduce((sum, item) => sum + Number(item.totalInvested ?? item.investedAmount ?? 0), 0);
  const sources = [...new Set(positions.map((item) => item.source || "manual"))];
  const productTypes = [...new Set(positions.map((item) => item.productType || "other"))];
  return {
    count: positions.length,
    currentValue: Number(currentValue.toFixed(2)),
    investedAmount: Number(investedAmount.toFixed(2)),
    sources: sources.map((source) => ({ source, label: PORTFOLIO_SOURCE_LABELS[source] || source })),
    productTypes,
    holdings: positions.slice(0, 100).map((item) => ({
      id: item.id,
      instrumentName: positionName(item),
      productType: item.productType || "other",
      source: item.source || "manual",
      provider: item.provider || "",
      currentValue: Number(item.currentValue || 0),
      folioNo: item.folioNo || "",
      policyNumber: item.policyNumber || "",
      symbol: item.symbol || "",
      sourceImportFileId: item.sourceImportFileId || ""
    }))
  };
}

function affectedPolicyKeys(positions) {
  return new Set(positions
    .filter((item) => item.productType === PORTFOLIO_PRODUCT_TYPES.ULIP && item.policyNumber)
    .map((item) => `${item.source || "ulip"}|${upper(item.policyNumber)}`));
}

async function importFileContext(fileIds) {
  if (!fileIds.length) return [];
  const snapshots = await adminDb.getAll(...fileIds.map((id) => adminDb.collection("portfolioImportFiles").doc(id)));
  return snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => ({ id: snapshot.id, ref: snapshot.ref, ...snapshot.data() }));
}

async function buildPreview({ investorId, positionIds, transactionsMode = "imported" }) {
  const selectedPositions = await loadSelection(investorId, positionIds);
  const context = await loadInvestorContext(investorId);
  const transactions = relatedTransactions(context.transactions, selectedPositions, transactionsMode);
  const importedTransactions = transactions.filter((item) => Boolean(item.sourceImportFileId));
  const manualTransactions = transactions.filter((item) => !item.sourceImportFileId);
  const fileImpact = selectedFileImpact(context.positions, selectedPositions);
  const policyKeys = affectedPolicyKeys(selectedPositions);
  const affectedPolicies = context.policies.filter((policy) => policyKeys.has(`${policy.source || "ulip"}|${upper(policy.policyNumber)}`));
  const selectedIdSet = new Set(selectedPositions.map((row) => row.id));
  const activeCurrentPositions = context.positions.filter((item) => !["inactive", "exited", "removed"].includes(item.status));
  const remainingPositions = activeCurrentPositions.filter((item) => !selectedIdSet.has(item.id));
  const entireCurrentPortfolio = activeCurrentPositions.length > 0 && remainingPositions.length === 0;

  return {
    selected: selectedSummary(selectedPositions),
    transactionMode: transactionsMode,
    transactions: {
      total: transactions.length,
      imported: importedTransactions.length,
      manual: manualTransactions.length
    },
    affectedPolicies: affectedPolicies.length,
    affectedImportFiles: fileImpact.fileIds.length,
    releasableFileLocks: entireCurrentPortfolio ? "all" : fileImpact.fullyRemovedFileIds.length,
    entireCurrentPortfolio,
    remaining: {
      positionCount: remainingPositions.length,
      currentValue: Number(remainingPositions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0).toFixed(2))
    }
  };
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!isAdmin(actor)) {
      return Response.json({ error: "Only Admin or Super Admin can delete investor portfolio holdings." }, { status: 403 });
    }

    const { investorId } = await params;
    const investor = await getAccessibleInvestor(actor, investorId);
    const payload = await request.json();
    const action = clean(payload?.action || "preview").toLowerCase();
    const positionIds = Array.isArray(payload?.positionIds) ? payload.positionIds : [];
    const transactionsMode = payload?.transactionsMode === "all" ? "all" : "imported";
    const cleanupBatchId = clean(payload?.cleanupBatchId).slice(0, 120);
    const cleanupScopes = Array.isArray(payload?.cleanupScopes)
      ? [...new Set(payload.cleanupScopes.map((item) => clean(item)).filter(Boolean))].slice(0, 10)
      : [];

    if (action === "preview_trading" || action === "delete_trading") {
      const [tradesSnapshot, summariesSnapshot] = await Promise.all([
        adminDb.collection("tradingTransactions").where("investorId", "==", investorId).get(),
        adminDb.collection("tradingMonthlySummaries").where("investorId", "==", investorId).get()
      ]);
      const trades = tradesSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
      const summaries = summariesSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
      const netPnl = trades.reduce((sum, item) => sum + Number(item.netPnl || 0), 0);
      if (action === "preview_trading") {
        return Response.json({ investor: { id: investorId, fullName: investor.fullName || investor.name || "Investor" }, preview: { trades: trades.length, summaries: summaries.length, netPnl: Number(netPnl.toFixed(2)) } });
      }
      const reason = clean(payload?.reason);
      const confirmation = clean(payload?.confirmation).toUpperCase();
      if (reason.length < 5) return Response.json({ error: "Enter a clear deletion reason." }, { status: 400 });
      if (confirmation !== "DELETE") return Response.json({ error: "Type DELETE to confirm trading cleanup." }, { status: 400 });
      const writer = adminDb.bulkWriter();
      trades.forEach((item) => writer.delete(item.ref));
      summaries.forEach((item) => writer.delete(item.ref));
      const auditRef = adminDb.collection("activityLogs").doc();
      writer.set(auditRef, {
        recordType: "trading_bulk_cleanup", recordId: auditRef.id, investorId, clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        action: "investor_trading_deleted", title: "Investor trading history cleaned",
        description: `${trades.length} trading transaction(s) were removed for ${investor.fullName || investor.name || "the investor"}.`,
        metadata: {
          reason,
          tradesRemoved: trades.length,
          summariesRemoved: summaries.length,
          netPnlRemoved: Number(netPnl.toFixed(2)),
          cleanupBatchId: cleanupBatchId || null,
          cleanupScopes
        },
        createdByUid: actor.uid, createdByName: actor.fullName || actor.email || "GrowVest User", createdAt: FieldValue.serverTimestamp()
      });
      await writer.close();
      return Response.json({ success: true, removed: { trades: trades.length, summaries: summaries.length, netPnl: Number(netPnl.toFixed(2)) } });
    }

    if (action === "preview") {
      const preview = await buildPreview({ investorId, positionIds, transactionsMode });
      return Response.json({
        investor: { id: investorId, fullName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "" },
        preview
      });
    }

    if (action !== "delete") return Response.json({ error: "Invalid portfolio cleanup action." }, { status: 400 });

    const reason = clean(payload?.reason);
    const confirmation = clean(payload?.confirmation).toUpperCase();
    if (reason.length < 5) return Response.json({ error: "Enter a clear deletion reason." }, { status: 400 });
    if (confirmation !== "DELETE") return Response.json({ error: "Type DELETE to confirm portfolio cleanup." }, { status: 400 });

    const selectedPositions = await loadSelection(investorId, positionIds);
    const context = await loadInvestorContext(investorId);
    const selectedIds = new Set(selectedPositions.map((item) => item.id));
    const activeCurrentPositions = context.positions.filter((item) => !["inactive", "exited", "removed"].includes(item.status));
    const entireCurrentPortfolio = activeCurrentPositions.length > 0 && activeCurrentPositions.every((item) => selectedIds.has(item.id));
    const transactionsToDelete = relatedTransactions(context.transactions, selectedPositions, transactionsMode);
    const fileImpact = selectedFileImpact(context.positions, selectedPositions);
    const importFiles = await importFileContext(fileImpact.fileIds);
    const importFileMap = new Map(importFiles.map((item) => [item.id, item]));
    const [allInvestorFingerprints, allInvestorImportFiles, allInvestorRecovery] = entireCurrentPortfolio
      ? await Promise.all([
          adminDb.collection("portfolioFileFingerprints").where("investorId", "==", investorId).get(),
          adminDb.collection("portfolioImportFiles").where("matchedInvestorId", "==", investorId).get(),
          adminDb.collection("portfolioImportChanges").where("investorId", "==", investorId).get()
        ])
      : [null, null, null];
    const affectedPolicySet = affectedPolicyKeys(selectedPositions);
    const remainingPositions = context.positions.filter((item) => !selectedIds.has(item.id) && !["inactive", "exited", "removed"].includes(item.status));
    const cleanupAt = FieldValue.serverTimestamp();
    const actorName = actor.fullName || actor.email || "GrowVest User";
    const writer = adminDb.bulkWriter();

    selectedPositions.forEach((item) => writer.delete(item.ref));
    transactionsToDelete.forEach((item) => writer.delete(item.ref));

    context.policies.forEach((policy) => {
      const key = `${policy.source || "ulip"}|${upper(policy.policyNumber)}`;
      if (!affectedPolicySet.has(key)) return;
      const remainingFunds = remainingPositions.filter((item) => item.productType === PORTFOLIO_PRODUCT_TYPES.ULIP
        && `${item.source || "ulip"}|${upper(item.policyNumber)}` === key);
      if (!remainingFunds.length) {
        writer.delete(policy.ref);
        return;
      }
      const currentFundValue = remainingFunds.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
      const latestNavDate = remainingFunds.map((item) => item.navDate || item.valuationDate || "").filter(Boolean).sort().at(-1) || "";
      writer.set(policy.ref, {
        currentFundValue: Number(currentFundValue.toFixed(2)),
        fundCount: remainingFunds.length,
        latestNavDate,
        updatedAt: cleanupAt,
        updatedByUid: actor.uid,
        updatedByName: actorName
      }, { merge: true });
    });

    if (entireCurrentPortfolio) {
      allInvestorFingerprints?.docs.forEach((item) => writer.delete(item.ref));
      allInvestorRecovery?.docs.forEach((item) => writer.set(item.ref, {
        status: "invalidated_by_portfolio_cleanup",
        reversible: false,
        portfolioCleanupAt: cleanupAt,
        portfolioCleanupByUid: actor.uid,
        portfolioCleanupReason: reason,
        updatedAt: cleanupAt
      }, { merge: true }));
      allInvestorImportFiles?.docs.forEach((item) => writer.set(item.ref, {
        portfolioCleanupAt: cleanupAt,
        portfolioCleanupByUid: actor.uid,
        portfolioCleanupByName: actorName,
        portfolioCleanupReason: reason,
        recoveryStatus: "portfolio_cleaned",
        updatedAt: cleanupAt
      }, { merge: true }));
    }

    for (const fileId of fileImpact.fileIds) {
      const file = importFileMap.get(fileId);
      if (!file) continue;
      const fullyRemoved = fileImpact.fullyRemovedFileIds.includes(fileId);
      writer.set(file.ref, {
        portfolioCleanupAt: cleanupAt,
        portfolioCleanupByUid: actor.uid,
        portfolioCleanupByName: actorName,
        portfolioCleanupReason: reason,
        portfolioCleanupPositionIds: selectedPositions.filter((item) => item.sourceImportFileId === fileId).map((item) => item.id).slice(0, 100),
        ...(fullyRemoved ? { status: "portfolio_cleaned", recoveryStatus: "portfolio_cleaned" } : {}),
        updatedAt: cleanupAt
      }, { merge: true });

      writer.set(adminDb.collection("portfolioImportChanges").doc(fileId), {
        status: "invalidated_by_portfolio_cleanup",
        reversible: false,
        portfolioCleanupAt: cleanupAt,
        portfolioCleanupByUid: actor.uid,
        portfolioCleanupReason: reason,
        updatedAt: cleanupAt
      }, { merge: true });

      if (!entireCurrentPortfolio && fullyRemoved && file.fileFingerprint) {
        const fingerprintRef = adminDb.collection("portfolioFileFingerprints").doc(file.fileFingerprint);
        const fingerprintSnapshot = await fingerprintRef.get();
        if (fingerprintSnapshot.exists) {
          const fingerprint = fingerprintSnapshot.data();
          if ((!fingerprint.investorId || fingerprint.investorId === investorId)
            && (!fingerprint.fileId || fingerprint.fileId === fileId)) {
            writer.delete(fingerprintRef);
          }
        }
      }
    }

    const auditRef = adminDb.collection("activityLogs").doc();
    const summary = selectedSummary(selectedPositions);
    writer.set(auditRef, {
      recordType: "portfolio_bulk_cleanup",
      recordId: auditRef.id,
      investorId,
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
      action: "portfolio_holdings_bulk_deleted",
      title: selectedPositions.length === context.positions.filter((item) => !["inactive", "exited", "removed"].includes(item.status)).length
        ? "Entire current investor portfolio cleaned"
        : "Selected investor portfolio holdings cleaned",
      description: `${selectedPositions.length} portfolio holding(s) were removed for ${investor.fullName || investor.name || "the investor"} by ${actorName}.`,
      metadata: {
        reason,
        transactionsMode,
        positionsRemoved: selectedPositions.length,
        transactionsRemoved: transactionsToDelete.length,
        currentValueRemoved: summary.currentValue,
        importFilesAffected: fileImpact.fileIds.length,
        fileLocksReleased: entireCurrentPortfolio ? Number(allInvestorFingerprints?.size || 0) : fileImpact.fullyRemovedFileIds.length,
        entireCurrentPortfolio,
        holdings: summary.holdings,
        cleanupBatchId: cleanupBatchId || null,
        cleanupScopes
      },
      createdByUid: actor.uid,
      createdByName: actorName,
      createdAt: cleanupAt
    });

    await writer.close();

    const snapshot = await createPortfolioSnapshot(investorId, actor, {
      snapshotDate: indiaDateKey(),
      verificationStatus: "corrected",
      sourceImportId: `portfolio_cleanup_${auditRef.id}`
    });

    return Response.json({
      ok: true,
      investorId,
      investorName: investor.fullName || investor.name || "Investor",
      removed: {
        positions: selectedPositions.length,
        transactions: transactionsToDelete.length,
        currentValue: summary.currentValue,
        importLocksReleased: entireCurrentPortfolio ? Number(allInvestorFingerprints?.size || 0) : fileImpact.fullyRemovedFileIds.length
      },
      snapshot
    });
  } catch (error) {
    console.error("Investor portfolio bulk cleanup failed", error);
    return Response.json(
      { error: error?.message || "Unable to clean selected investor portfolio holdings." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
