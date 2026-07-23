export const EMAIL_TEMPLATE_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived"
};

export const EMAIL_TEMPLATE_TYPES = {
  MONTHLY_REPORT_READY: "monthly_report_ready",
  MONTHLY_REPORT_REMINDER: "monthly_report_reminder",
  REPORT_RESENT: "report_resent",
  MEETING_INVITATION: "meeting_invitation",
  MOM_SHARED: "mom_shared",
  DOCUMENT_SHARED: "document_shared",
  GENERAL_INVESTOR: "general_investor"
};

export const EMAIL_TEMPLATE_TYPE_LABELS = {
  [EMAIL_TEMPLATE_TYPES.MONTHLY_REPORT_READY]: "Monthly Report Ready",
  [EMAIL_TEMPLATE_TYPES.MONTHLY_REPORT_REMINDER]: "Monthly Report Reminder",
  [EMAIL_TEMPLATE_TYPES.REPORT_RESENT]: "Report Resent",
  [EMAIL_TEMPLATE_TYPES.MEETING_INVITATION]: "Meeting Invitation",
  [EMAIL_TEMPLATE_TYPES.MOM_SHARED]: "MOM Shared",
  [EMAIL_TEMPLATE_TYPES.DOCUMENT_SHARED]: "Document Shared",
  [EMAIL_TEMPLATE_TYPES.GENERAL_INVESTOR]: "General Investor Communication"
};

export const SIGNATURE_SOURCES = {
  ASSIGNED_ADVISOR: "assigned_advisor",
  REPORT_CREATOR: "report_creator",
  RELATIONSHIP_MANAGER: "relationship_manager",
  COMPANY_DEFAULT: "company_default",
  NONE: "none"
};

export const SIGNATURE_SOURCE_LABELS = {
  [SIGNATURE_SOURCES.ASSIGNED_ADVISOR]: "Assigned Advisor's published signature",
  [SIGNATURE_SOURCES.REPORT_CREATOR]: "Report creator's published signature",
  [SIGNATURE_SOURCES.RELATIONSHIP_MANAGER]: "Relationship manager's published signature",
  [SIGNATURE_SOURCES.COMPANY_DEFAULT]: "Default company signature",
  [SIGNATURE_SOURCES.NONE]: "No signature"
};

export const EMAIL_MERGE_FIELDS = [
  { key: "investor_name", label: "Investor full name" },
  { key: "investor_first_name", label: "Investor first name" },
  { key: "report_month", label: "Report month" },
  { key: "report_year", label: "Report year" },
  { key: "report_reference", label: "Report reference" },
  { key: "statement_date", label: "Statement date" },
  { key: "advisor_name", label: "Advisor name" },
  { key: "advisor_designation", label: "Advisor designation" },
  { key: "advisor_mobile", label: "Advisor mobile" },
  { key: "advisor_email", label: "Advisor email" },
  { key: "report_url", label: "Secure report URL" },
  { key: "company_name", label: "Company name" }
];

const DEFAULT_SIGNATURE_VISIBILITY = {
  companyLogo: true,
  signatureIcon: true,
  advisorPhoto: false,
  designation: true,
  mobile: true,
  whatsapp: true,
  email: true,
  website: true,
  address: true,
  brandPositioning: true,
  socialMedia: true,
  footerTaglines: true
};

export const DEFAULT_EMAIL_TEMPLATE_ID = "monthly-report-ready-premium";

