import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_ADAPTER_STATUS,
  PORTFOLIO_MATCH_STATUS,
  PORTFOLIO_REPORT_TYPES,
  PORTFOLIO_SOURCES
} from "@/lib/constants/portfolio";
import { normaliseExternalName, parseGenericPortfolioFile, stableHash } from "@/lib/server/portfolioImportParser";
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

function externalMappingDescriptors(parsed = {}) {
  const source = PORTFOLIO_SOURCES.GROWVEST_STANDARD;
  const rows = [];
  if (parsed.normalizedExternalClientName) rows.push({ identityType: "client_name", id: `${source}_name_${stableHash(parsed.normalizedExternalClientName, 32)}` });
  if (parsed.externalPan) rows.push({ identityType: "pan", id: `${source}_pan_${stableHash(String(parsed.externalPan).toUpperCase(), 32)}` });
  if (parsed.externalClientCode) rows.push({ identityType: "client_code", id: `${source}_client_${stableHash(String(parsed.externalClientCode).toUpperCase(), 32)}` });
  return rows.filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index);
}

async function loadExternalMappings(parsed = {}) {
  const descriptors = externalMappingDescriptors(parsed);
  if (!descriptors.length) return [];
  const refs = descriptors.map((item) => adminDb.collection("externalInvestorMappings").doc(item.id));
  const snapshots = await adminDb.getAll(...refs);
  return descriptors.map((item, index) => ({ ...item, data: snapshots[index]?.exists ? snapshots[index].data() : null }));
}

function cleanConfig(value = {}) {
  const mapping = value?.mapping && typeof value.mapping === "object" ? value.mapping : {};
  const defaults = value?.defaults && typeof value.defaults === "object" ? value.defaults : {};
  const cleanObject = (object) => Object.fromEntries(Object.entries(object)
    .filter(([key, item]) => typeof key === "string" && ["string", "number", "boolean"].includes(typeof item))
    .map(([key, item]) => [key.slice(0, 80), typeof item === "string" ? item.slice(0, 240) : item]));
  return {
    sheetName: String(value?.sheetName || "").slice(0, 120),
    rowMode: value?.rowMode === "transactions" ? "transactions" : "holdings",
    mapping: cleanObject(mapping),
    defaults: cleanObject(defaults),
    completeSnapshot: value?.completeSnapshot === true
  };
}

