import { doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export const DEFAULT_SYSTEM_SETTINGS = {
  branding: {
    companyName: "GrowVest",
    legalName: "GrowVest Advisors Private Limited",
    tagline: "Your Money, Your Vision, Our Direction",
    brandPositioning: "Your Conscious Wealth Partner",
    documentFooterTagline: "Grow and Invest with Us",
    iconLogoUrl: "",
    primaryLogoUrl: "",
    whiteLogoUrl: "",
    emailLogoUrl: "",
    logoUrl: "",
    watermarkUrl: "",
    website: "growvest.info",
    supportEmail: "cwp@growvest.info",
    supportMobile: "+91 86557 68940",
    address: "Shop no. 53, Lower Ground Floor, EAZE Zone Mall, Goregaon West, Mumbai 400104",
    primaryColor: "#1F4ED8",
    secondaryColor: "#20B8CD",
    emailFooterText: "This is a service communication from GrowVest.",
    defaultEmailSignatureHtml: ""
  },
  reports: {
    defaultTitle: "Monthly Wealth Progress Report",
    currency: "INR",
    dateFormat: "DD MMM YYYY",
    confidentialityText: "Confidential — prepared exclusively for the named Investor.",
    disclaimer: "This report is prepared exclusively for the named client and is confidential. Portfolio values are based on information available as of the statement date. Past performance does not indicate future results.",
    footerText: "Grow and Invest with Us",
    growthAssetClasses: "Equity,Trading",
    stableAssetClasses: "Debt,Liquid,Cash,Insurance"
  },
  communications: {
    senderName: "Conscious Wealth Partner",
    senderEmail: "cwp@growvest.info",
    replyToEmail: "cwp@growvest.info",
    whatsappMode: "manual_click_to_chat",
    meetingReminder24Hours: true,
    meetingReminder1Hour: true,
    investorEmailEnabled: true,
    advisorEmailEnabled: true,
    investorInAppEnabled: true,
    advisorInAppEnabled: true
  },
  masters: {
    leadSources: "Referral,Website,Existing Client,Social Media,Walk-in,Event,Partner,Other",
    advisoryAreas: "Financial Planning,Mutual Funds,Insurance,Retirement Planning,Tax Planning,Estate Planning,PMS,AIF,Other",
    meetingTypes: "Initial Consultation,Client Assessment,Financial Planning,Portfolio Review,Monthly Review,Quarterly Review,Goal Review,Service Review,Other",
    goalCategories: "Emergency Fund,Education,Marriage,Home,Retirement,Travel,Vehicle,Business,Wealth Creation,Insurance,Other",
    assetClasses: "Equity,Debt,Liquid,Cash,Insurance,Trading,Gold,Other"
  },
  servicing: {
    whatsappUpdateDay: 3,
    emailUpdateDay: 5,
    generalQueryHours: 8,
    actionQueryHours: 4,
    complaintQueryHours: 2,
    urgentQueryHours: 1,
    reviewFrequencyDays: 90,
    reviewInviteDays: 7,
    recapHours: 24,
    rebalancingDays: 2,
    renewalFlagDays: 60,
    renewalConversationDays: 45,
    momPendingHours: 24
  }
};

function normaliseSettings(value = {}) {
  const branding = { ...DEFAULT_SYSTEM_SETTINGS.branding, ...(value.branding || {}) };
  branding.iconLogoUrl = branding.iconLogoUrl || branding.logoUrl || "";
  branding.primaryLogoUrl = branding.primaryLogoUrl || branding.logoUrl || "";
  branding.whiteLogoUrl = branding.whiteLogoUrl || "";
  branding.emailLogoUrl = branding.emailLogoUrl || branding.primaryLogoUrl || branding.logoUrl || "";
  branding.logoUrl = branding.primaryLogoUrl || branding.logoUrl || "";

  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...value,
    branding,
    reports: { ...DEFAULT_SYSTEM_SETTINGS.reports, ...(value.reports || {}) },
    communications: { ...DEFAULT_SYSTEM_SETTINGS.communications, ...(value.communications || {}) },
    masters: { ...DEFAULT_SYSTEM_SETTINGS.masters, ...(value.masters || {}) },
    servicing: { ...DEFAULT_SYSTEM_SETTINGS.servicing, ...(value.servicing || {}) }
  };
}

export function subscribeSystemSettings(callback, onError) {
  return onSnapshot(doc(db, "reportSettings", "global"), (snapshot) => {
    callback(normaliseSettings(snapshot.exists() ? snapshot.data() : {}));
  }, onError);
}

export async function saveSystemSettings(settings, profile) {
  const normalised = normaliseSettings(settings);
  const updatedAt = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(doc(db, "reportSettings", "global"), {
    ...normalised,
    updatedByUid: profile.id,
    updatedByName: profile.fullName,
    updatedAt
  }, { merge: true });

  // Public branding is deliberately separated so unauthenticated login pages
  // can show the approved logo, colours and tagline without exposing internal settings.
  batch.set(doc(db, "publicSettings", "branding"), {
    ...normalised.branding,
    updatedAt
  }, { merge: true });

  await batch.commit();
}
