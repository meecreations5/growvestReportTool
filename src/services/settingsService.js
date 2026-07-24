import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export const DEFAULT_BRANDING = {
  companyName: "GrowVest",
  legalName: "GrowVest Advisors Private Limited",
  tagline: "Your Money, Your Vision, Our Direction",
  brandPositioning: "Your Conscious Wealth Partner",
  documentFooterTagline: "Grow and Invest with Us",
  iconLogoUrl: "",
  pwaIcon192Url: "",
  pwaIcon512Url: "",
  pwaMaskableIconUrl: "",
  pwaAppleTouchIconUrl: "",
  pwaAppName: "GrowVest – Your Conscious Wealth Partner",
  pwaShortName: "GrowVest",
  pwaTagline: "Your Conscious Wealth Partner",
  primaryLogoUrl: "",
  whiteLogoUrl: "",
  emailLogoUrl: "",
  signatureLogoUrl: "",
  signatureIconUrl: "",
  signatureScriptFontUrl: "",
  signatureBrandPositioning: "Your Conscious Wealth Partner",
  signatureWebsite: "growvest.info",
  signatureAddress: "Shop no. 53, Lower Ground Floor, EAZE Zone Mall, Goregaon West, Mumbai 400104",
  signatureFooterLeftText: "Fulfill Your Bucketlist",
  signatureFooterRightText: "Experience the Wealth Every Moment",
  signatureSocialEnabled: true,
  signatureLinkedInUrl: "",
  signatureInstagramUrl: "",
  signatureFacebookUrl: "",
  signatureYouTubeUrl: "",
  signatureXUrl: "",
  pdfLogoUrl: "",
  footerLogoUrl: "",
  logoUrl: "",
  watermarkUrl: "",
  coverBackgroundUrl: "",
  website: "growvest.info",
  supportEmail: "connect@growvest.info",
  supportMobile: "+91 86557 68940",
  address: "Shop no. 53, Lower Ground Floor, EAZE Zone Mall, Goregaon West, Mumbai 400104",
  primaryColor: "#1F4ED8",
  secondaryColor: "#20B8CD",
  darkColor: "#0B0B0F",
  dangerColor: "#E53935",
  warningColor: "#F5B301",
  surfaceColor: "#F4F6F9",
  mutedColor: "#6B7280",
  whiteColor: "#FFFFFF",
  watermarkOpacity: 4,
  confidentialLabel: "Confidential client report",
  pdfFilenamePattern: "{InvestorName}_{Month}_{Year}_GrowVest_Report.pdf",
  showPageNumbers: true,
  showContactInFooter: true,
  showFooterTagline: true,
  showConfidentialLabel: true,
  emailFooterText: "This is a service communication from GrowVest.",
  defaultEmailSignatureHtml: ""
};

