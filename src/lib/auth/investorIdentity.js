export const INVESTOR_USERNAME_DOMAIN = "investor.growvest.internal";

export function normalizeInvestorUsername(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

export function isValidInvestorUsername(value = "") {
  const normalized = normalizeInvestorUsername(value);
  return /^[a-z0-9][a-z0-9._-]{3,28}[a-z0-9]$/.test(normalized);
}

export function investorUsernameToEmail(value = "") {
  const normalized = normalizeInvestorUsername(value);

  if (!isValidInvestorUsername(normalized)) {
    throw new Error(
      "Username must be 5 to 30 characters and use lowercase letters, numbers, dots, underscores or hyphens."
    );
  }

  return `${normalized}@${INVESTOR_USERNAME_DOMAIN}`;
}
