import * as XLSX from "xlsx";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, AppRequestError } from "@/lib/server/firebaseAdmin";
import {
  DEFAULT_INSURANCE_REMINDER_DAYS,
  INSURANCE_POLICY_STATUSES,
  INSURANCE_PREMIUM_FREQUENCIES,
  INSURANCE_TYPES,
  insuranceCoverageSummary,
  insurancePolicyOperationalStatus,
  insurancePolicyReportRow,
  insuranceReminderOffsets
} from "@/lib/constants/insurance";

export function cleanInsuranceText(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

export function insuranceActorName(actor = {}) {
  return actor.fullName || actor.displayName || actor.email || (actor.role === "investor" ? "Investor" : "GrowVest User");
}

export function insuranceAdvisorUid(investor = {}) {
  return investor.assignedAdvisorUid || investor.advisorUid || "";
}

export function insurancePortalUid(investor = {}) {
  return investor.investorPortalUid || investor.portalUid || null;
}

export async function getAccessibleInsuranceInvestor(actor, requestedInvestorId = "") {
  const investorId = actor.role === "investor" ? cleanInsuranceText(actor.investorId, 180) : cleanInsuranceText(requestedInvestorId, 180);
  if (!investorId) throw new AppRequestError("Investor is required.", 400, "insurance_investor_required");
  const snapshot = await adminDb.collection("investors").doc(investorId).get();
  if (!snapshot.exists) throw new AppRequestError("Investor profile was not found.", 404, "insurance_investor_missing");
  const investor = { id: snapshot.id, ...snapshot.data() };

  if (actor.role === "investor") {
    if (actor.portalEnabled === false || actor.investorId !== investorId) throw new AppRequestError("You are not authorised to view this insurance record.", 403, "insurance_access_denied");
    return investor;
  }
  if (["super_admin", "admin"].includes(actor.role)) return investor;
  if (actor.role === "advisor" && insuranceAdvisorUid(investor) === actor.uid) return investor;
  throw new AppRequestError("You are not authorised to manage insurance for this investor.", 403, "insurance_access_denied");
}

function validDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normaliseInsuranceDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && validDateParts(parsed.y, parsed.m, parsed.d)) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = cleanInsuranceText(value, 80);
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const year = Number(iso[1]); const month = Number(iso[2]); const day = Number(iso[3]);
    if (validDateParts(year, month, day)) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const day = Number(dmy[1]); const month = Number(dmy[2]); const year = Number(dmy[3]);
    if (validDateParts(year, month, day)) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  return "";
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value, fallback = true) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["yes", "y", "true", "1", "enabled", "on"].includes(text)) return true;
  if (["no", "n", "false", "0", "disabled", "off"].includes(text)) return false;
  return fallback;
}

function validInsuranceType(value) {
  const text = cleanInsuranceText(value, 80);
  const exact = INSURANCE_TYPES.find((item) => item.toLowerCase() === text.toLowerCase());
  return exact || "Other";
}

function validPolicyStatus(value) {
  const text = cleanInsuranceText(value, 80);
  const exact = INSURANCE_POLICY_STATUSES.find((item) => item.toLowerCase() === text.toLowerCase());
  return exact || "Active";
}

function validPremiumFrequency(value) {
  const text = cleanInsuranceText(value, 80);
  const exact = INSURANCE_PREMIUM_FREQUENCIES.find((item) => item.toLowerCase() === text.toLowerCase());
  return exact || (text || "Annual");
}

