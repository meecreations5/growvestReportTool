import { businessDateKey } from "@/lib/utils/date";

export const INSURANCE_TYPES = [
  "Term Life",
  "Whole Life",
  "Endowment",
  "ULIP Insurance",
  "Health",
  "Critical Illness",
  "Personal Accident",
  "Vehicle",
  "Home",
  "Travel",
  "Cyber",
  "Other"
];

export const INSURANCE_POLICY_STATUSES = [
  "Active",
  "Expiring Soon",
  "Grace Period",
  "Expired",
  "Lapsed",
  "Cancelled",
  "Claimed / Closed",
  "Renewed"
];

export const INSURANCE_PREMIUM_FREQUENCIES = [
  "Monthly",
  "Quarterly",
  "Half-Yearly",
  "Annual",
  "Single Premium",
  "Other"
];

export const INSURANCE_COVER_VARIANTS = [
  "Individual",
  "Family Floater",
  "Comprehensive",
  "Third Party",
  "Own Damage",
  "Building Only",
  "Contents Only",
  "Building + Contents",
  "Level Term",
  "Increasing Term",
  "Decreasing Term",
  "Other"
];

export const DEFAULT_INSURANCE_REMINDER_DAYS = [60, 30, 15, 7, 1];
export const INSURANCE_REMINDER_DAY_OPTIONS = [90, 60, 45, 30, 21, 15, 10, 7, 3, 1, 0];

export const LIFE_INSURANCE_TYPES = new Set(["Term Life", "Whole Life", "Endowment", "ULIP Insurance"]);
export const HEALTH_INSURANCE_TYPES = new Set(["Health", "Critical Illness"]);

export const INSURANCE_TYPE_TONES = {
  "Term Life": "blue",
  "Whole Life": "blue",
  Endowment: "blue",
  "ULIP Insurance": "violet",
  Health: "green",
  "Critical Illness": "amber",
  "Personal Accident": "amber",
  Vehicle: "cyan",
  Home: "violet",
  Travel: "cyan",
  Cyber: "slate",
  Other: "slate"
};

function parseDateOnly(value) {
  const text = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function referenceDateOnly(referenceDate = new Date()) {
  if (typeof referenceDate === "string") return parseDateOnly(referenceDate);
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(date.getTime())) return parseDateOnly(businessDateKey());
  return parseDateOnly(businessDateKey(date));
}

export function insuranceDaysUntil(value, referenceDate = new Date()) {
  const due = parseDateOnly(value);
  const reference = referenceDateOnly(referenceDate);
  if (!due || !reference) return null;
  return Math.round((due.getTime() - reference.getTime()) / 86400000);
}

