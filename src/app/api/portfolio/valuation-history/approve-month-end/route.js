import { FieldValue } from "firebase-admin/firestore";
import { AppRequestError, adminDb, appRequestErrorStatus, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { getAccessibleInvestor, positionDocumentId, indiaDateKey } from "@/lib/server/portfolioServer";
import { assessFundbazaarHistoricalMonthEnd, fundbazaarHoldingKey, equivalentFundbazaarDatedArchives } from "@/lib/portfolioHistoricalMonthEnd";
import { loadInvestorPortfolioLedger } from "@/lib/server/portfolioHistoricalManualLedger";
import { buildMonthlyReportingLedger } from "@/lib/portfolioMonthlyLedger";
import { assessManualPmsMonthlyArchive } from "@/lib/portfolioManualMonthEnd";
import { latestVerifiedPortfolioSnapshot } from "@/lib/portfolioSnapshotSelection";
import { normalisePortfolioGoalAllocations, portfolioAllocationStatus, GENERAL_WEALTH_BUCKET_ID, GENERAL_WEALTH_BUCKET_NAME } from "@/lib/portfolioGoalAllocation";
import { buildPortfolioSourceFreshness } from "@/lib/server/portfolioFreshness";
import { PORTFOLIO_PRODUCT_TYPES, PORTFOLIO_SOURCES } from "@/lib/constants/portfolio";
import { stableHash } from "@/lib/server/portfolioImportParser";
import { lastCalendarDayOfMonth, unrepresentedExternalCashFlows, isConfirmedInvestmentActivity } from "@/lib/portfolioPeriodCoverage";
import { loadOfficialWeekendNavEvidence } from "@/lib/server/amfiOfficialNavEvidence";
import { mergeOfficialNavEvidence } from "@/lib/amfiNavHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Historical AMFI responses can take longer than an ordinary API lookup.
export const maxDuration = 60;

const asRows = (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const round = (value) => Number(Number(value || 0).toFixed(2));

function safeId(value) {
  const id = String(value || "").trim();
  if (!id || id.length > 200 || id.includes("/")) throw new AppRequestError("An investor and archived valuation are required.", 400, "bad_historical_valuation_id");
  return id;
}

function allocationsByHolding(positions = []) {
  return new Map(positions.map((item) => [fundbazaarHoldingKey(item), normalisePortfolioGoalAllocations(item.goalAllocations)]));
}

function buildHistoricalSnapshot({ investor, actor, archive, holdings, previousPositions, monthKey, snapshotId, automatic = false, supplementalManual = null }) {
  const priorAllocation = allocationsByHolding(previousPositions);
  const resultPositions = holdings.map((holding) => {
    const positionId = positionDocumentId({ investorId: investor.id, source: PORTFOLIO_SOURCES.FUNDBAZAAR, isin: holding.isin, folioNo: holding.folioNo, instrumentName: holding.instrumentName });
    const goalAllocations = priorAllocation.get(fundbazaarHoldingKey(holding)) || normalisePortfolioGoalAllocations([]);
    const currentValue = round(holding.currentValue);
    const totalInvested = round(holding.totalInvested);
    return {
      investorId: investor.id,
      positionId, productType: PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND,
      source: PORTFOLIO_SOURCES.FUNDBAZAAR, provider: "Fundbazaar", assetClass: holding.assetClass || "Equity",
      instrumentName: holding.instrumentName || holding.schemeName || "Mutual Fund",
      schemeName: holding.schemeName || holding.instrumentName || "",
      isin: holding.isin || "", folioNo: holding.folioNo || "",
      totalUnits: Number(holding.totalUnits || 0), quantity: Number(holding.totalUnits || 0),
      currentNav: Number(holding.currentNav || 0), navDate: holding.navDate,
      valuationDate: holding.navDate, valuationDateBasis: "historical_fundbazaar_holding_nav",
      currentValue, totalInvested, investedAmount: totalInvested,
      gainLoss: round(currentValue - totalInvested),
      returnPercentage: totalInvested > 0 ? round((currentValue - totalInvested) / totalInvested * 100) : 0,
      monthlySip: round(holding.monthlySip),
      goalAllocations,
      allocationStatus: portfolioAllocationStatus(goalAllocations),
      defaultBucketId: GENERAL_WEALTH_BUCKET_ID,
      defaultBucketName: GENERAL_WEALTH_BUCKET_NAME,
      historicalValuationId: archive.id,
      sourceImportFileId: archive.sourceImportFileId || "",
      sourceSnapshotMode: "approved_dated_fundbazaar",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
      snapshotId, snapshotDate: archive.valuationDate
    };
  });

  if (supplementalManual?.ready) {
    // Preserve every frozen Manual PMS holding, its real value date and the
    // corresponding imported batch. No copy is taken from today's live PMS.
    for (const item of supplementalManual.holdings) {
      const positionId = String(item.positionId || item.id || "");
      const { id: _archiveHoldingId, ...frozenHolding } = item;
      const goalAllocations = normalisePortfolioGoalAllocations(item.goalAllocations);
      resultPositions.push({
        ...frozenHolding, positionId,
        investorId: investor.id, snapshotId,
        snapshotDate: supplementalManual.assessment.valuationDate,
        source: PORTFOLIO_SOURCES.MANUAL,
        historicalValuationId: supplementalManual.archive.id,
        sourceSnapshotMode: "approved_dated_manual_pms",
        valuationDate: item.valuationDate || item.navDate,
        manualPortfolioManaged: true,
        currentValue: round(item.currentValue),
        totalInvested: round(item.totalInvested ?? item.investedAmount),
        monthlySip: round(item.monthlySip),
        goalAllocations, allocationStatus: portfolioAllocationStatus(goalAllocations)
      });
    }
  }

  const goalTotals = {};
  const bucketTotals = {};
  for (const position of resultPositions) {
    for (const allocation of position.goalAllocations || []) {
      const percentage = Number(allocation.percentage || 0);
      if (percentage <= 0) continue;
      const share = position.currentValue * percentage / 100;
      const monthly = position.monthlySip * percentage / 100;
      const bucketId = allocation.goalId || allocation.bucketId || GENERAL_WEALTH_BUCKET_ID;
      const bucket = bucketTotals[bucketId] || {
        goalId: allocation.goalId || "", bucketId: allocation.bucketId || (allocation.goalId ? "" : GENERAL_WEALTH_BUCKET_ID),
        goalName: allocation.goalName || (allocation.goalId ? "Goal" : GENERAL_WEALTH_BUCKET_NAME),
        bucketName: allocation.bucketName || allocation.goalName || GENERAL_WEALTH_BUCKET_NAME,
        currentValue: 0, monthlyContribution: 0, isDefault: !allocation.goalId
      };
      bucket.currentValue += share;
      bucket.monthlyContribution += monthly;
      bucketTotals[bucketId] = bucket;
      if (allocation.goalId) {
        const goal = goalTotals[allocation.goalId] || { goalId: allocation.goalId, goalName: allocation.goalName || "", currentValue: 0, monthlyContribution: 0 };
        goal.currentValue += share;
        goal.monthlyContribution += monthly;
        goalTotals[allocation.goalId] = goal;
      }
    }
  }
  const totals = resultPositions.reduce((acc, item) => {
    acc.currentValue += item.currentValue;
    acc.totalInvested += item.totalInvested;
    acc.monthlySip += item.monthlySip;
    const assetClass = item.assetClass || "Other";
    acc.assetClasses[assetClass] = round((acc.assetClasses[assetClass] || 0) + item.currentValue);
    const productType = item.productType || PORTFOLIO_PRODUCT_TYPES.OTHER;
    acc.productTypes[productType] = round((acc.productTypes[productType] || 0) + item.currentValue);
    return acc;
  }, { currentValue: 0, totalInvested: 0, monthlySip: 0, assetClasses: {}, productTypes: {} });
  const fullValuationDate = supplementalManual?.ready
    ? [archive.valuationDate, supplementalManual.assessment.valuationDate].sort().at(-1)
    : archive.valuationDate;
  const summary = {
    ...totals,
    currentValue: round(totals.currentValue), totalInvested: round(totals.totalInvested), monthlySip: round(totals.monthlySip),
    gainLoss: round(totals.currentValue - totals.totalInvested),
    gainLossPercentage: totals.totalInvested > 0 ? round((totals.currentValue - totals.totalInvested) / totals.totalInvested * 100) : 0,
    gainLossPartial: false, pendingCostBasisCount: 0, pendingCurrentValue: 0,
    positionCount: resultPositions.length,
    generalWealthCorpus: round(bucketTotals[GENERAL_WEALTH_BUCKET_ID]?.currentValue || 0),
    generalWealthMonthlyContribution: round(bucketTotals[GENERAL_WEALTH_BUCKET_ID]?.monthlyContribution || 0)
  };
  const result = {
    snapshotDate: fullValuationDate,
    snapshotVersion: 1,
    verificationStatus: "verified",
    reportSnapshotMode: supplementalManual?.ready ? "approved_historical_multi_source" : "approved_historical_source",
    reportCutoffDate: lastCalendarDayOfMonth(monthKey),
    sourceValuationDate: archive.valuationDate,
    earliestSourceNavDate: resultPositions.map((holding) => holding.navDate).sort()[0] || archive.valuationDate,
    sourceNavDates: [...new Set(resultPositions.map((holding) => holding.navDate))].sort(),
    sourceImportId: archive.sourceImportId || "",
    sourceImportFileId: archive.sourceImportFileId || "",
    sourceDatedValuationId: archive.id,
    sourceDatedValuationIds: supplementalManual?.ready
      ? { fundbazaar: archive.id, manual: supplementalManual.archive.id }
      : { fundbazaar: archive.id },
    sourceValuationDates: supplementalManual?.ready
      ? { fundbazaar: archive.valuationDate, manual: supplementalManual.assessment.valuationDate }
      : { fundbazaar: archive.valuationDate },
    investorId: investor.id,
    investorName: investor.fullName || investor.name || "",
    clientCode: investor.clientCode || "",
    advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
    investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
    summary,
    goalTotals: Object.values(goalTotals).map((x) => ({ ...x, currentValue: round(x.currentValue), monthlyContribution: round(x.monthlyContribution) })),
    bucketTotals: Object.values(bucketTotals).map((x) => ({ ...x, currentValue: round(x.currentValue), monthlyContribution: round(x.monthlyContribution) })),
    sourceFreshness: buildPortfolioSourceFreshness(resultPositions, fullValuationDate),
    reconciliationStatus: "verified",
    intelligence: { status: "verified", issues: [{ code: "historical_fundbazaar_approved", severity: "info", title: "Historical valuation approved", description: `Fundbazaar underlying holding NAV dates are ${[...new Set(resultPositions.map((holding) => holding.navDate))].sort().join(", ")}; reporting cutoff is ${monthKey}.` }], sourceFreshness: buildPortfolioSourceFreshness(resultPositions, fullValuationDate) },
    historicalApproval: { valuationId: archive.id, valuationDate: archive.valuationDate, reportingMonth: monthKey, actorUid: actor.uid,
      confirmation: supplementalManual?.ready ? "combined_fundbazaar_and_original_manual_pms" : automatic ? "automatic_reconciled_source_with_saturday_nav_support" : "source_complete_fundbazaar_only",
      sourceDatedValuationIds: supplementalManual?.ready ? { fundbazaar: archive.id, manual: supplementalManual.archive.id } : { fundbazaar: archive.id },
      verifiedWeekendNavs: archive.verifiedWeekendNavs || [], acceptedSaturdayNavs: archive.acceptedSaturdayNavs || [] }
  };
  return { result, resultPositions };
}

async function prepare({ actor, investorId, valuationId, monthKey, weekendNavEvidence = [], officialNavCheck = null }) {
  if (!["admin", "super_admin"].includes(actor.role)) throw new AppRequestError("Historical month-end approval requires an administrator.", 403, "historical_approval_forbidden");
  const investor = await getAccessibleInvestor(actor, investorId);
  const archiveDoc = await adminDb.collection("portfolioDatedValuations").doc(valuationId).get();
  if (!archiveDoc.exists || archiveDoc.data()?.investorId !== investorId) throw new AppRequestError("This dated valuation does not belong to this investor.", 404, "historical_archive_not_found");
  const archive = { id: archiveDoc.id, ...archiveDoc.data() };
  const sourceDoc = await adminDb.collection("portfolioImportFiles").doc(String(archive.sourceImportFileId || "")).get();
  if (!sourceDoc.exists || sourceDoc.data()?.status !== "imported" || sourceDoc.data()?.matchedInvestorId !== investorId || sourceDoc.data()?.fileFingerprint !== archive.sourceFileFingerprint) {
    throw new AppRequestError("The original imported file is missing, corrected or rolled back. This archive cannot be approved.", 409, "historical_source_invalid");
  }
  const [holdingsDocs, archiveTransactionsDocs, ledgerDocs, positionsDocs, snapshotsDocs, monthArchivesDocs] = await Promise.all([
    adminDb.collection("portfolioDatedValuationHoldings").where("valuationId", "==", valuationId).get(),
    adminDb.collection("portfolioDatedValuationTransactions").where("valuationId", "==", valuationId).get(),
    adminDb.collection("investmentTransactions").where("investorId", "==", investorId).get(),
    adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get(),
    adminDb.collection("portfolioSnapshots").where("investorId", "==", investorId).get(),
    adminDb.collection("portfolioDatedValuations").where("investorId", "==", investorId).get()
  ]);
  const snapshots = asRows(snapshotsDocs);
  const earlier = latestVerifiedPortfolioSnapshot(snapshots, (item) => String(item.snapshotDate || "") < archive.valuationDate);
  const historicalPositionDocs = earlier?.id ? await adminDb.collection("portfolioSnapshotPositions").where("snapshotId", "==", earlier.id).get() : null;
  const historicalPositions = historicalPositionDocs ? asRows(historicalPositionDocs) : [];
  const cutoffDate = lastCalendarDayOfMonth(monthKey);
  const allArchives = asRows(monthArchivesDocs);
  const currentPositions = asRows(positionsDocs);
  const managedManualPresent = [...currentPositions, ...historicalPositions].some((item) => item.source === "manual" && item.manualPortfolioManaged === true);
  const manualArchives = allArchives
    .filter((item) => item.source === "manual" && item.status === "available" && item.sourceReportType === "manual_pms_workbook"
      && String(item.valuationDate || "") >= `${monthKey}-01` && String(item.valuationDate || "") <= cutoffDate)
    .sort((a, b) => String(b.valuationDate || "").localeCompare(String(a.valuationDate || ""))
      || String(b.sourceCaptureDate || "").localeCompare(String(a.sourceCaptureDate || "")));
  let supplementalManual = null;
  const archiveBlockers = [];
  const historicalLedger = await loadInvestorPortfolioLedger(investorId);
  const normalizedLedger = buildMonthlyReportingLedger({ ledger: historicalLedger, investorId, startDate: `${monthKey}-01`, cutoffDate });
  if (managedManualPresent || manualArchives.length) {
    const manualArchive = manualArchives[0];
    if (!manualArchive) archiveBlockers.push("Manual PMS holdings exist, but no original dated Manual PMS archive exists for this reporting month.");
    else {
      if (manualArchives[1] && manualArchives[1].valuationDate === manualArchive.valuationDate
        && (Number(manualArchives[1].summary?.currentValue || 0) !== Number(manualArchive.summary?.currentValue || 0))) {
        archiveBlockers.push("Conflicting Manual PMS archives have identical valuation dates and different closing values. Reconcile the original workbook versions.");
      }
      const [manualHoldingsDocs, accountReceiptDocs] = await Promise.all([
        adminDb.collection("portfolioDatedValuationHoldings").where("valuationId", "==", manualArchive.id).get(),
        adminDb.collection("manualPortfolioAccountSnapshots").where("investorId", "==", investorId).get()
      ]);
      const manualHoldings = asRows(manualHoldingsDocs);
      const manualTransactions = normalizedLedger.filter((item) => item.source === "manual");
      const manualAssessment = assessManualPmsMonthlyArchive({
        archive: manualArchive, holdings: manualHoldings,
        accountSnapshots: asRows(accountReceiptDocs), transactions: manualTransactions,
        cutoffDate, monthKey
      });
      // A late-imported workbook cannot present its later November activity
      // as if it belonged to the original October positions.
      const captureDate = String(manualArchive.sourceCaptureDate || "").slice(0, 10);
      if (captureDate > cutoffDate) {
        const postCutoff = buildMonthlyReportingLedger({ ledger: historicalLedger, investorId,
          startDate: new Date(Date.parse(`${cutoffDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10),
          cutoffDate: captureDate });
        const otherManual = [
          ...(historicalLedger.manualCorporateActions || []).map((item) => ({ ...item, activityDate: item.actionDate })),
          ...(historicalLedger.manualIncome || []).map((item) => ({ ...item, activityDate: item.incomeDate })),
          ...(historicalLedger.manualCharges || []).map((item) => ({ ...item, activityDate: item.chargeDate }))
        ].filter((item) => item.activityDate > cutoffDate && item.activityDate <= captureDate);
        if (postCutoff.some((item) => item.source === "manual" && isConfirmedInvestmentActivity(item)) || otherManual.length) {
          manualAssessment.ready = false;
          manualAssessment.blockers.push("A later-dated Manual PMS transaction exists before the workbook capture. An October-only frozen workbook is required.");
        }
      }
      supplementalManual = { archive: manualArchive, holdings: manualHoldings, assessment: manualAssessment,
        ready: manualAssessment.ready, blockers: [...manualAssessment.blockers] };
    }
  }
  // Fundbazaar eligibility must compare only Fundbazaar and unassigned flows
  // after its NAV date. Manual PMS capital is tested against its OWN date.
  const fbLedger = normalizedLedger.filter((item) => item.source !== "manual");
  const cashFlow = unrepresentedExternalCashFlows({ snapshotDate: archive.valuationDate, cutoffDate, transactions: fbLedger });
  const holdings = asRows(holdingsDocs);
  // Eligibility preview and explicit approval MUST share the same server-side
  // official NAV check as automatic month-end recovery. A browser-supplied
  // empty proof must not prevent official verification from running.
  // Automatic recovery already fetched the official evidence; reuse it.
  const official = officialNavCheck || await loadOfficialWeekendNavEvidence(holdings);
  const verifiedEvidence = mergeOfficialNavEvidence(official.evidence, weekendNavEvidence);
  const archiveTransactions = asRows(archiveTransactionsDocs);
  const ledgerTransactions = asRows(ledgerDocs);
  const eligibility = assessFundbazaarHistoricalMonthEnd({
    archive, holdings, archiveTransactions, ledgerTransactions,
    currentPositions, historicalPositions, snapshots, monthKey, laterCashFlows: cashFlow,
    otherMonthArchives: allArchives, weekendNavEvidence: verifiedEvidence, supplementalManual
  });
  // Keep a clear diagnostic without treating third-party or self-submitted
  // records as proof of an automatic AMFI match.
  const navVerification = {
    required: official.required,
    verified: official.verified,
    issue: official.required > official.verified
      ? official.issue || "No exact official ISIN, NAV date and NAV amount match was returned by AMFI."
      : "",
  };
  if (archiveBlockers.length) {
    eligibility.blockers.push(...archiveBlockers);
    eligibility.ready = false;
  }
  const snapshotId = `hist_${stableHash((supplementalManual?.archive?.id
    ? `${investorId}|${valuationId}|${supplementalManual.archive.id}|${monthKey}`
    : `${investorId}|${valuationId}|${monthKey}`), 48)}`;
  return { investor, archive, eligibility, holdings, historicalPositions, snapshotId, navVerification, supplementalManual };
}

async function handleRequest(request, approve) {
  try {
    const actor = await verifyStaffRequest(request);
    const body = approve ? await request.json().catch(() => ({})) : Object.fromEntries(new URL(request.url).searchParams);
    const investorId = safeId(body.investorId);
    const monthKey = String(body.monthKey || "").trim();
    const automatic = Boolean(approve && body.auto === true);
    // The on-demand engine only considers the latest original import for a
    // completed month. It never defaults to an older, easier-to-approve one.
    let valuationId = automatic ? "" : safeId(body.valuationId);
    let weekendNavEvidence = [];
    let officialNavCheck = null;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) || `${monthKey}-01` > indiaDateKey()) throw new AppRequestError("A past or current reporting month is required.", 400, "historical_month_invalid");
    if (approve && !automatic && body.confirm !== "APPROVE HISTORICAL FUNDBAZAAR VALUATION") throw new AppRequestError("Explicit source coverage and NAV approval is required.", 400, "historical_approval_confirmation_missing");
    if (automatic) {
      if (!["admin", "super_admin"].includes(actor.role)) throw new AppRequestError("Automatic month-end reconciliation requires an administrator.", 403, "monthly_close_forbidden");
      await getAccessibleInvestor(actor, investorId);
      if (lastCalendarDayOfMonth(monthKey) >= indiaDateKey()) throw new AppRequestError("The reporting month must end before automatic reconciliation.", 409, "monthly_close_period_open");
      const archives = asRows(await adminDb.collection("portfolioDatedValuations").where("investorId", "==", investorId).get())
        .filter((item) => item.status === "available" && item.source === "fundbazaar"
          && String(item.valuationDate || "").slice(0, 7) === monthKey
          && String(item.valuationDate || "") <= lastCalendarDayOfMonth(monthKey))
        .sort((a, b) => String(b.valuationDate || "").localeCompare(String(a.valuationDate || ""))
          || Number(b.archivedAt?.seconds || b.createdAt?.seconds || 0) - Number(a.archivedAt?.seconds || a.createdAt?.seconds || 0)
          || String(b.id || "").localeCompare(String(a.id || "")));
      if (!archives.length) throw new AppRequestError(`No imported Fundbazaar historical valuation exists for ${monthKey}. The October 5 portfolio snapshot cannot be substituted for a month-end valuation.`, 409, "monthly_close_no_historical_archive");
      // Equal-date daily uploads can have different source file hashes even
      // when every underlying scheme/folio financial fact is unchanged.
      // Compare the *holding contents*, not filenames or aggregate totals.
      const latest = archives[0];
      valuationId = safeId(latest.id);
      const holdingDocs = await adminDb.collection("portfolioDatedValuationHoldings").where("valuationId", "==", valuationId).get();
      const latestHoldings = asRows(holdingDocs);
      for (const other of archives.slice(1).filter((item) => item.valuationDate === latest.valuationDate)) {
        if (other.id === latest.id) continue;
        const otherDocs = await adminDb.collection("portfolioDatedValuationHoldings").where("valuationId", "==", other.id).get();
        if (!equivalentFundbazaarDatedArchives(latest, other, latestHoldings, asRows(otherDocs))) {
          throw new AppRequestError(`Conflicting ${monthKey} Fundbazaar archives share the same NAV date but have different scheme/folio units, values or cost basis. Resolve the genuine source discrepancy before closing.`, 409, "monthly_close_conflicting_archives");
        }
      }
      const official = await loadOfficialWeekendNavEvidence(latestHoldings);
      officialNavCheck = official;
      weekendNavEvidence = official.evidence;
      if (official.required && official.verified !== official.required) {
        throw new AppRequestError(`The ${monthKey} source is saved, but ${official.required - official.verified} unusual mutual-fund NAV date(s) could not be independently verified against AMFI. ${official.issue || "Official scheme/ISIN/date/NAV match missing."} No reupload is needed; keep the report unpublished and retry when official data is accessible.`, 409, "monthly_close_official_nav_unavailable");
      }
    }
    if (!automatic && body.weekendNavEvidence) {
      try {
        const submitted = typeof body.weekendNavEvidence === "string" ? JSON.parse(body.weekendNavEvidence) : body.weekendNavEvidence;
        if (!Array.isArray(submitted) || submitted.length > 25) throw new Error("Invalid proof size");
        weekendNavEvidence = submitted.map((proof) => ({
          isin: String(proof.isin || "").slice(0, 40),
          folioNo: String(proof.folioNo || "").slice(0, 80),
          schemeName: String(proof.schemeName || proof.instrumentName || "").slice(0, 200),
          navDate: String(proof.navDate || "").slice(0, 10),
          publishedNav: proof.publishedNav,
          referenceUrl: String(proof.referenceUrl || "").slice(0, 620)
        }));
      } catch { throw new AppRequestError("Invalid NAV verification evidence. Recheck the NAV details.", 400, "historical_nav_evidence_invalid"); }
    }
    const prepared = await prepare({ actor, investorId, valuationId, monthKey, weekendNavEvidence, officialNavCheck });
    const { eligibility, archive, investor, holdings, historicalPositions, snapshotId, supplementalManual } = prepared;
    if (archive.monthlyReportEligible && archive.reportSnapshotId === snapshotId) {
      // A previously approved snapshot must not bypass NEW movement, a newer
      // source, an invalidated import or newly added PMS holdings.
      if (!eligibility.ready) throw new AppRequestError(
        `Previously approved month-end source needs reconciliation: ${eligibility.blockers.join(" ")}`,
        409, "monthly_close_previous_approval_stale"
      );
      const existing = await adminDb.collection("portfolioSnapshots").doc(snapshotId).get();
      if (existing.exists && existing.data()?.verificationStatus === "verified") {
        return Response.json({ ready: true, alreadyApproved: true, eligibility, snapshotId, valuationDate: archive.valuationDate }, { headers: { "Cache-Control": "private, no-store" } });
      }
    }
    if (!approve) return Response.json({ ready: eligibility.ready, eligibility, navVerification: prepared.navVerification, valuationId, monthKey, sourceFileName: archive.sourceFileName || "" }, { headers: { "Cache-Control": "private, no-store" } });
    if (!eligibility.ready) throw new AppRequestError(
      `${automatic ? "Automatic month-end reconciliation requires review" : "Cannot approve historical valuation"}: ${eligibility.blockers.join(" ")}`,
      409, automatic ? "monthly_close_requires_review" : "historical_valuation_not_eligible"
    );

    // Stage positions first. The snapshot is NOT marked verified until all
    // associated holdings exist, so partial writes can never unblock reports.
    const approvalArchive = { ...archive, verifiedWeekendNavs: eligibility.verifiedWeekendNavs, acceptedSaturdayNavs: eligibility.acceptedSaturdayNavs };
    const { result, resultPositions } = buildHistoricalSnapshot({ investor, actor, archive: approvalArchive, holdings, previousPositions: historicalPositions, monthKey, snapshotId, automatic, supplementalManual });
    const snapshotRef = adminDb.collection("portfolioSnapshots").doc(snapshotId);
    const previous = await snapshotRef.get();
    if (previous.exists && previous.data()?.verificationStatus === "verified") throw new AppRequestError("This historical snapshot is already verified. Refresh the archive rather than replacing financial history.", 409, "historical_snapshot_already_verified");
    await snapshotRef.set({ investorId, snapshotDate: result.snapshotDate, verificationStatus: "pending_review",
      reportSnapshotMode: result.reportSnapshotMode, sourceDatedValuationId: valuationId,
      sourceDatedValuationIds: result.sourceDatedValuationIds, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const writer = adminDb.bulkWriter();
    resultPositions.forEach((item) => {
      const docId = `${snapshotId}_${item.positionId}`;
      writer.set(adminDb.collection("portfolioSnapshotPositions").doc(docId), { ...item, updatedAt: FieldValue.serverTimestamp() });
    });
    await writer.close();
    const archivedRef = adminDb.collection("portfolioDatedValuations").doc(valuationId);
    const importedRef = adminDb.collection("portfolioImportFiles").doc(String(archive.sourceImportFileId || ""));
    const auditRef = adminDb.collection("portfolioHistoricalApprovalAudit").doc(`${snapshotId}_v1`);
    // Finalise the approval atomically. A concurrent Rollback/Correct Investor
    // cannot void the source while this operation marks its snapshot verified.
    await adminDb.runTransaction(async (tx) => {
      const [liveArchive, liveImport, liveSnapshot] = await Promise.all([
        tx.get(archivedRef), tx.get(importedRef), tx.get(snapshotRef)
      ]);
      if (!liveArchive.exists || liveArchive.data()?.status !== "available" || liveArchive.data()?.sourceFileFingerprint !== archive.sourceFileFingerprint) {
        throw new AppRequestError("The archived source changed during approval. Recheck the historical valuation.", 409, "historical_archive_changed");
      }
      if (!liveImport.exists || liveImport.data()?.status !== "imported" || liveImport.data()?.matchedInvestorId !== investorId || liveImport.data()?.fileFingerprint !== archive.sourceFileFingerprint) {
        throw new AppRequestError("The original import was changed or rolled back during approval. Recheck the source.", 409, "historical_import_changed");
      }
      if (!liveSnapshot.exists || liveSnapshot.data()?.verificationStatus !== "pending_review" || liveSnapshot.data()?.sourceDatedValuationId !== valuationId) {
        throw new AppRequestError("A competing portfolio snapshot revision was detected. Please review the data again.", 409, "historical_snapshot_changed");
      }
      if (supplementalManual?.ready) {
        const manualDoc = await tx.get(adminDb.collection("portfolioDatedValuations").doc(supplementalManual.archive.id));
        if (!manualDoc.exists || manualDoc.data()?.status !== "available"
          || manualDoc.data()?.sourceImportId !== supplementalManual.archive.sourceImportId
          || Number(manualDoc.data()?.summary?.currentValue) !== Number(supplementalManual.archive.summary?.currentValue)) {
          throw new AppRequestError("The Manual PMS historical source changed during approval.", 409, "manual_historical_source_changed");
        }
      }
      tx.set(snapshotRef, {
        ...result,
        verifiedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedByUid: actor.uid,
        createdAt: previous.exists ? (previous.data()?.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp()
      }, { merge: true });
      if (supplementalManual?.ready) {
        tx.set(adminDb.collection("portfolioDatedValuations").doc(supplementalManual.archive.id), {
          verificationStatus: "verified", monthlyReportEligible: true, approvedMonthKey: monthKey,
          reportSnapshotId: snapshotId, approvedAt: FieldValue.serverTimestamp(), approvedByUid: actor.uid
        }, { merge: true });
      }
      tx.set(archivedRef, { verificationStatus: "verified", monthlyReportEligible: true, reportSnapshotId: snapshotId, approvedMonthKey: monthKey, verifiedWeekendNavs: eligibility.verifiedWeekendNavs, acceptedSaturdayNavs: eligibility.acceptedSaturdayNavs, approvedAt: FieldValue.serverTimestamp(), approvedByUid: actor.uid }, { merge: true });
      tx.set(auditRef, { investorId, valuationId, monthKey, snapshotId, valuationDate: archive.valuationDate, sourceValue: eligibility.sourceValue, sourceInvested: eligibility.sourceInvested, actorUid: actor.uid, createdAt: FieldValue.serverTimestamp(), checklist: supplementalManual?.ready
        ? "Fundbazaar + original Manual PMS, both sources reconciled at their own valuation dates, no later movements"
        : "Fundbazaar only, reconciled ledger, last available NAV including Saturday source dates, no post-valuation movements", verifiedWeekendNavs: eligibility.verifiedWeekendNavs, acceptedSaturdayNavs: eligibility.acceptedSaturdayNavs }, { merge: true });
    });
    return Response.json({ ready: true, approved: true, automatic, snapshotId, valuationDate: archive.valuationDate, cutoffDate: eligibility.cutoffDate, closingValue: result.summary.currentValue, sourceValuationDates: result.sourceValuationDates, eligibility }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    // A rejected month-end eligibility/approval request is an expected 4xx
    // financial control outcome. Do not surface it as an uncaught Next.js
    // console error; only unexpected server failures deserve an error log.
    const status = appRequestErrorStatus(error, 500);
    if (status >= 500) console.error("Historical month-end approval failed", { code: error?.code || "unexpected", message: error?.message || "unknown" });
    return Response.json({ error: error?.message || "Unable to review historical month-end valuation.", code: error?.code || "historical_approval_failed" }, { status });
  }
}

export async function GET(request) { return handleRequest(request, false); }
export async function POST(request) { return handleRequest(request, true); }
