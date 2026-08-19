import { FieldValue } from "firebase-admin/firestore";
import {
  adminDb,
  verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_SOURCES,
  PORTFOLIO_SOURCE_LABELS
} from "@/lib/constants/portfolio";
import {
  createPortfolioSnapshot,
  getAccessibleInvestor,
  indiaDateKey
} from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

const CLEANABLE_SOURCES = [
  PORTFOLIO_SOURCES.FUNDBAZAAR,
  PORTFOLIO_SOURCES.BAJAJ_BROKING,
  PORTFOLIO_SOURCES.ULIP,
  PORTFOLIO_SOURCES.GROWVEST_STANDARD,
  PORTFOLIO_SOURCES.MANUAL
];

function isAdmin(actor) {
  return ["super_admin", "admin"].includes(actor?.role);
}

function sourceLabel(source) {
  return PORTFOLIO_SOURCE_LABELS[source] || source || "Portfolio Source";
}

async function loadInvestorSourceData(investorId) {
  const [
    positionsSnapshot,
    transactionsSnapshot,
    tradesSnapshot,
    policiesSnapshot,
    tradingSummarySnapshot,
    mappingsSnapshot,
    fingerprintsSnapshot,
    importFilesSnapshot,
    importChangesSnapshot
  ] = await Promise.all([
    adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get(),
    adminDb.collection("investmentTransactions").where("investorId", "==", investorId).get(),
    adminDb.collection("tradingTransactions").where("investorId", "==", investorId).get(),
    adminDb.collection("ulipPolicies").where("investorId", "==", investorId).get(),
    adminDb.collection("tradingMonthlySummaries").where("investorId", "==", investorId).get(),
    adminDb.collection("externalInvestorMappings").where("investorId", "==", investorId).get(),
    adminDb.collection("portfolioFileFingerprints").where("investorId", "==", investorId).get(),
    adminDb.collection("portfolioImportFiles").where("matchedInvestorId", "==", investorId).get(),
    adminDb.collection("portfolioImportChanges").where("investorId", "==", investorId).get()
  ]);

  return {
    positions: positionsSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    transactions: transactionsSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    trades: tradesSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    policies: policiesSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    tradingSummaries: tradingSummarySnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    mappings: mappingsSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    fingerprints: fingerprintsSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    importFiles: importFilesSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })),
    importChanges: importChangesSnapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }))
  };
}

function sourceRows(data, source) {
  return {
    positions: data.positions.filter((item) => item.source === source),
    transactions: data.transactions.filter((item) => item.source === source),
    trades: data.trades.filter((item) => item.source === source),
    policies: data.policies.filter((item) => item.source === source),
    tradingSummaries: data.tradingSummaries.filter((item) => item.source === source),
    mappings: data.mappings.filter((item) => item.source === source),
    fingerprints: data.fingerprints.filter((item) => item.source === source),
    importFiles: data.importFiles.filter((item) => item.source === source),
    importChanges: data.importChanges.filter((item) => item.source === source)
  };
}

function cleanupPreview(source, rows) {
  const activePositions = rows.positions.filter((item) => !["inactive", "exited"].includes(item.status));
  const currentValue = activePositions.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const investedAmount = activePositions.reduce((sum, item) => {
    if (item.productType === "ulip" && Number(item.policyTotalPremiumPaid || 0) > 0) return sum;
    return sum + Number(item.totalInvested ?? item.investedAmount ?? 0);
  }, 0);
  const fileIds = new Set(rows.importFiles.map((item) => item.id));
  const batchIds = new Set(rows.importFiles.map((item) => item.batchId).filter(Boolean));
  const fingerprintIds = new Set([
    ...rows.fingerprints.map((item) => item.id),
    ...rows.importFiles.map((item) => item.fileFingerprint).filter(Boolean)
  ]);

  return {
    source,
    label: sourceLabel(source),
    available: rows.positions.length > 0
      || rows.transactions.length > 0
      || rows.trades.length > 0
      || rows.policies.length > 0
      || rows.mappings.length > 0
      || rows.importFiles.length > 0,
    counts: {
      positions: rows.positions.length,
      activePositions: activePositions.length,
      transactions: rows.transactions.length,
      trades: rows.trades.length,
      policies: rows.policies.length,
      tradingSummaries: rows.tradingSummaries.length,
      mappings: rows.mappings.length,
      fingerprints: fingerprintIds.size,
      importFiles: fileIds.size,
      importBatches: batchIds.size
    },
    currentValue: Number(currentValue.toFixed(2)),
    investedAmount: Number(investedAmount.toFixed(2))
  };
}

