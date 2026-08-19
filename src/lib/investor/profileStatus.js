export const INVESTOR_REQUIRED_DOCUMENTS = [
  "PAN Card",
  "Aadhaar Card",
  "Cancelled Cheque",
  "Photograph",
  "Address Proof",
  "Signature"
];

const STATUS_WEIGHT = {
  verified: 6,
  uploaded: 5,
  requested: 4,
  rejected: 3,
  expired: 2,
  missing: 1
};

function clean(value) {
  return String(value ?? "").trim();
}

export function investorProfileCompletion(investor = {}) {
  const checks = [
    ["Full name", clean(investor.fullName)],
    ["Mobile number", clean(investor.contactNo)],
    ["Email", clean(investor.email)],
    ["City", clean(investor.city)],
    ["Date of birth", clean(investor.personalProfile?.dateOfBirth)],
    ["Occupation", clean(investor.personalProfile?.occupation)],
    ["PAN", clean(investor.panNumber || investor.panNormalized)]
  ];
  const completed = checks.filter(([, value]) => Boolean(value)).length;
  const percent = Math.round((completed / checks.length) * 100);
  const missingFields = checks.filter(([, value]) => !value).map(([label]) => label);
  return {
    status: percent === 100 ? "Complete" : completed === 0 ? "Incomplete" : "In Progress",
    percent,
    completedFields: completed,
    totalFields: checks.length,
    missingFields
  };
}

export function documentChecklist(documents = [], requiredTypes = INVESTOR_REQUIRED_DOCUMENTS) {
  return requiredTypes.map((documentType) => {
    const candidates = (Array.isArray(documents) ? documents : [])
      .filter((item) => clean(item.documentType).toLowerCase() === documentType.toLowerCase())
      .sort((left, right) => Number(STATUS_WEIGHT[right.status] || 0) - Number(STATUS_WEIGHT[left.status] || 0));
    const record = candidates[0] || null;
    return {
      documentType,
      documentId: record?.id || "",
      status: record?.status || "missing",
      fileName: record?.fileName || "",
      title: record?.title || documentType,
      uploadedAt: record?.uploadedAt || null,
      verifiedAt: record?.verifiedAt || null
    };
  });
}

export function investorDocumentStatus(documents = [], requiredTypes = INVESTOR_REQUIRED_DOCUMENTS) {
  const checklist = documentChecklist(documents, requiredTypes);
  const uploadedCount = checklist.filter((item) => ["uploaded", "verified"].includes(item.status)).length;
  const verifiedCount = checklist.filter((item) => item.status === "verified").length;
  const attentionCount = checklist.filter((item) => ["rejected", "expired"].includes(item.status)).length;
  const missingTypes = checklist.filter((item) => ["missing", "requested", "rejected", "expired"].includes(item.status)).map((item) => item.documentType);
  const requiredCount = checklist.length;
  const status = attentionCount
    ? "Needs Attention"
    : verifiedCount === requiredCount
      ? "Verified"
      : uploadedCount === requiredCount
        ? "Complete"
        : uploadedCount > 0
          ? "In Progress"
          : "Incomplete";
  return { status, requiredCount, uploadedCount, verifiedCount, attentionCount, missingTypes, checklist };
}

export function investorKycStatus(investor = {}, documents = []) {
  const panAdded = Boolean(clean(investor.panNumber || investor.panNormalized));
  const aadhaarAdded = Boolean(investor.aadhaarConfigured);
  const checklist = documentChecklist(documents);
  const panCard = checklist.find((item) => item.documentType === "PAN Card");
  const panDocumentStatus = panCard?.status || "missing";
  const status = panAdded && panDocumentStatus === "verified"
    ? "Verified"
    : panAdded && ["uploaded", "verified"].includes(panDocumentStatus)
      ? "Complete"
      : panAdded || panDocumentStatus !== "missing" || aadhaarAdded
        ? "In Progress"
        : "Incomplete";
  return { status, panAdded, aadhaarAdded, panDocumentStatus };
}

export function buildInvestorStatusSummary(investor = {}, documents = []) {
  return {
    profile: investorProfileCompletion(investor),
    kyc: investorKycStatus(investor, documents),
    documents: investorDocumentStatus(documents)
  };
}
