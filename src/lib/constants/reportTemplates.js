import {
  DEFAULT_EMAIL_TEMPLATE_ID,
  SIGNATURE_SOURCES,
  createEmailTemplateSnapshot,
  getSystemEmailTemplate
} from "@/lib/constants/emailTemplates";

export const TEMPLATE_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived"
};

export const TEMPLATE_CATEGORY_LABELS = {
  premium: "Premium",
  executive: "Executive",
  performance: "Performance",
  detailed: "Detailed",
  compact: "Compact",
  custom: "Custom"
};

export const REPORT_TEMPLATE_SECTIONS = [
  {
    key: "cover",
    label: "Report Cover",
    shortLabel: "Cover",
    description: "Investor identity, reporting period, GrowVest branding and confidentiality label.",
    mandatory: true
  },
  {
    key: "executiveSummary",
    label: "Executive Summary",
    shortLabel: "Summary",
    description: "Portfolio value, monthly movement, return and key financial metrics.",
    mandatory: true
  },
  {
    key: "performance",
    label: "Portfolio Performance",
    shortLabel: "Performance",
    description: "Opening value, contributions, withdrawals, gains and closing value.",
    mandatory: false
  },
  {
    key: "performanceTrend",
    label: "Performance Trend",
    shortLabel: "Trend",
    description: "Portfolio-value trend, monthly returns and benchmark comparison.",
    mandatory: false
  },
  {
    key: "goals",
    label: "Bucket List Progress",
    shortLabel: "Goals",
    description: "Primary and supporting goals, progress and monthly contributions.",
    mandatory: false
  },
  {
    key: "allocation",
    label: "Portfolio Allocation",
    shortLabel: "Allocation",
    description: "Asset allocation, target mix, variance and diversification summary.",
    mandatory: false
  },
  {
    key: "holdings",
    label: "Detailed Holdings",
    shortLabel: "Holdings",
    description: "Instrument-wise value, asset class, portfolio weight and notes.",
    mandatory: false
  },
  {
    key: "transactions",
    label: "Transactions",
    shortLabel: "Transactions",
    description: "Monthly investments, withdrawals and instrument-level activity.",
    mandatory: false
  },
  {
    key: "commentary",
    label: "Advisor Commentary",
    shortLabel: "Commentary",
    description: "Performance explanation, portfolio observations, risks and outlook.",
    mandatory: false
  },
  {
    key: "actions",
    label: "Recommended Actions",
    shortLabel: "Actions",
    description: "Recommended next steps, responsibility, due date and next review.",
    mandatory: false
  },
  {
    key: "disclaimer",
    label: "Disclaimer",
    shortLabel: "Disclaimer",
    description: "Confidentiality, data-source and market-risk statements.",
    mandatory: true
  }
];

const ALL_SECTION_KEYS = REPORT_TEMPLATE_SECTIONS.map((item) => item.key);

function visibilityFor(visibleKeys) {
  return Object.fromEntries(ALL_SECTION_KEYS.map((key) => [key, visibleKeys.includes(key)]));
}

function template({
  id,
  name,
  slug,
  description,
  category,
  coverStyle,
  sectionOrder,
  visibleSections,
  estimatedPages,
  primaryColor = "#1F4ED8",
  secondaryColor = "#20B8CD",
  darkColor = "#0B1220",
  chartStyle = "modern",
  tableDensity = "comfortable",
  advisorCardVisible = true,
  coverPattern = "orbital"
}) {
  return {
    id,
    name,
    slug,
    description,
    category,
    status: TEMPLATE_STATUS.ACTIVE,
    isDefault: id === "premium-blue",
    isSystemTemplate: true,
    version: 1,
    estimatedPages,
    sectionOrder,
    sectionVisibility: visibilityFor(visibleSections),
    appearance: {
      coverStyle,
      coverPattern,
      primaryColor,
      secondaryColor,
      darkColor,
      chartStyle,
      tableDensity,
      advisorCardVisible,
      headingStyle: "brand",
      bodyDensity: tableDensity,
      headerStyle: "compact",
      footerStyle: "legal"
    },
    delivery: {
      emailTemplateId: DEFAULT_EMAIL_TEMPLATE_ID,
      emailTemplateName: getSystemEmailTemplate(DEFAULT_EMAIL_TEMPLATE_ID)?.name || "Monthly Report Ready — Premium",
      emailTemplateVersion: Number(getSystemEmailTemplate(DEFAULT_EMAIL_TEMPLATE_ID)?.version || 1),
      emailTemplateSnapshot: createEmailTemplateSnapshot(getSystemEmailTemplate(DEFAULT_EMAIL_TEMPLATE_ID)),
      signatureSource: SIGNATURE_SOURCES.ASSIGNED_ADVISOR,
      includeSecureLink: true,
      attachPdf: true,
      includeSignature: true
    }
  };
}

