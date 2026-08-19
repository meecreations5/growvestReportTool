import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_ADAPTER_STATUS,
  PORTFOLIO_IMPORT_STATUS,
  PORTFOLIO_MATCH_STATUS,
  PORTFOLIO_MAX_FILES_PER_BATCH,
  PORTFOLIO_MAX_FILE_SIZE,
  PORTFOLIO_REPORT_TYPES,
  PORTFOLIO_SOURCES
} from "@/lib/constants/portfolio";
import { detectPortfolioImportFile, normaliseExternalName, parseGenericPortfolioFile, stableHash } from "@/lib/server/portfolioImportParser";
import { normalisePan } from "@/lib/server/kycSecurity";

export const runtime = "nodejs";

function investorName(investor = {}) {
  return investor.fullName || investor.name || "Investor";
}

function tokenSimilarity(left = "", right = "") {
  const a = new Set(normaliseExternalName(left).split(" ").filter(Boolean));
  const b = new Set(normaliseExternalName(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((token) => { if (b.has(token)) overlap += 1; });
  const union = new Set([...a, ...b]).size;
  return union ? overlap / union : 0;
}

function buildSuggestions(externalName, investors = []) {
  const normalized = normaliseExternalName(externalName);
  return investors
    .map((investor) => {
      const investorNormalized = normaliseExternalName(investorName(investor));
      const exact = normalized === investorNormalized;
      const tokenScore = tokenSimilarity(normalized, investorNormalized);
      const containment = normalized.includes(investorNormalized) || investorNormalized.includes(normalized) ? 0.12 : 0;
      const score = exact ? 1 : Math.min(0.99, tokenScore + containment);
      return { investorId: investor.id, clientCode: investor.clientCode || "", fullName: investorName(investor), score: Number(score.toFixed(2)), exact };
    })
    .filter((item) => item.score >= 0.34)
    .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName))
    .slice(0, 5);
}

async function accessibleInvestors(actor) {
  let query = adminDb.collection("investors").where("isDeleted", "==", false);
  if (actor.role === "advisor") query = query.where("assignedAdvisorUid", "==", actor.uid);
  const snapshot = await query.get();
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}


function externalMappingIds(detected = {}) {
  const source = detected.source || PORTFOLIO_SOURCES.MANUAL;
  const ids = [];
  if (detected.normalizedExternalClientName) {
    ids.push({
      identityType: "client_name",
      id: source === PORTFOLIO_SOURCES.FUNDBAZAAR
        ? `${source}_${stableHash(detected.normalizedExternalClientName, 32)}`
        : `${source}_name_${stableHash(detected.normalizedExternalClientName, 32)}`
    });
  }
  if (detected.externalPan) ids.push({ identityType: "pan", id: `${source}_pan_${stableHash(String(detected.externalPan).toUpperCase(), 32)}` });
  if (detected.externalClientCode) ids.push({ identityType: "client_code", id: `${source}_client_${stableHash(String(detected.externalClientCode).toUpperCase(), 32)}` });
  if (source === PORTFOLIO_SOURCES.ULIP) {
    (detected.policies || []).forEach((policy) => {
      const policyNumber = String(policy?.policyNumber || "").trim().toUpperCase();
      if (policyNumber) ids.push({ identityType: "policy_number", id: `${source}_policy_${stableHash(policyNumber, 32)}` });
    });
  }
  return ids.filter((item, index, rows) => rows.findIndex((other) => other.id === item.id) === index);
}

async function loadExternalMappings(detected = {}) {
  const entries = externalMappingIds(detected);
  if (!entries.length) return [];
  const snapshots = await adminDb.getAll(...entries.map((item) => adminDb.collection("externalInvestorMappings").doc(item.id)));
  return entries.map((entry, index) => ({ ...entry, snapshot: snapshots[index], data: snapshots[index]?.exists ? snapshots[index].data() : null }));
}

function sourceClientCode(investor = {}, source = "") {
  if (source === PORTFOLIO_SOURCES.BAJAJ_BROKING) {
    return String(investor.bajajClientCode || investor.brokerClientCode || investor.tradingClientCode || "").trim().toUpperCase();
  }
  if (source === PORTFOLIO_SOURCES.ULIP) {
    return String(investor.ulipClientCode || investor.insuranceClientCode || "").trim().toUpperCase();
  }
  if (source === PORTFOLIO_SOURCES.GROWVEST_STANDARD) {
    return String(investor.clientCode || "").trim().toUpperCase();
  }
  return "";
}