export function normaliseInsurancePayload(payload = {}, { actor = {}, investor = {}, existing = null, source = "manual" } = {}) {
  const insuranceType = validInsuranceType(payload.insuranceType);
  const policyNumber = cleanInsuranceText(payload.policyNumber, 160);
  const insurer = cleanInsuranceText(payload.insurer, 200);
  const productName = cleanInsuranceText(payload.productName || payload.planName, 240);
  const policyHolder = cleanInsuranceText(payload.policyHolder, 200);
  const insuredSubject = cleanInsuranceText(payload.insuredSubject || payload.insuredPersonAsset, 300);
  if (!policyNumber) throw new Error("Policy number is required.");
  if (!insurer) throw new Error("Insurer is required.");
  if (!productName) throw new Error("Product / plan name is required.");
  if (!policyHolder) throw new Error("Policy holder is required.");
  if (!insuredSubject) throw new Error("Insured person / asset is required.");

  const actorName = insuranceActorName(actor);
  const reminderDays = insuranceReminderOffsets(payload.reminderDays || payload.reminderOffsets || DEFAULT_INSURANCE_REMINDER_DAYS);
  const now = FieldValue.serverTimestamp();
  const advisorUid = insuranceAdvisorUid(investor);
  const investorPortalUid = insurancePortalUid(investor);

  const record = {
    investorId: investor.id,
    investorName: investor.fullName || investor.name || "Investor",
    clientCode: investor.clientCode || "",
    advisorUid,
    assignedAdvisorUid: advisorUid,
    investorPortalUid,
    insuranceType,
    productName,
    insurer,
    policyNumber,
    policyHolder,
    insuredSubject,
    relationshipAssetDetail: cleanInsuranceText(payload.relationshipAssetDetail, 500),
    coverVariant: cleanInsuranceText(payload.coverVariant, 120),
    policyStartDate: normaliseInsuranceDate(payload.policyStartDate),
    policyExpiryDate: normaliseInsuranceDate(payload.policyExpiryDate || payload.renewalDate),
    coverAmount: Math.max(0, numberValue(payload.coverAmount ?? payload.sumInsured)),
    premiumAmount: Math.max(0, numberValue(payload.premiumAmount)),
    premiumFrequency: validPremiumFrequency(payload.premiumFrequency),
    nextPremiumDueDate: normaliseInsuranceDate(payload.nextPremiumDueDate),
    policyStatus: validPolicyStatus(payload.policyStatus || payload.status),
    nominee: cleanInsuranceText(payload.nominee, 200),
    nomineeRelationship: cleanInsuranceText(payload.nomineeRelationship, 120),
    policyTermYears: Math.max(0, numberValue(payload.policyTermYears)),
    premiumPaymentTermYears: Math.max(0, numberValue(payload.premiumPaymentTermYears)),
    vehicleRegistrationNo: cleanInsuranceText(payload.vehicleRegistrationNo, 80).toUpperCase(),
    vehicleMakeModel: cleanInsuranceText(payload.vehicleMakeModel, 240),
    idv: Math.max(0, numberValue(payload.idv)),
    ownDamageExpiry: normaliseInsuranceDate(payload.ownDamageExpiry),
    thirdPartyExpiry: normaliseInsuranceDate(payload.thirdPartyExpiry),
    propertyAssetDetails: cleanInsuranceText(payload.propertyAssetDetails || payload.propertyAddress, 1200),
    healthMembers: cleanInsuranceText(payload.healthMembers || payload.healthFloaterDetails, 1200),
    ridersAddOns: cleanInsuranceText(payload.ridersAddOns, 1200),
    advisorBroker: cleanInsuranceText(payload.advisorBroker, 240),
    reminderDays,
    autoReminder: payload.autoReminder === undefined ? true : booleanValue(payload.autoReminder, true),
    notes: cleanInsuranceText(payload.notes, 3000),
    source: cleanInsuranceText(payload.source || source, 80) || source,
    sourceFileName: cleanInsuranceText(payload.sourceFileName, 260),
    renewalSequence: Math.max(1, Number(payload.renewalSequence || existing?.renewalSequence || 1)),
    previousPolicyId: cleanInsuranceText(payload.previousPolicyId || existing?.previousPolicyId, 180),
    renewedFromPolicyId: cleanInsuranceText(payload.renewedFromPolicyId || existing?.renewedFromPolicyId, 180),
    renewedToPolicyId: cleanInsuranceText(payload.renewedToPolicyId || existing?.renewedToPolicyId, 180),
    investorVisible: payload.investorVisible !== false,
    updatedAt: now,
    updatedByUid: actor.uid,
    updatedByName: actorName
  };
  if (!existing) {
    record.createdAt = now;
    record.createdByUid = actor.uid;
    record.createdByName = actorName;
  }
  return record;
}