export const SYSTEM_REPORT_TEMPLATES = [
  template({
    id: "premium-blue",
    name: "Premium Blue",
    slug: "premium-blue",
    description: "GrowVest's complete premium monthly wealth report with goals, allocation, holdings and advisor guidance.",
    category: "premium",
    coverStyle: "premium-dark",
    sectionOrder: ["cover", "executiveSummary", "performance", "performanceTrend", "goals", "allocation", "holdings", "commentary", "actions", "disclaimer"],
    visibleSections: ["cover", "executiveSummary", "performance", "performanceTrend", "goals", "allocation", "holdings", "commentary", "actions", "disclaimer"],
    estimatedPages: "8–10 pages",
    coverPattern: "orbital"
  }),
  template({
    id: "executive-minimal",
    name: "Executive Minimal",
    slug: "executive-minimal",
    description: "A concise, restrained report for Investors who prefer essential progress, insights and actions.",
    category: "executive",
    coverStyle: "minimal-light",
    sectionOrder: ["cover", "executiveSummary", "performance", "goals", "holdings", "commentary", "actions", "disclaimer"],
    visibleSections: ["cover", "executiveSummary", "performance", "goals", "holdings", "commentary", "actions", "disclaimer"],
    estimatedPages: "5–7 pages",
    darkColor: "#111827",
    chartStyle: "minimal",
    tableDensity: "compact",
    coverPattern: "none"
  }),
  template({
    id: "performance-focus",
    name: "Performance Focus",
    slug: "performance-focus",
    description: "Performance-led reporting with stronger trend, benchmark, allocation and risk commentary sections.",
    category: "performance",
    coverStyle: "performance-grid",
    sectionOrder: ["cover", "executiveSummary", "performance", "performanceTrend", "allocation", "holdings", "commentary", "actions", "disclaimer"],
    visibleSections: ["cover", "executiveSummary", "performance", "performanceTrend", "allocation", "holdings", "commentary", "actions", "disclaimer"],
    estimatedPages: "7–9 pages",
    primaryColor: "#173EB4",
    secondaryColor: "#12B76A",
    chartStyle: "analytical",
    coverPattern: "grid"
  }),
  template({
    id: "detailed-portfolio",
    name: "Detailed Portfolio",
    slug: "detailed-portfolio",
    description: "A comprehensive format for complex portfolios, detailed holdings, allocation and transactions.",
    category: "detailed",
    coverStyle: "structured-dark",
    sectionOrder: ["cover", "executiveSummary", "performance", "performanceTrend", "goals", "allocation", "holdings", "transactions", "commentary", "actions", "disclaimer"],
    visibleSections: ["cover", "executiveSummary", "performance", "performanceTrend", "goals", "allocation", "holdings", "transactions", "commentary", "actions", "disclaimer"],
    estimatedPages: "10–14 pages",
    primaryColor: "#1F4ED8",
    secondaryColor: "#F5B301",
    chartStyle: "detailed",
    tableDensity: "compact",
    coverPattern: "lines"
  }),
  template({
    id: "compact-investor-summary",
    name: "Compact Investor Summary",
    slug: "compact-investor-summary",
    description: "A short monthly update centred on portfolio value, primary goals, key insight and recommended action.",
    category: "compact",
    coverStyle: "compact-gradient",
    sectionOrder: ["cover", "executiveSummary", "goals", "commentary", "actions", "disclaimer"],
    visibleSections: ["cover", "executiveSummary", "goals", "commentary", "actions", "disclaimer"],
    estimatedPages: "3–4 pages",
    primaryColor: "#1F4ED8",
    secondaryColor: "#20B8CD",
    chartStyle: "compact",
    tableDensity: "compact",
    advisorCardVisible: false,
    coverPattern: "wave"
  }),
  template({
    id: "custom-branded-starter",
    name: "Custom Branded Starter",
    slug: "custom-branded-starter",
    description: "A flexible GrowVest starter template intended to be duplicated and configured for a specific reporting need.",
    category: "custom",
    coverStyle: "brand-light",
    sectionOrder: ["cover", "executiveSummary", "performance", "goals", "allocation", "holdings", "commentary", "actions", "disclaimer"],
    visibleSections: ["cover", "executiveSummary", "performance", "goals", "allocation", "holdings", "commentary", "actions", "disclaimer"],
    estimatedPages: "6–9 pages",
    primaryColor: "#1F4ED8",
    secondaryColor: "#20B8CD",
    chartStyle: "modern",
    coverPattern: "brand-mark"
  })
];

