export const EMAIL_SIGNATURE_MODES = [
  { value: "hybrid", label: "Hybrid", description: "Handwritten name artwork with responsive contact details." },
  { value: "responsive_html", label: "Responsive HTML", description: "Fully editable, accessible HTML signature." },
  { value: "full_image", label: "Full image", description: "Use one uploaded signature artwork exactly as designed." }
];

export const EMAIL_SIGNATURE_STATUSES = {
  DRAFT: "draft",
  PENDING: "pending_approval",
  PUBLISHED: "published",
  CHANGES_REQUIRED: "changes_required"
};

export const EMAIL_SIGNATURE_STATUS_LABELS = {
  draft: "Draft",
  pending_approval: "Pending approval",
  published: "Published",
  changes_required: "Changes required"
};

export const EMAIL_SIGNATURE_ASSET_TYPES = {
  HANDWRITTEN_NAME: "handwritten-name",
  FULL_SIGNATURE: "full-signature"
};

export const DEFAULT_EMAIL_SIGNATURE_VISIBILITY = {
  designation: true,
  brandPositioning: true,
  email: true,
  mobile: true,
  website: true,
  address: true,
  socialMedia: true,
  watermark: true,
  footer: true,
  companyLogo: true
};

export const DEFAULT_EMAIL_SIGNATURE = {
  enabled: true,
  mode: "hybrid",
  fullName: "",
  displaySurname: "",
  designation: "",
  department: "",
  brandPositioning: "",
  handwrittenNameUrl: "",
  fullSignatureImageUrl: "",
  email: "",
  mobile: "",
  website: "",
  officeAddress: "",
  footerLeftText: "",
  footerRightText: "",
  layoutDensity: "comfortable",
  visibility: DEFAULT_EMAIL_SIGNATURE_VISIBILITY
};

export function signatureStatusTone(status) {
  if (status === EMAIL_SIGNATURE_STATUSES.PUBLISHED) return "success";
  if (status === EMAIL_SIGNATURE_STATUSES.PENDING) return "warning";
  if (status === EMAIL_SIGNATURE_STATUSES.CHANGES_REQUIRED) return "danger";
  return "neutral";
}