export function insurancePolicyIdentity(record = {}) {
  return `${String(record.insurer || "").trim().toLowerCase()}|${String(record.policyNumber || "").trim().toLowerCase()}`;
}

export function insuranceEventPayload({ policyId, policy = {}, actor = {}, eventType, note = "", fromStatus = "", toStatus = "", metadata = {} }) {
  return {
    policyId,
    investorId: policy.investorId || "",
    investorName: policy.investorName || "",
    advisorUid: policy.advisorUid || policy.assignedAdvisorUid || "",
    investorPortalUid: policy.investorPortalUid || null,
    eventType: cleanInsuranceText(eventType, 100),
    note: cleanInsuranceText(note, 3000),
    fromStatus: cleanInsuranceText(fromStatus, 80),
    toStatus: cleanInsuranceText(toStatus, 80),
    metadata,
    investorVisible: true,
    createdByUid: actor.uid || "system",
    createdByRole: actor.role || "system",
    createdByName: insuranceActorName(actor),
    createdAt: FieldValue.serverTimestamp()
  };
}

export function insuranceNotification({ recipientUid, recipientType, title, message, investorId, policyId, actorUid = "system", link = "" }) {
  if (!recipientUid) return null;
  return {
    recipientUid,
    recipientType,
    title: cleanInsuranceText(title, 220),
    message: cleanInsuranceText(message, 1200),
    eventType: "insurance_policy_update",
    link: link || (recipientType === "investor" ? "/investor/insurance" : "/insurance"),
    investorId,
    insurancePolicyId: policyId,
    status: "unread",
    createdByUid: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    readAt: null
  };
}

const COLUMN_MAP = {
  "insurance type": "insuranceType",
  "product / plan name": "productName",
  insurer: "insurer",
  "policy number": "policyNumber",
  "policy holder": "policyHolder",
  "insured person / asset": "insuredSubject",
  "relationship / asset detail": "relationshipAssetDetail",
  "cover type / variant": "coverVariant",
  "policy start date": "policyStartDate",
  "policy expiry / renewal date": "policyExpiryDate",
  "sum insured / cover amount (₹)": "coverAmount",
  "sum insured / cover amount": "coverAmount",
  "premium amount (₹)": "premiumAmount",
  "premium amount": "premiumAmount",
  "premium frequency": "premiumFrequency",
  "next premium due date": "nextPremiumDueDate",
  "policy status": "policyStatus",
  "nominee / beneficiary": "nominee",
  "nominee relationship": "nomineeRelationship",
  "policy term (years)": "policyTermYears",
  "premium payment term (years)": "premiumPaymentTermYears",
  "vehicle registration no.": "vehicleRegistrationNo",
  "vehicle registration no": "vehicleRegistrationNo",
  "vehicle make / model": "vehicleMakeModel",
  "idv (₹)": "idv",
  idv: "idv",
  "own damage expiry": "ownDamageExpiry",
  "third party expiry": "thirdPartyExpiry",
  "property address / asset details": "propertyAssetDetails",
  "health members / floater details": "healthMembers",
  "riders / add-ons": "ridersAddOns",
  "advisor / broker": "advisorBroker",
  "reminder days before due / expiry": "reminderDays",
  "auto reminder": "autoReminder",
  notes: "notes"
};

