const MUTUAL_FUND = "mutual_fund";
const PMS = "pms";

export const STRUCTURED_WITHDRAWAL_PRODUCT_TYPES = [MUTUAL_FUND, PMS];

export function isStructuredWithdrawalProduct(positionOrType = {}) {
  const productType = typeof positionOrType === "string"
    ? positionOrType
    : positionOrType?.productType;
  return STRUCTURED_WITHDRAWAL_PRODUCT_TYPES.includes(String(productType || ""));
}

export function isPmsWithdrawalProduct(positionOrType = {}) {
  const productType = typeof positionOrType === "string"
    ? positionOrType
    : positionOrType?.productType;
  return String(productType || "") === PMS;
}

export function supportsWithdrawalSipInstruction(positionOrType = {}) {
  const productType = typeof positionOrType === "string"
    ? positionOrType
    : positionOrType?.productType;
  return String(productType || "") === MUTUAL_FUND;
}

export function withdrawalProductLabel(positionOrType = {}) {
  const productType = typeof positionOrType === "string"
    ? positionOrType
    : positionOrType?.productType;
  if (String(productType || "") === PMS) return "PMS";
  if (String(productType || "") === MUTUAL_FUND) return "Mutual Fund";
  return "Investment";
}
