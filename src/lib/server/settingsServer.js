import { adminDb } from "@/lib/server/firebaseAdmin";

export const SERVER_BRANDING_DEFAULTS = {
  companyName: "GrowVest",
  legalName: "GrowVest Advisors Private Limited",
  tagline: "Your Money, Your Vision, Our Direction",
  brandPositioning: "Your Conscious Wealth Partner",
  documentFooterTagline: "Grow and Invest with Us",
  iconLogoUrl: "",
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

export async function getServerBranding() {
  try {
    const publicSnapshot = await adminDb.collection("publicSettings").doc("branding").get();
    if (publicSnapshot.exists) return { ...SERVER_BRANDING_DEFAULTS, ...publicSnapshot.data() };
    const settingsSnapshot = await adminDb.collection("reportSettings").doc("global").get();
    return { ...SERVER_BRANDING_DEFAULTS, ...(settingsSnapshot.exists ? settingsSnapshot.data().branding || {} : {}) };
  } catch (error) {
    console.warn("Unable to load server branding settings", error);
    return { ...SERVER_BRANDING_DEFAULTS };
  }
}

export async function getAdvisorEmailProfile(advisorUid, fallback = {}) {
  if (!advisorUid) return fallback;
  try {
    const snapshot = await adminDb.collection("users").doc(advisorUid).get();
    return snapshot.exists ? { ...fallback, id: snapshot.id, ...snapshot.data() } : fallback;
  } catch (error) {
    console.warn("Unable to load Advisor email profile", error);
    return fallback;
  }
}

export async function getServerCommunicationSettings() {
  const defaults = {
    senderName: process.env.BREVO_DEFAULT_SENDER_NAME || "GrowVest",
    senderEmail: process.env.BREVO_DEFAULT_SENDER_EMAIL || "cwp@growvest.info",
    replyToEmail: process.env.BREVO_REPLY_TO_EMAIL || "cwp@growvest.info"
  };
  try {
    const snapshot = await adminDb.collection("reportSettings").doc("global").get();
    return { ...defaults, ...(snapshot.exists ? snapshot.data().communications || {} : {}) };
  } catch (error) {
    console.warn("Unable to load server communication settings", error);
    return defaults;
  }
}