function normaliseHeader(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function locateInsuranceSheet(workbook) {
  const preferred = workbook.SheetNames.find((name) => normaliseHeader(name) === "insurance policies");
  if (preferred) return workbook.Sheets[preferred];
  return workbook.Sheets[workbook.SheetNames[0]];
}

function locateHeaderRow(matrix = []) {
  for (let index = 0; index < Math.min(matrix.length, 30); index += 1) {
    const headers = (matrix[index] || []).map(normaliseHeader);
    if (headers.includes("insurance type") && headers.includes("policy number") && headers.includes("insurer")) return index;
  }
  return -1;
}

export function parseInsuranceWorkbook(buffer, fileName = "") {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheet = locateInsuranceSheet(workbook);
  if (!sheet) throw new Error("The workbook does not contain an Insurance Policies sheet.");
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const headerIndex = locateHeaderRow(matrix);
  if (headerIndex < 0) throw new Error("Insurance template headers were not found. Download the latest GrowVest Insurance template and try again.");
  const headers = (matrix[headerIndex] || []).map((value) => COLUMN_MAP[normaliseHeader(value)] || "");
  const rows = [];
  const errors = [];
  const warnings = [];

  matrix.slice(headerIndex + 1).forEach((cells, offset) => {
    const rowNumber = headerIndex + offset + 2;
    if (!(cells || []).some((value) => String(value ?? "").trim())) return;
    const raw = {};
    headers.forEach((key, index) => { if (key) raw[key] = cells[index]; });
    const policy = {
      ...raw,
      insuranceType: validInsuranceType(raw.insuranceType),
      productName: cleanInsuranceText(raw.productName, 240),
      insurer: cleanInsuranceText(raw.insurer, 200),
      policyNumber: cleanInsuranceText(raw.policyNumber, 160),
      policyHolder: cleanInsuranceText(raw.policyHolder, 200),
      insuredSubject: cleanInsuranceText(raw.insuredSubject, 300),
      relationshipAssetDetail: cleanInsuranceText(raw.relationshipAssetDetail, 500),
      coverVariant: cleanInsuranceText(raw.coverVariant, 120),
      policyStartDate: normaliseInsuranceDate(raw.policyStartDate),
      policyExpiryDate: normaliseInsuranceDate(raw.policyExpiryDate),
      coverAmount: Math.max(0, numberValue(raw.coverAmount)),
      premiumAmount: Math.max(0, numberValue(raw.premiumAmount)),
      premiumFrequency: validPremiumFrequency(raw.premiumFrequency),
      nextPremiumDueDate: normaliseInsuranceDate(raw.nextPremiumDueDate),
      policyStatus: validPolicyStatus(raw.policyStatus),
      nominee: cleanInsuranceText(raw.nominee, 200),
      nomineeRelationship: cleanInsuranceText(raw.nomineeRelationship, 120),
      policyTermYears: Math.max(0, numberValue(raw.policyTermYears)),
      premiumPaymentTermYears: Math.max(0, numberValue(raw.premiumPaymentTermYears)),
      vehicleRegistrationNo: cleanInsuranceText(raw.vehicleRegistrationNo, 80).toUpperCase(),
      vehicleMakeModel: cleanInsuranceText(raw.vehicleMakeModel, 240),
      idv: Math.max(0, numberValue(raw.idv)),
      ownDamageExpiry: normaliseInsuranceDate(raw.ownDamageExpiry),
      thirdPartyExpiry: normaliseInsuranceDate(raw.thirdPartyExpiry),
      propertyAssetDetails: cleanInsuranceText(raw.propertyAssetDetails, 1200),
      healthMembers: cleanInsuranceText(raw.healthMembers, 1200),
      ridersAddOns: cleanInsuranceText(raw.ridersAddOns, 1200),
      advisorBroker: cleanInsuranceText(raw.advisorBroker, 240),
      reminderDays: insuranceReminderOffsets(raw.reminderDays),
      autoReminder: booleanValue(raw.autoReminder, true),
      notes: cleanInsuranceText(raw.notes, 3000),
      source: "insurance_excel",
      sourceFileName: cleanInsuranceText(fileName, 260)
    };
    const rowErrors = [];
    if (!cleanInsuranceText(raw.insuranceType, 80)) rowErrors.push("Insurance Type is required");
    if (!policy.productName) rowErrors.push("Product / Plan Name is required");
    if (!policy.insurer) rowErrors.push("Insurer is required");
    if (!policy.policyNumber) rowErrors.push("Policy Number is required");
    if (!policy.policyHolder) rowErrors.push("Policy Holder is required");
    if (!policy.insuredSubject) rowErrors.push("Insured Person / Asset is required");
    if (!policy.policyExpiryDate && !policy.nextPremiumDueDate && !policy.ownDamageExpiry && !policy.thirdPartyExpiry) warnings.push({ rowNumber, message: "No renewal, premium or motor expiry date is available for reminders." });
    if (!(policy.coverAmount > 0) && !(policy.idv > 0)) warnings.push({ rowNumber, message: "Cover amount / IDV is zero or missing." });
    if (policy.insuranceType === "Vehicle" && !policy.vehicleRegistrationNo) warnings.push({ rowNumber, message: "Vehicle Registration No. is recommended for Vehicle insurance." });
    if (policy.insuranceType === "Home" && !policy.propertyAssetDetails) warnings.push({ rowNumber, message: "Property address / asset details are recommended for Home insurance." });
    if (policy.insuranceType === "Health" && !policy.healthMembers) warnings.push({ rowNumber, message: "Health members / floater details are recommended for Health insurance." });
    if (rowErrors.length) {
      errors.push({ rowNumber, message: rowErrors.join("; ") });
      return;
    }
    rows.push({ rowNumber, ...policy });
  });

  const duplicates = new Map();
  rows.forEach((row) => {
    const key = insurancePolicyIdentity(row);
    duplicates.set(key, (duplicates.get(key) || 0) + 1);
  });
  duplicates.forEach((count, key) => {
    if (count > 1) errors.push({ rowNumber: null, message: `Duplicate insurer + policy number appears ${count} times (${key}).` });
  });

  return { rows, errors, warnings, sheetName: workbook.SheetNames.find((name) => workbook.Sheets[name] === sheet) || workbook.SheetNames[0] || "Insurance Policies" };
}

export async function loadInsurancePoliciesForInvestor(investorId) {
  const snapshot = await adminDb.collection("insurancePolicies").where("investorId", "==", investorId).get();
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function buildInsurancePortfolioOverview(actor = {}, asOfDate = "") {
  if (!["super_admin", "admin", "advisor"].includes(actor.role)) {
    throw new AppRequestError("This protection overview is available to GrowVest staff only.", 403, "insurance_staff_required");
  }

  const reference = asOfDate || new Date().toISOString().slice(0, 10);
  const investorSnapshot = await adminDb.collection("investors").get();
  const accessibleInvestors = investorSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((investor) => String(investor.status || "active").toLowerCase() !== "deleted")
    .filter((investor) => {
      if (["super_admin", "admin"].includes(actor.role)) return true;
      return insuranceAdvisorUid(investor) === actor.uid;
    });

  const investorMap = new Map(accessibleInvestors.map((investor) => [investor.id, investor]));
  const allPolicySnapshot = await adminDb.collection("insurancePolicies").get();
  const policies = allPolicySnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((policy) => investorMap.has(policy.investorId));

  const policiesByInvestor = new Map();
  policies.forEach((policy) => {
    if (!policiesByInvestor.has(policy.investorId)) policiesByInvestor.set(policy.investorId, []);
    policiesByInvestor.get(policy.investorId).push(policy);
  });

  const rows = accessibleInvestors.map((investor) => {
    const investorPolicies = policiesByInvestor.get(investor.id) || [];
    const snapshot = buildInsuranceProtectionSnapshot(investorPolicies, reference);
    const summary = snapshot.summary || {};
    return {
      investorId: investor.id,
      investorName: investor.fullName || investor.name || "Investor",
      clientCode: investor.clientCode || "",
      assignedAdvisorName: investor.assignedAdvisorName || "",
      activePolicyCount: Number(summary.activePolicyCount || 0),
      lifeCover: Number(summary.lifeCover || 0),
      healthCover: Number(summary.healthCover || 0),
      vehiclePolicyCount: Number(summary.vehiclePolicyCount || 0),
      homePolicyCount: Number(summary.homePolicyCount || 0),
      policiesExpiringWithin30Days: Number(summary.policiesExpiringWithin30Days || 0),
      premiumsDueWithin30Days: Number(summary.premiumsDueWithin30Days || 0),
      nextDue: summary.nextDue || null
    };
  }).filter((row) => row.activePolicyCount > 0 || row.lifeCover > 0 || row.healthCover > 0 || row.nextDue);

  const aggregateSnapshot = buildInsuranceProtectionSnapshot(policies, reference);
  const aggregateSummary = aggregateSnapshot.summary || {};
  const attentionItems = [];
  rows.forEach((row) => {
    const investorPolicies = policiesByInvestor.get(row.investorId) || [];
    const snapshot = buildInsuranceProtectionSnapshot(investorPolicies, reference);
    const summary = snapshot.summary || {};
    [...(summary.overdueDueItems || []), ...(summary.upcomingDueItems || [])].forEach((item) => {
      if (item.daysUntil !== null && item.daysUntil !== undefined && item.daysUntil <= 30) {
        attentionItems.push({
          ...item,
          investorId: row.investorId,
          investorName: row.investorName,
          clientCode: row.clientCode
        });
      }
    });
  });

  attentionItems.sort((left, right) => {
    const leftDays = Number(left.daysUntil ?? Number.MAX_SAFE_INTEGER);
    const rightDays = Number(right.daysUntil ?? Number.MAX_SAFE_INTEGER);
    return leftDays - rightDays || String(left.investorName).localeCompare(String(right.investorName));
  });

  rows.sort((left, right) => {
    const leftDays = left.nextDue?.daysUntil ?? Number.MAX_SAFE_INTEGER;
    const rightDays = right.nextDue?.daysUntil ?? Number.MAX_SAFE_INTEGER;
    return leftDays - rightDays || right.activePolicyCount - left.activePolicyCount || left.investorName.localeCompare(right.investorName);
  });

  return {
    asOfDate: reference,
    generatedAt: new Date().toISOString(),
    summary: {
      ...aggregateSummary,
      accessibleInvestorCount: accessibleInvestors.length,
      investorsWithProtection: rows.length,
      attentionItemCount: attentionItems.length
    },
    rows,
    attentionItems: attentionItems.slice(0, 30)
  };
}

export function buildInsuranceProtectionSnapshot(policies = [], asOfDate = "") {
  const reference = asOfDate || new Date().toISOString().slice(0, 10);
  const started = (policies || []).filter((policy) => !policy.policyStartDate || policy.policyStartDate <= reference);
  const rows = started.map((policy) => insurancePolicyReportRow(policy, reference));
  const activeRows = rows.filter((policy) => !["Expired", "Lapsed", "Cancelled", "Claimed / Closed", "Renewed"].includes(policy.policyStatus));
  const activeIds = new Set(activeRows.map((row) => row.id));
  const summary = insuranceCoverageSummary(started.filter((item) => activeIds.has(item.id)), reference);
  return {
    asOfDate: reference,
    generatedAt: new Date().toISOString(),
    summary,
    policies: activeRows.sort((a, b) => {
      const aDue = a.nextDueDays === null ? Number.MAX_SAFE_INTEGER : a.nextDueDays;
      const bDue = b.nextDueDays === null ? Number.MAX_SAFE_INTEGER : b.nextDueDays;
      return aDue - bDue || String(a.insuranceType).localeCompare(String(b.insuranceType));
    })
  };
}

export function policyOperationalStatus(policy, referenceDate = new Date()) {
  return insurancePolicyOperationalStatus(policy, referenceDate);
}


export function serialiseInsuranceRecord(record = {}) {
  const convert = (value) => {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(convert);
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, convert(item)]));
    return value;
  };
  return convert(record);
}
