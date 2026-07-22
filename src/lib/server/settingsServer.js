import { adminDb } from "@/lib/server/firebaseAdmin";

export const SERVER_BRANDING_DEFAULTS = {
  companyName: "GrowVest",
  legalName: "GrowVest Advisors Private Limited",
  tagline: "Your Money, Your Vision, Our Direction",
  iconLogoUrl: "",
  primaryLogoUrl: "",
  emailLogoUrl: "",
  watermarkUrl: "",
  website: "growvest.info",
  supportEmail: "cwp@growvest.info",
  supportMobile: "",
  address: "",
  primaryColor: "#1F4ED8",
  secondaryColor: "#20B8CD",
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