export function getSystemReportTemplate(templateId) {
  return SYSTEM_REPORT_TEMPLATES.find((item) => item.id === templateId || item.slug === templateId) || null;
}

export function visibleTemplateSections(templateValue) {
  const order = Array.isArray(templateValue?.sectionOrder) ? templateValue.sectionOrder : [];
  const visibility = templateValue?.sectionVisibility || {};
  return order.filter((key) => visibility[key] !== false);
}


export const DEFAULT_REPORT_TEMPLATE_ID = "premium-blue";

export function createReportTemplateSnapshot(templateValue) {
  const template = templateValue || getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID);
  return {
    id: template?.id || DEFAULT_REPORT_TEMPLATE_ID,
    name: template?.name || "Premium Blue",
    version: Number(template?.version || 1),
    category: template?.category || "premium",
    estimatedPages: template?.estimatedPages || "8–10 pages",
    sectionOrder: Array.isArray(template?.sectionOrder)
      ? [...template.sectionOrder]
      : [...(getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID)?.sectionOrder || [])],
    sectionVisibility: {
      ...(getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID)?.sectionVisibility || {}),
      ...(template?.sectionVisibility || {})
    },
    appearance: {
      ...(getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID)?.appearance || {}),
      ...(template?.appearance || {}),
      document: {
        showLogo: true,
        showClientCode: true,
        showReportMonth: true,
        showConfidentialLabel: true,
        showPageNumbers: true,
        showContactInformation: true,
        disclaimerStyle: "standard",
        ...(getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID)?.appearance?.document || {}),
        ...(template?.appearance?.document || {})
      }
    },
    delivery: {
      emailTemplateId: DEFAULT_EMAIL_TEMPLATE_ID,
      emailTemplateName: getSystemEmailTemplate(DEFAULT_EMAIL_TEMPLATE_ID)?.name || "Monthly Report Ready — Premium",
      emailTemplateVersion: Number(getSystemEmailTemplate(DEFAULT_EMAIL_TEMPLATE_ID)?.version || 1),
      emailTemplateSnapshot: createEmailTemplateSnapshot(getSystemEmailTemplate(DEFAULT_EMAIL_TEMPLATE_ID)),
      signatureSource: SIGNATURE_SOURCES.ASSIGNED_ADVISOR,
      includeSecureLink: true,
      attachPdf: true,
      includeSignature: true,
      ...(getSystemReportTemplate(DEFAULT_REPORT_TEMPLATE_ID)?.delivery || {}),
      ...(template?.delivery || {}),
      emailTemplateSnapshot: createEmailTemplateSnapshot(
        template?.delivery?.emailTemplateSnapshot
          || getSystemEmailTemplate(template?.delivery?.emailTemplateId || DEFAULT_EMAIL_TEMPLATE_ID)
      )
    }
  };
}

export function resolveReportTemplate(report) {
  const snapshot = report?.templateSnapshot || null;
  const requestedTemplateId = report?.templateId || snapshot?.id || DEFAULT_REPORT_TEMPLATE_ID;
  const systemTemplate = getSystemReportTemplate(requestedTemplateId);

  if (snapshot) {
    // Top-level report fields are authoritative. Older records can contain a
    // stale snapshot id/version after changing the template, so apply them last.
    return createReportTemplateSnapshot({
      ...(systemTemplate || {}),
      ...snapshot,
      id: requestedTemplateId,
      version: Number(report?.templateVersion || snapshot?.version || systemTemplate?.version || 1)
    });
  }

  return createReportTemplateSnapshot(systemTemplate);
}


const REPORT_SECTION_NAV_MAP = {
  cover: ["Overview", "report-overview"],
  executiveSummary: ["Performance", "report-performance"],
  performance: ["Performance", "portfolio-composition"],
  performanceTrend: ["Trend", "portfolio-trend"],
  goals: ["Goals", "report-goals"],
  allocation: ["Allocation", "report-allocation"],
  holdings: ["Holdings", "report-holdings"],
  transactions: ["Transactions", "report-transactions"],
  commentary: ["Commentary", "report-commentary"],
  actions: ["Actions", "report-actions"],
  disclaimer: ["Disclaimer", "report-disclaimer"]
};

export function reportTemplateNavItems(report) {
  const template = resolveReportTemplate(report);
  const seen = new Set();
  return template.sectionOrder
    .filter((key) => template.sectionVisibility?.[key] !== false)
    .map((key) => REPORT_SECTION_NAV_MAP[key])
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item[1])) return false;
      seen.add(item[1]);
      return true;
    });
}

export function templateCategoryLabel(category) {
  return TEMPLATE_CATEGORY_LABELS[category] || "Custom";
}
