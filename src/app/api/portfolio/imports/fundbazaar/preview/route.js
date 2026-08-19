import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_IMPORT_STATUS,
  PORTFOLIO_MATCH_STATUS,
  PORTFOLIO_MAX_FILES_PER_BATCH,
  PORTFOLIO_MAX_FILE_SIZE,
  PORTFOLIO_SOURCES
} from "@/lib/constants/portfolio";
import { normaliseExternalName, parseFundbazaarFile, stableHash } from "@/lib/server/portfolioImportParser";

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

function primaryExternalInvestorName(externalName = "") {
  const normalized = normaliseExternalName(externalName);
  if (!normalized) return "";
  const representativeMarkers = [" REP BY ", " REPRESENTED BY "];
  for (const marker of representativeMarkers) {
    const index = normalized.indexOf(marker);
    if (index > 0) {
      const primary = normalized.slice(0, index).trim();
      if (primary.split(" ").filter(Boolean).length >= 2) return primary;
    }
  }
  return normalized;
}

function buildSuggestions(externalName, investors = []) {
  const normalized = normaliseExternalName(externalName);
  const primaryName = primaryExternalInvestorName(externalName);
  if (!normalized) return [];
  return investors
    .map((investor) => {
      const investorNormalized = normaliseExternalName(investorName(investor));
      const exact = primaryName === investorNormalized || normalized === investorNormalized;
      const primaryTokenScore = tokenSimilarity(primaryName, investorNormalized);
      const fullTokenScore = tokenSimilarity(normalized, investorNormalized);
      const primaryContainment = primaryName.includes(investorNormalized) || investorNormalized.includes(primaryName) ? 0.12 : 0;
      const fullContainment = normalized.includes(investorNormalized) || investorNormalized.includes(normalized) ? 0.06 : 0;
      const primaryScore = primaryTokenScore + primaryContainment;
      const fullScore = fullTokenScore + fullContainment;
      const score = exact ? 1 : Math.min(0.99, Math.max(primaryScore, fullScore));
      return {
        investorId: investor.id,
        clientCode: investor.clientCode || "",
        fullName: investorName(investor),
        score: Number(score.toFixed(2)),
        exact
      };
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

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item) => item && typeof item.arrayBuffer === "function");
    if (!files.length) return Response.json({ error: "Select at least one Fundbazaar report." }, { status: 400 });
    if (files.length > PORTFOLIO_MAX_FILES_PER_BATCH) {
      return Response.json({ error: `Upload up to ${PORTFOLIO_MAX_FILES_PER_BATCH} files in one batch.` }, { status: 400 });
    }

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

      try {
        const parsed = await parseFundbazaarFile(file);
        const fingerprintRef = adminDb.collection("portfolioFileFingerprints").doc(parsed.fileFingerprint);
        const fingerprintSnapshot = await fingerprintRef.get();
        const mappingId = `${PORTFOLIO_SOURCES.FUNDBAZAAR}_${stableHash(parsed.normalizedExternalClientName, 32)}`;
        const mappingSnapshot = await adminDb.collection("externalInvestorMappings").doc(mappingId).get();
        const existingMapping = mappingSnapshot.exists ? mappingSnapshot.data() : null;
        const suggestions = buildSuggestions(parsed.externalClientName, investors);
        const accessibleMappedInvestor = existingMapping
          ? investors.find((item) => item.id === existingMapping.investorId)
          : null;

        let matchStatus = PORTFOLIO_MATCH_STATUS.UNMATCHED;
        let matchedInvestorId = "";
        let matchedInvestorName = "";
        let matchedClientCode = "";

        if (fingerprintSnapshot.exists) {
          matchStatus = PORTFOLIO_MATCH_STATUS.DUPLICATE;
        } else if (existingMapping && accessibleMappedInvestor) {
          matchStatus = PORTFOLIO_MATCH_STATUS.VERIFIED;
          matchedInvestorId = accessibleMappedInvestor.id;
          matchedInvestorName = investorName(accessibleMappedInvestor);
          matchedClientCode = accessibleMappedInvestor.clientCode || "";
        } else if (existingMapping && !accessibleMappedInvestor) {
          matchStatus = PORTFOLIO_MATCH_STATUS.CONFLICT;
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
          source: PORTFOLIO_SOURCES.FUNDBAZAAR,
          advisorUid: actor.uid,
          createdByUid: actor.uid,
          createdByName: actor.fullName || actor.email || "GrowVest User",
          fileName: parsed.fileName,
          fileSize: parsed.fileSize,
          sheetName: parsed.sheetName,
          fileFingerprint: parsed.fileFingerprint,
          externalClientName: parsed.externalClientName,
          normalizedExternalClientName: parsed.normalizedExternalClientName,
          matchStatus,
          matchedInvestorId,
          matchedInvestorName,
          matchedClientCode,
          suggestions,
          summary: parsed.summary,
          holdings: parsed.holdings,
          transactions: parsed.transactions,
          duplicateOfImportId: fingerprintSnapshot.exists ? fingerprintSnapshot.data()?.batchId || "" : "",
          duplicateImportedAt: fingerprintSnapshot.exists ? fingerprintSnapshot.data()?.importedAt || null : null,
          status: matchStatus === PORTFOLIO_MATCH_STATUS.DUPLICATE ? "duplicate" : "previewed",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };
        writer.set(fileRef, fileRecord);

        fileResults.push({
          fileId: fileRef.id,
          fileName: parsed.fileName,
          externalClientName: parsed.externalClientName,
          matchStatus,
          matchedInvestorId,
          matchedInvestorName,
          matchedClientCode,
          suggestions,
          summary: parsed.summary,
          duplicateOfImportId: fileRecord.duplicateOfImportId
        });
      } catch (error) {
        const message = error?.message || "Unable to parse this Fundbazaar report.";
        writer.set(fileRef, {
          batchId: batchRef.id,
          source: PORTFOLIO_SOURCES.FUNDBAZAAR,
          advisorUid: actor.uid,
          createdByUid: actor.uid,
          fileName: file.name,
          fileSize: file.size,
          matchStatus: PORTFOLIO_MATCH_STATUS.UNMATCHED,
          status: "failed",
          parseError: message,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        fileResults.push({ fileId: fileRef.id, fileName: file.name, matchStatus: "failed", error: message, suggestions: [] });
      }
    }

    const counts = fileResults.reduce((total, item) => {
      const key = item.matchStatus || "failed";
      total[key] = (total[key] || 0) + 1;
      return total;
    }, {});

    writer.set(batchRef, {
      source: PORTFOLIO_SOURCES.FUNDBAZAAR,
      status: PORTFOLIO_IMPORT_STATUS.AWAITING_REVIEW,
      advisorUid: actor.uid,
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      fileCount: files.length,
      fileIds,
      previewCounts: counts,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await writer.close();

    return Response.json({
      batchId: batchRef.id,
      files: fileResults,
      counts,
      investorCount: investors.length
    });
  } catch (error) {
    console.error("Fundbazaar preview failed", error);
    return Response.json({ error: error?.message || "Unable to preview Fundbazaar reports." }, { status: appRequestErrorStatus(error, 500) });
  }
}
