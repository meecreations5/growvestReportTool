import { STAFF_ROLES, USER_ROLES } from "@/lib/constants/roles";

export const AUTH_PROVIDER_IDS = {
  MICROSOFT: "microsoft.com",
  GOOGLE: "google.com",
  PASSWORD: "password",
  PHONE: "phone"
};

export function getProviderIds(firebaseUser) {
  return Array.from(
    new Set((firebaseUser?.providerData || []).map((item) => item.providerId).filter(Boolean))
  );
}

export function validateApplicationProfile(firebaseUser, profile) {
  if (!firebaseUser) {
    return "No authenticated Firebase user was found.";
  }

  if (!profile) {
    return "Your account is authenticated but is not authorised for this application.";
  }

  if (profile.status !== "active") {
    return "Your GrowVest account is inactive. Please contact the administrator.";
  }

  const providerIds = getProviderIds(firebaseUser);

  if (STAFF_ROLES.includes(profile.role)) {
    if (!providerIds.includes(AUTH_PROVIDER_IDS.MICROSOFT)) {
      return "Staff users must sign in using Microsoft 365.";
    }
    return null;
  }

  if (profile.role === USER_ROLES.INVESTOR) {
    if (profile.portalEnabled === false) {
      return "Investor portal access is disabled for this account.";
    }

    const hasSupportedInvestorProvider = providerIds.some((providerId) =>
      [AUTH_PROVIDER_IDS.PASSWORD, AUTH_PROVIDER_IDS.PHONE, AUTH_PROVIDER_IDS.GOOGLE].includes(providerId)
    );

    if (!hasSupportedInvestorProvider) {
      return "Investor accounts must use username and password, mobile OTP, or an authorised Google account.";
    }

    if (!profile.investorId) {
      return "This login is not linked to an investor profile.";
    }

    return null;
  }

  return "No valid application role is assigned to this account.";
}

export function sanitizeNextPath(value, fallback, allowedPrefix = "/") {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (allowedPrefix !== "/" && !value.startsWith(allowedPrefix)) return fallback;
  return value;
}