function publicFile(fileId, parsed, extra = {}) {
  return {
    fileId,
    fileName: parsed.fileName || "",
    fileSize: Number(parsed.fileSize || 0),
    fileFormat: parsed.fileFormat || "",
    source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
    reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
    adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
    confidence: Number(parsed.confidence || 0.95),
    sheetName: parsed.sheetName || "",
    externalClientName: parsed.externalClientName || "",
    externalPan: parsed.externalPan || "",
    externalClientCode: parsed.externalClientCode || "",
    warnings: parsed.warnings || [],
    reportPeriodStart: parsed.reportPeriodStart || "",
    reportPeriodEnd: parsed.reportPeriodEnd || "",
    summary: parsed.summary || null,
    policies: parsed.policies || [],
    genericMapping: parsed.genericMapping || null,
    mappingProfileId: parsed.mappingProfileId || "",
    completeSnapshot: parsed.completeSnapshot === true,
    error: "",
    ...extra
  };
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const formData = await request.formData();
    const batchId = String(formData.get("batchId") || "");
    const fileId = String(formData.get("fileId") || "");
    const upload = formData.get("file");
    const rawConfig = JSON.parse(String(formData.get("config") || "{}"));
    const config = cleanConfig(rawConfig);
    const saveProfile = rawConfig?.saveProfile !== false;
    if (!batchId || !fileId || !upload || typeof upload.arrayBuffer !== "function") {
      return Response.json({ error: "Batch, file and column mapping are required." }, { status: 400 });
    }

    const [batchSnapshot, fileSnapshot] = await Promise.all([
      adminDb.collection("portfolioImports").doc(batchId).get(),
      adminDb.collection("portfolioImportFiles").doc(fileId).get()
    ]);
    if (!batchSnapshot.exists || !fileSnapshot.exists) return Response.json({ error: "Portfolio import preview was not found." }, { status: 404 });
    const batch = batchSnapshot.data();
    const currentFile = fileSnapshot.data();
    if (!Array.isArray(batch.fileIds) || !batch.fileIds.includes(fileId) || currentFile.batchId !== batchId) {
      return Response.json({ error: "This file does not belong to the selected portfolio import batch." }, { status: 400 });
    }
    if (batch.advisorUid !== actor.uid && !["super_admin", "admin"].includes(actor.role)) {
      return Response.json({ error: "You are not authorised to map this portfolio import." }, { status: 403 });
    }

    const buffer = Buffer.from(await upload.arrayBuffer());
    const fingerprint = crypto.createHash("sha256").update(buffer).digest("hex");
    if (currentFile.fileFingerprint && currentFile.fileFingerprint !== fingerprint) {
      return Response.json({ error: "The selected file is different from the file that was analysed. Re-run Analyse Files first." }, { status: 409 });
    }

    const parsed = await parseGenericPortfolioFile(upload, config);
    parsed.fileName = currentFile.fileName || upload.name || "";
    parsed.fileSize = currentFile.fileSize || upload.size || 0;
    parsed.fileFormat = currentFile.fileFormat || "";
    parsed.fileFingerprint = fingerprint;
    if (!parsed.holdings?.length && !parsed.transactions?.length) {
      return Response.json({ error: "No usable holdings or transactions were produced from this mapping." }, { status: 400 });
    }

    const profileSignature = currentFile.genericMapping?.headerSignature || parsed.genericMapping?.headerSignature || "";
    let mappingProfileId = "";
    if (saveProfile && profileSignature) {
      mappingProfileId = `gmap_${stableHash(`${profileSignature}|${normaliseExternalName(parsed.genericMapping?.sheetName || currentFile.genericMapping?.sheetName || parsed.sheetName || "")}`, 40)}`;
      const profileRef = adminDb.collection("portfolioImportMappingProfiles").doc(mappingProfileId);
      const existingProfileSnapshot = await profileRef.get();
      const existingProfile = existingProfileSnapshot.exists ? existingProfileSnapshot.data() : {};
      await profileRef.set({
        headerSignature: profileSignature,
        source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
        reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
        profileName: String(rawConfig?.profileName || config.defaults?.provider || parsed.holdings?.[0]?.provider || parsed.fileName || "Generic Portfolio Layout").slice(0, 120),
        config,
        headers: parsed.genericMapping?.headers || currentFile.genericMapping?.headers || [],
        active: true,
        createdByUid: actor.uid,
        createdByName: actor.fullName || actor.email || "GrowVest User",
        createdAt: existingProfile.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } else if (rawConfig?.existingMappingProfileId) {
      const existingProfileId = String(rawConfig.existingMappingProfileId || "");
      if (/^gmap_[a-f0-9]{40}$/i.test(existingProfileId)) {
        await adminDb.collection("portfolioImportMappingProfiles").doc(existingProfileId).set({
          active: false,
          disabledByUid: actor.uid,
          disabledByName: actor.fullName || actor.email || "GrowVest User",
          disabledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }
    parsed.mappingProfileId = mappingProfileId;

    const investors = await accessibleInvestors(actor);
    const [fingerprintSnapshot, mappingEntries] = await Promise.all([
      adminDb.collection("portfolioFileFingerprints").doc(fingerprint).get(),
      loadExternalMappings(parsed)
    ]);
    const mappingInvestorIds = new Set(mappingEntries.map((item) => item.data?.investorId).filter(Boolean));
    const existingMapping = mappingEntries.find((item) => item.data)?.data || null;
    const mappingConflict = mappingInvestorIds.size > 1;
    const mappedInvestor = existingMapping ? investors.find((item) => item.id === existingMapping.investorId) : null;
    const externalPan = normalisePan(parsed.externalPan || "");
    const panMatches = externalPan ? investors.filter((item) => normalisePan(item.panNumber || item.panNormalized || "") === externalPan) : [];
    const externalClientCode = String(parsed.externalClientCode || "").trim().toUpperCase();
    const codeMatches = externalClientCode ? investors.filter((item) => String(item.clientCode || "").trim().toUpperCase() === externalClientCode) : [];
    const strongIds = new Set([panMatches.length === 1 ? panMatches[0].id : "", codeMatches.length === 1 ? codeMatches[0].id : ""].filter(Boolean));
    const strongInvestor = panMatches.length === 1 ? panMatches[0] : codeMatches.length === 1 ? codeMatches[0] : null;
    const suggestions = buildSuggestions(parsed.externalClientName, investors);

    let matchStatus = PORTFOLIO_MATCH_STATUS.UNMATCHED;
    let matchedInvestorId = "";
    let matchedInvestorName = "";
    let matchedClientCode = "";
    if (fingerprintSnapshot.exists) {
      matchStatus = PORTFOLIO_MATCH_STATUS.DUPLICATE;
      const duplicateInvestor = investors.find((item) => item.id === (fingerprintSnapshot.data()?.investorId || existingMapping?.investorId || ""));
      if (duplicateInvestor) {
        matchedInvestorId = duplicateInvestor.id;
        matchedInvestorName = investorName(duplicateInvestor);
        matchedClientCode = duplicateInvestor.clientCode || "";
      }
    } else if (mappingConflict || panMatches.length > 1 || codeMatches.length > 1 || strongIds.size > 1 || (existingMapping && strongInvestor && existingMapping.investorId !== strongInvestor.id)) {
      matchStatus = PORTFOLIO_MATCH_STATUS.CONFLICT;
    } else if (mappedInvestor) {
      matchStatus = PORTFOLIO_MATCH_STATUS.VERIFIED;
      matchedInvestorId = mappedInvestor.id;
      matchedInvestorName = investorName(mappedInvestor);
      matchedClientCode = mappedInvestor.clientCode || "";
    } else if (existingMapping && !mappedInvestor) {
      matchStatus = PORTFOLIO_MATCH_STATUS.CONFLICT;
    } else if (strongInvestor) {
      matchStatus = PORTFOLIO_MATCH_STATUS.VERIFIED;
      matchedInvestorId = strongInvestor.id;
      matchedInvestorName = investorName(strongInvestor);
      matchedClientCode = strongInvestor.clientCode || "";
    } else if (suggestions[0]?.exact) {
      matchStatus = PORTFOLIO_MATCH_STATUS.REVIEW;
      matchedInvestorId = suggestions[0].investorId;
      matchedInvestorName = suggestions[0].fullName;
      matchedClientCode = suggestions[0].clientCode;
    } else if (suggestions.length) {
      matchStatus = PORTFOLIO_MATCH_STATUS.REVIEW;
    }

    const update = {
      source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
      reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
      adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
      confidence: Number(parsed.confidence || 0.95),
      sheetName: parsed.sheetName || "",
      externalClientName: parsed.externalClientName || "",
      normalizedExternalClientName: parsed.normalizedExternalClientName || "",
      externalPan: parsed.externalPan || "",
      externalClientCode: parsed.externalClientCode || "",
      reportPeriodStart: parsed.reportPeriodStart || "",
      reportPeriodEnd: parsed.reportPeriodEnd || "",
      summary: parsed.summary || null,
      holdings: parsed.holdings || [],
      transactions: parsed.transactions || [],
      trades: [],
      policies: [],
      genericMapping: parsed.genericMapping || currentFile.genericMapping || null,
      genericMappingConfig: config,
      mappingProfileId,
      completeSnapshot: config.completeSnapshot === true,
      matchStatus,
      matchedInvestorId,
      matchedInvestorName,
      matchedClientCode,
      suggestions,
      duplicateOfImportId: fingerprintSnapshot.exists ? fingerprintSnapshot.data()?.batchId || "" : "",
      duplicateImportedAt: fingerprintSnapshot.exists ? fingerprintSnapshot.data()?.importedAt || null : null,
      status: matchStatus === PORTFOLIO_MATCH_STATUS.DUPLICATE ? "duplicate" : "previewed",
      parseError: "",
      updatedAt: FieldValue.serverTimestamp()
    };
    await fileSnapshot.ref.set(update, { merge: true });

    const batchFiles = await adminDb.getAll(...batch.fileIds.map((id) => adminDb.collection("portfolioImportFiles").doc(id)));
    const normalizedFiles = batchFiles.filter((item) => item.exists).map((item) => item.id === fileId ? { id: item.id, ...item.data(), ...update } : { id: item.id, ...item.data() });
    const readyCount = normalizedFiles.filter((item) => item.adapterStatus === PORTFOLIO_ADAPTER_STATUS.READY && ![PORTFOLIO_MATCH_STATUS.DUPLICATE, PORTFOLIO_MATCH_STATUS.CONFLICT].includes(item.matchStatus)).length;
    const issueCount = normalizedFiles.length - readyCount - normalizedFiles.filter((item) => item.matchStatus === PORTFOLIO_MATCH_STATUS.DUPLICATE).length;
    await batchSnapshot.ref.set({ readyCount, previewIssueCount: issueCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    return Response.json(publicFile(fileId, { ...currentFile, ...parsed, mappingProfileId }, {
      uploadIndex: Number(currentFile.uploadIndex || 0),
      matchStatus,
      matchedInvestorId,
      matchedInvestorName,
      matchedClientCode,
      suggestions,
      duplicateOfImportId: update.duplicateOfImportId
    }));
  } catch (error) {
    console.error("Generic portfolio column mapping failed", error);
    return Response.json({ error: error?.message || "Unable to apply the portfolio column mapping." }, { status: appRequestErrorStatus(error, 500) });
  }
}