export const DEFAULT_SYSTEM_SETTINGS = {
  branding: DEFAULT_BRANDING,
  brandingDraft: DEFAULT_BRANDING,
  brandingMeta: {
    version: 0,
    status: "published",
    lastDraftSavedAt: null,
    lastDraftSavedByUid: "",
    lastDraftSavedByName: "",
    lastPublishedAt: null,
    lastPublishedByUid: "",
    lastPublishedByName: ""
  },
  reports: {
    defaultTitle: "Monthly Wealth Progress Report",
    currency: "INR",
    dateFormat: "DD MMM YYYY",
    confidentialityText: "Confidential — prepared exclusively for the named Investor.",
    disclaimer: "This report is prepared exclusively for the named client and is confidential. Portfolio values are based on information available as of the statement date. Past performance does not indicate future results.",
    footerText: "Grow and Invest with Us",
    growthAssetClasses: "Equity,Trading",
    stableAssetClasses: "Debt,Liquid,Cash,Insurance",
    showPageNumbers: true,
    showContactInFooter: true,
    showFooterTagline: true,
    showConfidentialLabel: true
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

export function normaliseBranding(value = {}) {
  const branding = { ...DEFAULT_BRANDING, ...(value || {}) };
  branding.iconLogoUrl = branding.iconLogoUrl || branding.logoUrl || "";
  branding.pwaIcon512Url = branding.pwaIcon512Url || branding.pwaIconUrl || "";
  branding.pwaIcon192Url = branding.pwaIcon192Url || branding.pwaIcon512Url || "";
  branding.pwaMaskableIconUrl = branding.pwaMaskableIconUrl || "";
  branding.pwaAppleTouchIconUrl = branding.pwaAppleTouchIconUrl || branding.pwaIcon512Url || branding.pwaIcon192Url || "";
  branding.pwaShortName = branding.pwaShortName || branding.companyName || "GrowVest";
  branding.pwaTagline = branding.pwaTagline || branding.brandPositioning || "Your Conscious Wealth Partner";
  branding.pwaAppName = branding.pwaAppName || `${branding.pwaShortName} – ${branding.pwaTagline}`;
  branding.primaryLogoUrl = branding.primaryLogoUrl || branding.logoUrl || "";
  branding.whiteLogoUrl = branding.whiteLogoUrl || "";
  branding.emailLogoUrl = branding.emailLogoUrl || branding.primaryLogoUrl || branding.logoUrl || "";
  branding.signatureLogoUrl = branding.signatureLogoUrl || branding.emailLogoUrl || branding.primaryLogoUrl || branding.logoUrl || "";
  branding.signatureIconUrl = branding.signatureIconUrl || branding.footerLogoUrl || branding.iconLogoUrl || branding.watermarkUrl || "";
  branding.signatureScriptFontUrl = branding.signatureScriptFontUrl || "";
  branding.signatureBrandPositioning = branding.signatureBrandPositioning || branding.brandPositioning || "Your Conscious Wealth Partner";
  branding.signatureWebsite = branding.signatureWebsite || branding.website || "";
  branding.signatureAddress = branding.signatureAddress || branding.address || "";
  branding.signatureFooterLeftText = branding.signatureFooterLeftText || "Fulfill Your Bucketlist";
  branding.signatureFooterRightText = branding.signatureFooterRightText || "Experience the Wealth Every Moment";
  branding.signatureSocialEnabled = branding.signatureSocialEnabled !== false;
  branding.signatureLinkedInUrl = branding.signatureLinkedInUrl || "";
  branding.signatureInstagramUrl = branding.signatureInstagramUrl || "";
  branding.signatureFacebookUrl = branding.signatureFacebookUrl || "";
  branding.signatureYouTubeUrl = branding.signatureYouTubeUrl || "";
  branding.signatureXUrl = branding.signatureXUrl || "";
  branding.pdfLogoUrl = branding.pdfLogoUrl || branding.primaryLogoUrl || branding.logoUrl || "";
  branding.footerLogoUrl = branding.footerLogoUrl || branding.iconLogoUrl || "";
  branding.logoUrl = branding.primaryLogoUrl || branding.logoUrl || "";
  branding.watermarkOpacity = Math.min(15, Math.max(0, Number(branding.watermarkOpacity || 0)));
  return branding;
}

function normaliseSettings(value = {}) {
  const branding = normaliseBranding(value.branding || {});
  const brandingDraft = normaliseBranding(value.brandingDraft || branding);

  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...value,
    branding,
    brandingDraft,
    brandingMeta: { ...DEFAULT_SYSTEM_SETTINGS.brandingMeta, ...(value.brandingMeta || {}) },
    reports: { ...DEFAULT_SYSTEM_SETTINGS.reports, ...(value.reports || {}) },
    communications: { ...DEFAULT_SYSTEM_SETTINGS.communications, ...(value.communications || {}) },
    masters: { ...DEFAULT_SYSTEM_SETTINGS.masters, ...(value.masters || {}) },
    servicing: { ...DEFAULT_SYSTEM_SETTINGS.servicing, ...(value.servicing || {}) }
  };
}

function actor(profile = {}) {
  return {
    uid: profile.id || profile.uid || "",
    name: profile.fullName || profile.displayName || profile.email || "GrowVest Admin"
  };
}

export function subscribeSystemSettings(callback, onError) {
  return onSnapshot(doc(db, "reportSettings", "global"), (snapshot) => {
    callback(normaliseSettings(snapshot.exists() ? snapshot.data() : {}));
  }, onError);
}

export function subscribeBrandingVersions(callback, onError, count = 12) {
  const versionsQuery = query(collection(db, "brandingVersions"), orderBy("version", "desc"), limit(count));
  return onSnapshot(versionsQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export async function saveSystemSettings(settings, profile) {
  const normalised = normaliseSettings(settings);
  const updatedAt = serverTimestamp();
  const user = actor(profile);
  const batch = writeBatch(db);
  batch.set(doc(db, "reportSettings", "global"), {
    ...normalised,
    updatedByUid: user.uid,
    updatedByName: user.name,
    updatedAt
  }, { merge: true });

  // Public branding remains the published snapshot. Saving operational settings
  // never publishes an unfinished branding draft.
  batch.set(doc(db, "publicSettings", "branding"), {
    ...normalised.branding,
    updatedAt
  }, { merge: true });

  await batch.commit();
}

export async function saveBrandingDraft(branding, profile) {
  const draft = normaliseBranding(branding);
  const user = actor(profile);
  await writeBatch(db)
    .set(doc(db, "reportSettings", "global"), {
      brandingDraft: draft,
      brandingMeta: {
        status: "draft",
        lastDraftSavedAt: serverTimestamp(),
        lastDraftSavedByUid: user.uid,
        lastDraftSavedByName: user.name
      },
      updatedByUid: user.uid,
      updatedByName: user.name,
      updatedAt: serverTimestamp()
    }, { merge: true })
    .commit();
}

export async function publishBranding(branding, profile) {
  const publishedBranding = normaliseBranding(branding);
  const user = actor(profile);
  const settingsRef = doc(db, "reportSettings", "global");
  const publicRef = doc(db, "publicSettings", "branding");
  const versionRef = doc(collection(db, "brandingVersions"));

  return runTransaction(db, async (transaction) => {
    const settingsSnapshot = await transaction.get(settingsRef);
    const current = normaliseSettings(settingsSnapshot.exists() ? settingsSnapshot.data() : {});
    const nextVersion = Number(current.brandingMeta?.version || 0) + 1;
    const timestamp = serverTimestamp();

    transaction.set(settingsRef, {
      branding: publishedBranding,
      brandingDraft: publishedBranding,
      brandingMeta: {
        version: nextVersion,
        status: "published",
        lastDraftSavedAt: timestamp,
        lastDraftSavedByUid: user.uid,
        lastDraftSavedByName: user.name,
        lastPublishedAt: timestamp,
        lastPublishedByUid: user.uid,
        lastPublishedByName: user.name
      },
      updatedByUid: user.uid,
      updatedByName: user.name,
      updatedAt: timestamp
    }, { merge: true });

    transaction.set(publicRef, {
      ...publishedBranding,
      version: nextVersion,
      updatedByUid: user.uid,
      updatedByName: user.name,
      updatedAt: timestamp
    }, { merge: true });

    transaction.set(versionRef, {
      version: nextVersion,
      branding: publishedBranding,
      publishedByUid: user.uid,
      publishedByName: user.name,
      publishedAt: timestamp
    });

    return nextVersion;
  });
}