export const SYSTEM_EMAIL_TEMPLATES = [
  {
    id: DEFAULT_EMAIL_TEMPLATE_ID,
    name: "Monthly Report Ready — Premium",
    slug: "monthly-report-ready-premium",
    description: "GrowVest's standard responsive report-delivery email with a secure portal CTA and Advisor signature.",
    type: EMAIL_TEMPLATE_TYPES.MONTHLY_REPORT_READY,
    status: EMAIL_TEMPLATE_STATUS.ACTIVE,
    isDefault: true,
    isSystemTemplate: true,
    version: 1,
    content: {
      subject: "Your {{report_month}} {{report_year}} Wealth Report is Ready",
      preheader: "Your GrowVest monthly wealth report is available in the secure Investor Portal.",
      eyebrow: "Monthly Wealth Report",
      heading: "Your {{report_month}} report is ready",
      greeting: "Hello {{investor_first_name}},",
      body: "Your monthly wealth report has been prepared and is now available in the secure GrowVest Investor Portal. Please review the report and contact your Advisor if you would like to discuss any part of it.",
      ctaText: "View Monthly Report",
      privacyNote: "For privacy, portfolio values are available only after secure login to the GrowVest Investor Portal.",
      footerText: "This is a service communication from GrowVest."
    },
    design: {
      canvasBackground: "#F4F7FB",
      contentBackground: "#FFFFFF",
      maxWidth: 640,
      borderRadius: 18,
      outerPadding: 28,
      contentPadding: 30,
      header: {
        backgroundColor: "#1F4ED8",
        textColor: "#FFFFFF",
        alignment: "left",
        logoMaxWidth: 220,
        logoMaxHeight: 48,
        padding: 24,
        showTagline: true,
        dividerVisible: true,
        dividerColor: "#20B8CD",
        dividerThickness: 4
      },
      typography: {
        headingFont: "League Spartan, Arial, sans-serif",
        bodyFont: "Arial, sans-serif",
        headingColor: "#101828",
        bodyColor: "#344054",
        mutedColor: "#667085",
        headingSize: 28,
        bodySize: 15,
        lineHeight: 1.7
      },
      button: {
        backgroundColor: "#1F4ED8",
        textColor: "#FFFFFF",
        borderRadius: 10,
        alignment: "left",
        fullWidth: false
      },
      footer: {
        backgroundColor: "#F7F9FC",
        textColor: "#667085",
        borderColor: "#E4E9F2"
      }
    },
    signature: {
      enabled: true,
      source: SIGNATURE_SOURCES.ASSIGNED_ADVISOR,
      visibility: { ...DEFAULT_SIGNATURE_VISIBILITY }
    },
    delivery: {
      includeSecureLink: true,
      attachPdf: true
    }
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getSystemEmailTemplate(templateId) {
  return SYSTEM_EMAIL_TEMPLATES.find((item) => item.id === templateId || item.slug === templateId) || null;
}

export function createEmailTemplateSnapshot(templateValue) {
  const base = getSystemEmailTemplate(DEFAULT_EMAIL_TEMPLATE_ID);
  const source = templateValue || base;
  return {
    id: source?.id || DEFAULT_EMAIL_TEMPLATE_ID,
    name: source?.name || base.name,
    type: source?.type || EMAIL_TEMPLATE_TYPES.MONTHLY_REPORT_READY,
    version: Number(source?.version || 1),
    content: {
      ...clone(base.content),
      ...(source?.content || {})
    },
    design: {
      ...clone(base.design),
      ...(source?.design || {}),
      header: { ...clone(base.design.header), ...(source?.design?.header || {}) },
      typography: { ...clone(base.design.typography), ...(source?.design?.typography || {}) },
      button: { ...clone(base.design.button), ...(source?.design?.button || {}) },
      footer: { ...clone(base.design.footer), ...(source?.design?.footer || {}) }
    },
    signature: {
      ...clone(base.signature),
      ...(source?.signature || {}),
      visibility: {
        ...clone(base.signature.visibility),
        ...(source?.signature?.visibility || {})
      }
    },
    delivery: {
      ...clone(base.delivery),
      ...(source?.delivery || {})
    }
  };
}

export function mergeEmailFields(value = "", fields = {}) {
  return String(value || "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => {
    const resolved = fields[key];
    return resolved === null || resolved === undefined ? "" : String(resolved);
  });
}

export function defaultEmailTemplatePreviewFields() {
  return {
    investor_name: "Arjun Mehta",
    investor_first_name: "Arjun",
    report_month: "July",
    report_year: "2026",
    report_reference: "GV-RPT-2026-07-104",
    statement_date: "31 July 2026",
    advisor_name: "Suraj Sawant",
    advisor_designation: "Conscious Wealth Partner",
    advisor_mobile: "+91 86557 68940",
    advisor_email: "suraj@growvest.info",
    report_url: "https://portal.growvest.info/investor/reports/example",
    company_name: "GrowVest"
  };
}