function publicFileResult(fileRef, detected, extra = {}) {
  return {
    fileId: fileRef.id,
    fileName: detected.fileName,
    fileSize: detected.fileSize,
    fileFormat: detected.fileFormat || "",
    source: detected.source,
    reportType: detected.reportType,
    adapterStatus: detected.adapterStatus,
    confidence: Number(detected.confidence || 0),
    sheetName: detected.sheetName || "",
    externalClientName: detected.externalClientName || "",
    externalPan: detected.externalPan || "",
    externalClientCode: detected.externalClientCode || "",
    warnings: detected.warnings || [],
    reportPeriodStart: detected.reportPeriodStart || "",
    reportPeriodEnd: detected.reportPeriodEnd || "",
    summary: detected.summary || null,
    policies: detected.policies || [],
    genericMapping: detected.genericMapping || null,
    mappingProfileId: detected.mappingProfileId || "",
    completeSnapshot: detected.completeSnapshot === true,
    error: detected.error || "",
    ...extra
  };
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item) => item && typeof item.arrayBuffer === "function");
    if (!files.length) return Response.json({ error: "Select at least one portfolio report." }, { status: 400 });
    if (files.length > PORTFOLIO_MAX_FILES_PER_BATCH) return Response.json({ error: `Upload up to ${PORTFOLIO_MAX_FILES_PER_BATCH} files in one batch.` }, { status: 400 });
    const oversized = files.find((file) => Number(file.size || 0) > PORTFOLIO_MAX_FILE_SIZE);
    if (oversized) return Response.json({ error: `${oversized.name} is larger than 8 MB.` }, { status: 400 });

    const investors = await accessibleInvestors(actor);
    const batchRef = adminDb.collection("portfolioImports").doc();
    const fileResults = [];
    const fileIds = [];
    const writer = adminDb.bulkWriter();

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fileRef = adminDb.collection("portfolioImportFiles").doc(`${batchRef.id}_${String(index + 1).padStart(3, "0")}`);
      fileIds.push(fileRef.id);

      let detected = await detectPortfolioImportFile(file);
      if (detected.adapterStatus === PORTFOLIO_ADAPTER_STATUS.MAPPING_REQUIRED && detected.genericMapping?.headerSignature) {
        const profileId = `gmap_${stableHash(`${detected.genericMapping.headerSignature}|${normaliseExternalName(detected.genericMapping.sheetName || detected.sheetName || "")}`, 40)}`;
        const profileSnapshot = await adminDb.collection("portfolioImportMappingProfiles").doc(profileId).get();
        if (profileSnapshot.exists && profileSnapshot.data()?.active !== false) {
          try {
            const profile = profileSnapshot.data();
            const parsed = await parseGenericPortfolioFile(file, {
              ...(profile.config || {}),
              sheetName: detected.genericMapping.sheetName || profile.config?.sheetName || "",
              mappingProfileId: profileId
            });
            detected = {
              ...detected,
              ...parsed,
              fileName: detected.fileName,
              fileSize: detected.fileSize,
              fileFingerprint: detected.fileFingerprint,
              fileFormat: detected.fileFormat,
              mappingProfileId: profileId,
              error: ""
            };
          } catch (profileError) {
            detected = {
              ...detected,
              warnings: [...(detected.warnings || []), `Saved column mapping could not be applied: ${profileError?.message || "mapping changed"}. Review the columns again.`]
            };
          }
        }
      }
      const readyReportTypes = [
        PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_CLIENT_VALUATION,
        PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_LEDGER,
        PORTFOLIO_REPORT_TYPES.BAJAJ_DELIVERY,
        PORTFOLIO_REPORT_TYPES.BAJAJ_INTRADAY,
        PORTFOLIO_REPORT_TYPES.BAJAJ_COMBINED,
        PORTFOLIO_REPORT_TYPES.ULIP_PORTFOLIO,
        PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD
      ];
      const isReadyImport = readyReportTypes.includes(detected.reportType)
        && detected.adapterStatus === PORTFOLIO_ADAPTER_STATUS.READY;

      if (!isReadyImport) {
        const status = detected.adapterStatus === PORTFOLIO_ADAPTER_STATUS.NEEDS_PACKAGE
          ? "needs_package"
          : detected.adapterStatus === PORTFOLIO_ADAPTER_STATUS.MAPPING_REQUIRED
            ? "mapping_required"
            : "unsupported";
        const fileRecord = {
          batchId: batchRef.id,
          uploadIndex: index,
          source: detected.source,
          reportType: detected.reportType,
          adapterStatus: detected.adapterStatus,
          confidence: Number(detected.confidence || 0),
          advisorUid: actor.uid,
          createdByUid: actor.uid,
          createdByName: actor.fullName || actor.email || "GrowVest User",
          fileName: detected.fileName,
          fileSize: detected.fileSize,
          fileFormat: detected.fileFormat || "",
          sheetName: detected.sheetName || "",
          fileFingerprint: detected.fileFingerprint,
          matchStatus: status,
          status,
          parseError: detected.error || (status === "mapping_required" ? "Column mapping is required before this file can be imported." : "Automatic importer is not enabled for this report type yet."),
          genericMapping: detected.genericMapping || null,
          mappingProfileId: detected.mappingProfileId || "",
          completeSnapshot: detected.completeSnapshot === true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };
        writer.set(fileRef, fileRecord);
        fileResults.push(publicFileResult(fileRef, detected, { uploadIndex: index, matchStatus: status, error: fileRecord.parseError, suggestions: [] }));
        continue;
      }

      const fingerprintRef = adminDb.collection("portfolioFileFingerprints").doc(detected.fileFingerprint);
      const [fingerprintSnapshot, mappingEntries] = await Promise.all([
        fingerprintRef.get(),
        loadExternalMappings(detected)
      ]);
      const existingMappingInvestorIds = new Set(mappingEntries.map((item) => item.data?.investorId).filter(Boolean));
      const mappingConflict = existingMappingInvestorIds.size > 1;
      const existingMapping = mappingEntries.find((item) => item.data)?.data || null;
      const suggestions = buildSuggestions(detected.externalClientName, investors);
      const accessibleMappedInvestor = existingMapping ? investors.find((item) => item.id === existingMapping.investorId) : null;
      const externalPan = normalisePan(detected.externalPan || "");
      const panProfileMatches = externalPan
        ? investors.filter((item) => normalisePan(item.panNumber || item.panNormalized || "") === externalPan)
        : [];
      const panProfileConflict = panProfileMatches.length > 1;
      const panProfileInvestor = panProfileMatches.length === 1 ? panProfileMatches[0] : null;
      const externalClientCode = String(detected.externalClientCode || "").trim().toUpperCase();
      const brokerCodeMatches = externalClientCode
        ? investors.filter((item) => sourceClientCode(item, detected.source) === externalClientCode)
        : [];
      const brokerCodeConflict = brokerCodeMatches.length > 1;
      const brokerCodeInvestor = brokerCodeMatches.length === 1 ? brokerCodeMatches[0] : null;
      const profileStrongMatches = new Set([panProfileInvestor?.id, brokerCodeInvestor?.id].filter(Boolean));
      const strongProfileConflict = profileStrongMatches.size > 1;
      const strongProfileInvestor = panProfileInvestor || brokerCodeInvestor || null;
      const profileMappingConflict = Boolean(existingMapping && strongProfileInvestor && existingMapping.investorId !== strongProfileInvestor.id);

      let matchStatus = PORTFOLIO_MATCH_STATUS.UNMATCHED;
      let matchedInvestorId = "";
      let matchedInvestorName = "";
      let matchedClientCode = "";

      if (fingerprintSnapshot.exists) {
        matchStatus = PORTFOLIO_MATCH_STATUS.DUPLICATE;
        const duplicateInvestorId = fingerprintSnapshot.data()?.investorId || existingMapping?.investorId || "";
        const duplicateInvestor = investors.find((item) => item.id === duplicateInvestorId);
        if (duplicateInvestor) {
          matchedInvestorId = duplicateInvestor.id;
          matchedInvestorName = investorName(duplicateInvestor);
          matchedClientCode = duplicateInvestor.clientCode || "";
        }
      } else if (mappingConflict || panProfileConflict || brokerCodeConflict || strongProfileConflict || profileMappingConflict) {
        matchStatus = PORTFOLIO_MATCH_STATUS.CONFLICT;
      } else if (existingMapping && accessibleMappedInvestor) {
        matchStatus = PORTFOLIO_MATCH_STATUS.VERIFIED;
        matchedInvestorId = accessibleMappedInvestor.id;
        matchedInvestorName = investorName(accessibleMappedInvestor);
        matchedClientCode = accessibleMappedInvestor.clientCode || "";
      } else if (existingMapping && !accessibleMappedInvestor) {
        matchStatus = PORTFOLIO_MATCH_STATUS.CONFLICT;
      } else if (strongProfileInvestor) {
        matchStatus = PORTFOLIO_MATCH_STATUS.VERIFIED;
        matchedInvestorId = strongProfileInvestor.id;
        matchedInvestorName = investorName(strongProfileInvestor);
        matchedClientCode = strongProfileInvestor.clientCode || "";
      } else if (suggestions[0]?.exact) {
        matchStatus = PORTFOLIO_MATCH_STATUS.REVIEW;
        matchedInvestorId = suggestions[0].investorId;
        matchedInvestorName = suggestions[0].fullName;
        matchedClientCode = suggestions[0].clientCode;
      } else if (suggestions.length) {
        matchStatus = PORTFOLIO_MATCH_STATUS.REVIEW;
      }

      const fileRecord = {
        batchId: batchRef.id,
        uploadIndex: index,
        source: detected.source,
        reportType: detected.reportType,
        adapterStatus: detected.adapterStatus,
        confidence: Number(detected.confidence || 0),
        advisorUid: actor.uid,
        createdByUid: actor.uid,
        createdByName: actor.fullName || actor.email || "GrowVest User",
        fileName: detected.fileName,
        fileSize: detected.fileSize,
        fileFormat: detected.fileFormat || "",
        sheetName: detected.sheetName,
        fileFingerprint: detected.fileFingerprint,
        externalClientName: detected.externalClientName,
        normalizedExternalClientName: detected.normalizedExternalClientName,
        externalPan: detected.externalPan || "",
        externalClientCode: detected.externalClientCode || "",
        warnings: detected.warnings || [],
        reportPeriodStart: detected.reportPeriodStart || "",
        reportPeriodEnd: detected.reportPeriodEnd || "",
        matchStatus,
        matchedInvestorId,
        matchedInvestorName,
        matchedClientCode,
        suggestions,
        summary: detected.summary,
        holdings: detected.holdings,
        policies: detected.policies || [],
        transactions: detected.transactions,
        genericMapping: detected.genericMapping || null,
        mappingProfileId: detected.mappingProfileId || "",
        completeSnapshot: detected.completeSnapshot === true,
        trades: detected.trades || [],
        duplicateOfImportId: fingerprintSnapshot.exists ? fingerprintSnapshot.data()?.batchId || "" : "",
        duplicateImportedAt: fingerprintSnapshot.exists ? fingerprintSnapshot.data()?.importedAt || null : null,
        status: matchStatus === PORTFOLIO_MATCH_STATUS.DUPLICATE ? "duplicate" : "previewed",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      writer.set(fileRef, fileRecord);
      fileResults.push(publicFileResult(fileRef, detected, { uploadIndex: index, matchStatus, matchedInvestorId, matchedInvestorName, matchedClientCode, suggestions, duplicateOfImportId: fileRecord.duplicateOfImportId }));
    }

    const counts = fileResults.reduce((total, item) => {
      const key = item.matchStatus || "unknown";
      total[key] = (total[key] || 0) + 1;
      return total;
    }, {});
    const sourceCounts = fileResults.reduce((total, item) => {
      const key = item.source || PORTFOLIO_SOURCES.MANUAL;
      total[key] = (total[key] || 0) + 1;
      return total;
    }, {});
    const readyCount = fileResults.filter((item) => item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.READY && ![PORTFOLIO_MATCH_STATUS.DUPLICATE, PORTFOLIO_MATCH_STATUS.CONFLICT].includes(item.matchStatus)).length;
    const issueCount = fileResults.length - readyCount - Number(counts[PORTFOLIO_MATCH_STATUS.DUPLICATE] || 0);

    writer.set(batchRef, {
      source: Object.keys(sourceCounts).length > 1 ? PORTFOLIO_SOURCES.MIXED : Object.keys(sourceCounts)[0] || PORTFOLIO_SOURCES.MANUAL,
      importMode: "unified_daily",
      status: PORTFOLIO_IMPORT_STATUS.AWAITING_REVIEW,
      advisorUid: actor.uid,
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      fileCount: files.length,
      fileIds,
      previewCounts: counts,
      sourceCounts,
      readyCount,
      previewIssueCount: issueCount,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await writer.close();

    return Response.json({ batchId: batchRef.id, files: fileResults, counts, sourceCounts, readyCount, issueCount, investorCount: investors.length });
  } catch (error) {
    console.error("Unified portfolio preview failed", error);
    return Response.json({ error: error?.message || "Unable to analyse portfolio reports." }, { status: appRequestErrorStatus(error, 500) });
  }
}