export function insuranceDueDates(policy = {}) {
  const dates = [
    { kind: "premium", label: "Premium due", date: policy.nextPremiumDueDate || "" },
    { kind: "renewal", label: "Policy renewal / expiry", date: policy.policyExpiryDate || policy.renewalDate || "" }
  ];
  if (String(policy.insuranceType || "") === "Vehicle") {
    dates.push(
      { kind: "own_damage", label: "Own Damage expiry", date: policy.ownDamageExpiry || "" },
      { kind: "third_party", label: "Third Party expiry", date: policy.thirdPartyExpiry || "" }
    );
  }
  const seen = new Set();
  return dates.filter((item) => {
    if (!item.date) return false;
    const key = `${item.kind}:${String(item.date).slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function nearestInsuranceDue(policy = {}, referenceDate = new Date()) {
  const rows = insuranceDueDates(policy)
    .map((item) => ({ ...item, daysUntil: insuranceDaysUntil(item.date, referenceDate) }))
    .filter((item) => item.daysUntil !== null)
    .sort((a, b) => {
      const aOverdue = a.daysUntil < 0;
      const bOverdue = b.daysUntil < 0;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (aOverdue) {
        const priority = { premium: 0, renewal: 1, own_damage: 2, third_party: 3 };
        const kindCompare = Number(priority[a.kind] ?? 9) - Number(priority[b.kind] ?? 9);
        if (kindCompare) return kindCompare;
        return b.daysUntil - a.daysUntil;
      }
      return a.daysUntil - b.daysUntil;
    });
  return rows[0] || null;
}

export function insurancePolicyOperationalStatus(policy = {}, referenceDate = new Date()) {
  const stored = String(policy.policyStatus || policy.status || "Active");
  if (["Cancelled", "Claimed / Closed", "Renewed", "Lapsed"].includes(stored)) return stored;
  const expiryDays = insuranceDaysUntil(policy.policyExpiryDate || policy.renewalDate, referenceDate);
  if (expiryDays !== null && expiryDays < 0) return "Expired";
  const due = nearestInsuranceDue(policy, referenceDate);
  if (due && due.daysUntil < 0) return due.kind === "premium" ? "Premium Due" : "Expired";
  if (due && due.daysUntil <= 30) return "Expiring Soon";
  if (stored === "Grace Period") return "Grace Period";
  return stored || "Active";
}

export function insuranceStatusTone(status = "") {
  const value = String(status);
  if (["Active"].includes(value)) return "green";
  if (["Expiring Soon", "Premium Due", "Grace Period"].includes(value)) return "amber";
  if (["Expired", "Lapsed", "Cancelled"].includes(value)) return "red";
  if (["Renewed", "Claimed / Closed"].includes(value)) return "slate";
  return "slate";
}

export function insuranceReminderOffsets(value) {
  const rows = Array.isArray(value) ? value : String(value || "").split(/[;,|]/g);
  const parsed = rows
    .map((item) => Number(String(item).trim()))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 365)
    .map((item) => Math.round(item));
  return [...new Set(parsed.length ? parsed : DEFAULT_INSURANCE_REMINDER_DAYS)].sort((a, b) => b - a);
}

export function insuranceCoverageSummary(policies = [], referenceDate = new Date()) {
  const active = (policies || []).filter((policy) => !["Cancelled", "Claimed / Closed", "Renewed", "Lapsed", "Expired"].includes(insurancePolicyOperationalStatus(policy, referenceDate)));
  const sumBy = (predicate) => active.reduce((sum, item) => predicate(item) ? sum + Math.max(0, Number(item.coverAmount || item.sumInsured || 0)) : sum, 0);
  const dueRows = active.flatMap((policy) => insuranceDueDates(policy).map((due) => ({
    policyId: policy.id || "",
    policyNumber: policy.policyNumber || "",
    insuranceType: policy.insuranceType || "Other",
    productName: policy.productName || policy.planName || "Insurance Policy",
    insurer: policy.insurer || "",
    ...due,
    daysUntil: insuranceDaysUntil(due.date, referenceDate)
  }))).filter((item) => item.daysUntil !== null);
  const upcoming = dueRows.filter((item) => item.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil);
  const overdue = dueRows.filter((item) => item.daysUntil < 0).sort((a, b) => b.daysUntil - a.daysUntil);
  return {
    activePolicyCount: active.length,
    totalPolicyCount: (policies || []).length,
    lifeCover: sumBy((item) => LIFE_INSURANCE_TYPES.has(String(item.insuranceType || ""))),
    healthCover: sumBy((item) => HEALTH_INSURANCE_TYPES.has(String(item.insuranceType || ""))),
    vehiclePolicyCount: active.filter((item) => item.insuranceType === "Vehicle").length,
    homePolicyCount: active.filter((item) => item.insuranceType === "Home").length,
    policiesExpiringWithin30Days: active.filter((item) => {
      const days = insuranceDaysUntil(item.policyExpiryDate || item.renewalDate, referenceDate);
      return days !== null && days >= 0 && days <= 30;
    }).length,
    premiumsDueWithin30Days: active.filter((item) => {
      const days = insuranceDaysUntil(item.nextPremiumDueDate, referenceDate);
      return days !== null && days >= 0 && days <= 30;
    }).length,
    nextDue: overdue[0] || upcoming[0] || null,
    upcomingDueItems: upcoming.slice(0, 12),
    overdueDueItems: overdue.slice(0, 12)
  };
}

export function insurancePolicyReportRow(policy = {}, referenceDate = new Date()) {
  const due = nearestInsuranceDue(policy, referenceDate);
  return {
    id: policy.id || "",
    insuranceType: policy.insuranceType || "Other",
    productName: policy.productName || policy.planName || "Insurance Policy",
    insurer: policy.insurer || "",
    policyNumber: policy.policyNumber || "",
    policyHolder: policy.policyHolder || "",
    insuredSubject: policy.insuredSubject || "",
    coverAmount: Number(policy.coverAmount || policy.sumInsured || 0),
    premiumAmount: Number(policy.premiumAmount || 0),
    premiumFrequency: policy.premiumFrequency || "",
    policyExpiryDate: policy.policyExpiryDate || "",
    nextPremiumDueDate: policy.nextPremiumDueDate || "",
    policyStatus: insurancePolicyOperationalStatus(policy, referenceDate),
    nextDueType: due?.label || "",
    nextDueDate: due?.date || "",
    nextDueDays: due?.daysUntil ?? null
  };
}