async function cleanupSummaryForInvestor(investorId) {
  const data = await loadInvestorSourceData(investorId);
  return {
    data,
    sources: CLEANABLE_SOURCES
      .map((source) => cleanupPreview(source, sourceRows(data, source)))
      .filter((item) => item.available)
  };
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!isAdmin(actor)) {
      return Response.json({ error: "Only Admin or Super Admin can clean a vendor portfolio." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const investorId = String(searchParams.get("investorId") || "").trim();
    if (!investorId) return Response.json({ error: "Investor is required." }, { status: 400 });

    const investor = await getAccessibleInvestor(actor, investorId);
    const { sources } = await cleanupSummaryForInvestor(investorId);

    return Response.json({
      investor: {
        id: investor.id,
        fullName: investor.fullName || investor.name || "Investor",
        clientCode: investor.clientCode || ""
      },
      sources
    });
  } catch (error) {
    console.error("Vendor portfolio cleanup preview failed", error);
    return Response.json(
      { error: error?.message || "Unable to preview vendor portfolio cleanup." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!isAdmin(actor)) {
      return Response.json({ error: "Only Admin or Super Admin can clean a vendor portfolio." }, { status: 403 });
    }

    const payload = await request.json();
    const investorId = String(payload?.investorId || "").trim();
    const source = String(payload?.source || "").trim();
    const reason = String(payload?.reason || "").trim();
    const confirmation = String(payload?.confirmation || "").trim().toUpperCase();

    if (!investorId) return Response.json({ error: "Investor is required." }, { status: 400 });
    if (!CLEANABLE_SOURCES.includes(source)) return Response.json({ error: "Select a valid vendor/source." }, { status: 400 });
    if (reason.length < 5) return Response.json({ error: "Enter a clear cleanup reason." }, { status: 400 });
    if (confirmation !== "CLEAN") return Response.json({ error: "Type CLEAN to confirm the vendor portfolio reset." }, { status: 400 });

    const investor = await getAccessibleInvestor(actor, investorId);
    const { data } = await cleanupSummaryForInvestor(investorId);
    const rows = sourceRows(data, source);
    const preview = cleanupPreview(source, rows);
    if (!preview.available) {
      return Response.json({ error: `${sourceLabel(source)} has no portfolio data to clean for this investor.` }, { status: 404 });
    }

    const batchIds = [...new Set(rows.importFiles.map((item) => item.batchId).filter(Boolean))];
    const importFileByFingerprint = new Map(rows.importFiles.filter((item) => item.fileFingerprint).map((item) => [item.fileFingerprint, item]));
    const fingerprintIds = [...new Set([
      ...rows.fingerprints.map((item) => item.id),
      ...rows.importFiles.map((item) => item.fileFingerprint).filter(Boolean)
    ])];
    const fingerprintSnapshots = fingerprintIds.length
      ? await adminDb.getAll(...fingerprintIds.map((id) => adminDb.collection("portfolioFileFingerprints").doc(id)))
      : [];
    const releasableFingerprintRefs = fingerprintSnapshots
      .filter((snapshot) => {
        if (!snapshot.exists) return false;
        const data = snapshot.data();
        if (data.source && data.source !== source) return false;
        if (data.investorId && data.investorId === investorId) return true;
        const importedFile = importFileByFingerprint.get(snapshot.id);
        return Boolean(importedFile && (!data.fileId || data.fileId === importedFile.id));
      })
      .map((snapshot) => snapshot.ref);

    const cleanupAt = FieldValue.serverTimestamp();
    const actorName = actor.fullName || actor.email || "GrowVest User";
    const writer = adminDb.bulkWriter();

    rows.positions.forEach((item) => writer.delete(item.ref));
    rows.transactions.forEach((item) => writer.delete(item.ref));
    rows.trades.forEach((item) => writer.delete(item.ref));
    rows.policies.forEach((item) => writer.delete(item.ref));
    rows.tradingSummaries.forEach((item) => writer.delete(item.ref));
    rows.mappings.forEach((item) => writer.delete(item.ref));
    releasableFingerprintRefs.forEach((ref) => writer.delete(ref));

    rows.importFiles.forEach((item) => {
      writer.set(item.ref, {
        status: "vendor_cleaned",
        recoveryStatus: "vendor_cleaned",
        vendorCleanupSource: source,
        vendorCleanupReason: reason,
        vendorCleanedAt: cleanupAt,
        vendorCleanedByUid: actor.uid,
        vendorCleanedByName: actorName,
        updatedAt: cleanupAt
      }, { merge: true });
    });

    rows.importChanges.forEach((item) => {
      writer.set(item.ref, {
        status: "invalidated_by_vendor_cleanup",
        reversible: false,
        vendorCleanupSource: source,
        vendorCleanupReason: reason,
        vendorCleanedAt: cleanupAt,
        vendorCleanedByUid: actor.uid,
        updatedAt: cleanupAt
      }, { merge: true });
    });

    batchIds.forEach((batchId) => {
      writer.set(adminDb.collection("portfolioImports").doc(batchId), {
        lastVendorCleanupSource: source,
        lastVendorCleanupInvestorId: investorId,
        lastVendorCleanupReason: reason,
        lastVendorCleanupAt: cleanupAt,
        lastVendorCleanupByUid: actor.uid,
        updatedAt: cleanupAt
      }, { merge: true });
    });

    if (source === PORTFOLIO_SOURCES.FUNDBAZAAR) {
      writer.set(adminDb.collection("investors").doc(investorId), {
        fundbazaarDailyTrackingEnabled: false,
        updatedAt: cleanupAt
      }, { merge: true });
    }

    await writer.close();

    const snapshot = await createPortfolioSnapshot(investorId, actor, {
      snapshotDate: indiaDateKey(),
      verificationStatus: "corrected",
      sourceImportId: `vendor_cleanup_${source}_${Date.now()}`
    });

    await adminDb.collection("activityLogs").add({
      recordType: "portfolio_vendor_cleanup",
      recordId: `${investorId}_${source}`,
      investorId,
      clientCode: investor.clientCode || "",
      leadName: investor.fullName || investor.name || "Investor",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      action: "portfolio_vendor_cleaned",
      title: `${sourceLabel(source)} portfolio cleaned`,
      description: `${sourceLabel(source)} portfolio data was cleaned for ${investor.fullName || investor.name || "the investor"} by ${actorName}.`,
      metadata: {
        source,
        reason,
        removed: preview.counts,
        currentValueRemoved: preview.currentValue,
        importLocksReleased: releasableFingerprintRefs.length,
        importBatchesAffected: batchIds.length,
        replacementSnapshotId: snapshot.id
      },
      createdByUid: actor.uid,
      createdByName: actorName,
      createdAt: FieldValue.serverTimestamp()
    });

    return Response.json({
      success: true,
      investorId,
      investorName: investor.fullName || investor.name || "Investor",
      source,
      sourceLabel: sourceLabel(source),
      removed: preview.counts,
      currentValueRemoved: preview.currentValue,
      importLocksReleased: releasableFingerprintRefs.length,
      snapshot
    });
  } catch (error) {
    console.error("Vendor portfolio cleanup failed", error);
    return Response.json(
      { error: error?.message || "Unable to clean the selected vendor portfolio." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
