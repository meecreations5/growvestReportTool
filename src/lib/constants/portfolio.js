export const PORTFOLIO_SOURCES = {
  MIXED: "mixed",
  FUNDBAZAAR: "fundbazaar",
  BAJAJ_BROKING: "bajaj_broking",
  ANGEL_ONE: "angel_one",
  ULIP: "ulip",
  GROWVEST_STANDARD: "growvest_standard",
  MANUAL: "manual"
};

export const PORTFOLIO_ADMIN_SCOPES = {
  FUNDBAZAAR: "fundbazaar",
  BAJAJ_DELIVERY: "bajaj_delivery",
  BROKER_DELIVERY: "broker_delivery",
  TRADING: "trading",
  ULIP: "ulip",
  MANUAL: "manual",
  GENERIC_OTHER: "generic_other",
  ENTIRE: "entire"
};

export const PORTFOLIO_ADMIN_SCOPE_LABELS = {
  [PORTFOLIO_ADMIN_SCOPES.FUNDBAZAAR]: "Fundbazaar",
  [PORTFOLIO_ADMIN_SCOPES.BAJAJ_DELIVERY]: "Bajaj Delivery",
  [PORTFOLIO_ADMIN_SCOPES.BROKER_DELIVERY]: "Broker Delivery",
  [PORTFOLIO_ADMIN_SCOPES.TRADING]: "Trading / Intraday",
  [PORTFOLIO_ADMIN_SCOPES.ULIP]: "ULIP",
  [PORTFOLIO_ADMIN_SCOPES.MANUAL]: "Manual Portfolio",
  [PORTFOLIO_ADMIN_SCOPES.GENERIC_OTHER]: "Generic / Other",
  [PORTFOLIO_ADMIN_SCOPES.ENTIRE]: "Entire Portfolio"
};

export const PORTFOLIO_SOURCE_LABELS = {
  [PORTFOLIO_SOURCES.MIXED]: "Multiple Sources",
  [PORTFOLIO_SOURCES.FUNDBAZAAR]: "Fundbazaar",
  [PORTFOLIO_SOURCES.BAJAJ_BROKING]: "Bajaj Broking",
  [PORTFOLIO_SOURCES.ANGEL_ONE]: "Angel One",
  [PORTFOLIO_SOURCES.ULIP]: "ULIP",
  [PORTFOLIO_SOURCES.GROWVEST_STANDARD]: "GrowVest Standard",
  [PORTFOLIO_SOURCES.MANUAL]: "Manual"
};


export const PORTFOLIO_REPORT_TYPES = {
  FUNDBAZAAR_CLIENT_VALUATION: "fundbazaar_client_valuation",
  FUNDBAZAAR_LEDGER: "fundbazaar_portfolio_ledger",
  FUNDBAZAAR_WEB_WRAPPER: "fundbazaar_web_wrapper",
  BAJAJ_DELIVERY: "bajaj_delivery",
  BAJAJ_INTRADAY: "bajaj_intraday",
  BAJAJ_COMBINED: "bajaj_combined",
  ANGEL_ONE_DP_STATEMENT: "angel_one_dp_statement",
  ULIP_PORTFOLIO: "ulip_portfolio",
  GROWVEST_STANDARD: "growvest_standard",
  UNKNOWN: "unknown"
};

export const PORTFOLIO_REPORT_LABELS = {
  [PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_CLIENT_VALUATION]: "Client Wise Valuation (.xls/.xlsx)",
  [PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_LEDGER]: "Portfolio Ledger · Not Applicable",
  [PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_WEB_WRAPPER]: "Client Wise Valuation · Web Wrapper",
  [PORTFOLIO_REPORT_TYPES.BAJAJ_DELIVERY]: "Delivery Holdings",
  [PORTFOLIO_REPORT_TYPES.BAJAJ_INTRADAY]: "Intraday / Trade Book",
  [PORTFOLIO_REPORT_TYPES.BAJAJ_COMBINED]: "Delivery + Intraday",
  [PORTFOLIO_REPORT_TYPES.ANGEL_ONE_DP_STATEMENT]: "DP Transaction Cum Holding (PDF/XLS/XLSX/CSV)",
  [PORTFOLIO_REPORT_TYPES.ULIP_PORTFOLIO]: "ULIP Portfolio",
  [PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD]: "GrowVest Standard Import",
  [PORTFOLIO_REPORT_TYPES.UNKNOWN]: "Unrecognised Report"
};

export const PORTFOLIO_ADAPTER_STATUS = {
  READY: "ready",
  DETECTED_NOT_ENABLED: "detected_not_enabled",
  MAPPING_REQUIRED: "mapping_required",
  NEEDS_PACKAGE: "needs_package",
  UNSUPPORTED: "unsupported"
};

export const PORTFOLIO_PRODUCT_TYPES = {
  MUTUAL_FUND: "mutual_fund",
  STOCK_DELIVERY: "stock_delivery",
  ULIP: "ulip",
  PMS: "pms",
  BOND: "bond",
  FIXED_DEPOSIT: "fixed_deposit",
  GOLD: "gold",
  ETF: "etf",
  REAL_ESTATE: "real_estate",
  OTHER: "other"
};

export const PORTFOLIO_PRODUCT_LABELS = {
  [PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND]: "Mutual Fund",
  [PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY]: "Stock - Delivery",
  [PORTFOLIO_PRODUCT_TYPES.ULIP]: "ULIP",
  [PORTFOLIO_PRODUCT_TYPES.PMS]: "PMS",
  [PORTFOLIO_PRODUCT_TYPES.BOND]: "Bond",
  [PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT]: "Fixed Deposit",
  [PORTFOLIO_PRODUCT_TYPES.GOLD]: "Gold",
  [PORTFOLIO_PRODUCT_TYPES.ETF]: "ETF",
  [PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE]: "Real Estate",
  [PORTFOLIO_PRODUCT_TYPES.OTHER]: "Other"
};



export const GENERIC_IMPORT_FIELD_DEFINITIONS = [
  { key: "investorName", label: "Investor Name", group: "identity" },
  { key: "pan", label: "PAN", group: "identity" },
  { key: "clientCode", label: "Client Code", group: "identity" },
  { key: "productType", label: "Investment Type", group: "classification" },
  { key: "investmentMode", label: "Investment Mode", group: "classification" },
  { key: "transactionType", label: "Transaction Type", group: "classification" },
  { key: "provider", label: "Provider / Broker", group: "classification" },
  { key: "instrumentName", label: "Investment Name", group: "holding" },
  { key: "symbol", label: "Symbol", group: "holding" },
  { key: "isin", label: "ISIN", group: "holding" },
  { key: "accountReference", label: "Account / Folio / Policy No.", group: "holding" },
  { key: "exchange", label: "Exchange", group: "holding" },
  { key: "purchaseDate", label: "Purchase / Start Date", group: "holding" },
  { key: "quantity", label: "Units / Quantity", group: "valuation" },
  { key: "averagePurchaseRate", label: "Average Purchase NAV / Rate", group: "valuation" },
  { key: "investedAmount", label: "Invested Amount", group: "valuation" },
  { key: "currentRate", label: "Current NAV / Rate", group: "valuation" },
  { key: "currentValue", label: "Current Value", group: "valuation" },
  { key: "valuationDate", label: "NAV / Valuation Date", group: "valuation" },
  { key: "transactionDate", label: "Transaction Date", group: "transaction" },
  { key: "transactionQuantity", label: "Transaction Units / Quantity", group: "transaction" },
  { key: "transactionRate", label: "Transaction NAV / Rate", group: "transaction" },
  { key: "transactionAmount", label: "Transaction Amount", group: "transaction" },
  { key: "transactionReference", label: "Transaction / Order ID", group: "transaction" },
  { key: "maturityDate", label: "Maturity Date", group: "other" },
  { key: "goalName", label: "Goal / Bucket List", group: "other" },
  { key: "notes", label: "Notes", group: "other" }
];

export const GENERIC_INVESTMENT_MODES = [
  "SIP",
  "Lump Sum",
  "Both",
  "Delivery",
  "One Time",
  "Recurring",
  "Other"
];

export const GENERIC_TRANSACTION_TYPES = [
  "Purchase",
  "SIP",
  "Lump Sum",
  "Redemption",
  "Switch In",
  "Switch Out",
  "Dividend",
  "Buy",
  "Sell",
  "Deposit",
  "Withdrawal",
  "Interest",
  "Maturity",
  "Transfer",
  "Other"
];

export const MUTUAL_FUND_INVESTMENT_MODES = ["SIP", "Lump Sum", "Both"];

export const PORTFOLIO_MATCH_STATUS = {
  VERIFIED: "verified",
  REVIEW: "review_required",
  UNMATCHED: "unmatched",
  CONFLICT: "conflict",
  DUPLICATE: "duplicate"
};


export const PORTFOLIO_RECONCILIATION_STATUS = {
  VERIFIED: "verified",
  NEEDS_REVIEW: "needs_review",
  MISMATCH: "mismatch",
  STALE: "stale",
  MISSING_SOURCE: "missing_source",
  OWNERSHIP_CONFLICT: "ownership_conflict"
};

export const PORTFOLIO_RECONCILIATION_LABELS = {
  [PORTFOLIO_RECONCILIATION_STATUS.VERIFIED]: "Verified",
  [PORTFOLIO_RECONCILIATION_STATUS.NEEDS_REVIEW]: "Needs Review",
  [PORTFOLIO_RECONCILIATION_STATUS.MISMATCH]: "Mismatch",
  [PORTFOLIO_RECONCILIATION_STATUS.STALE]: "Stale",
  [PORTFOLIO_RECONCILIATION_STATUS.MISSING_SOURCE]: "Missing Source",
  [PORTFOLIO_RECONCILIATION_STATUS.OWNERSHIP_CONFLICT]: "Ownership Conflict"
};

export const PORTFOLIO_RECONCILIATION_THRESHOLDS = {
  FRESH_DAYS: 3,
  STALE_DAYS: 7,
  CRITICAL_STALE_DAYS: 31,
  VALUE_TOLERANCE_PERCENT: 1,
  VALUE_TOLERANCE_RUPEES: 5
};

export const PORTFOLIO_IMPORT_STATUS = {
  AWAITING_REVIEW: "awaiting_review",
  PROCESSING: "processing",
  COMPLETED: "completed",
  PARTIAL: "partial",
  FAILED: "failed"
};

export const PORTFOLIO_MAX_FILES_PER_BATCH = 100;
export const PORTFOLIO_MAX_FILE_SIZE = 8 * 1024 * 1024;

export function portfolioAdministrationScope(position = {}) {
  const source = String(position.source || PORTFOLIO_SOURCES.MANUAL);
  const productType = String(position.productType || PORTFOLIO_PRODUCT_TYPES.OTHER);

  // Source-owned manual holdings stay in Manual Portfolio even when the
  // investment type itself is ULIP/Mutual Fund/etc. This keeps cleanup scopes
  // mutually exclusive and prevents one holding appearing in two delete groups.
  if (source === PORTFOLIO_SOURCES.MANUAL) return PORTFOLIO_ADMIN_SCOPES.MANUAL;
  if (source === PORTFOLIO_SOURCES.FUNDBAZAAR) return PORTFOLIO_ADMIN_SCOPES.FUNDBAZAAR;
  if (source === PORTFOLIO_SOURCES.BAJAJ_BROKING && productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) {
    return PORTFOLIO_ADMIN_SCOPES.BAJAJ_DELIVERY;
  }
  if (source === PORTFOLIO_SOURCES.ANGEL_ONE && productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) {
    return PORTFOLIO_ADMIN_SCOPES.BROKER_DELIVERY;
  }
  if (source === PORTFOLIO_SOURCES.ULIP || productType === PORTFOLIO_PRODUCT_TYPES.ULIP) {
    return PORTFOLIO_ADMIN_SCOPES.ULIP;
  }
  return PORTFOLIO_ADMIN_SCOPES.GENERIC_OTHER;
}

export function portfolioAssetClass(productType, nature = "") {
  const text = String(nature || "").toLowerCase();
  if (productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY || productType === PORTFOLIO_PRODUCT_TYPES.ETF) return "Equity";
  if (productType === PORTFOLIO_PRODUCT_TYPES.ULIP) return "Insurance";
  if (productType === PORTFOLIO_PRODUCT_TYPES.BOND || productType === PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT) return "Debt";
  if (productType === PORTFOLIO_PRODUCT_TYPES.GOLD) return "Gold";
  if (productType === PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE) return "Real Estate";
  if (/^eq\b|equity|mcap|flex|focus|value|large|mid|small/.test(text)) return "Equity";
  if (/debt|bond|bankpsu|gilt|income|credit/.test(text)) return "Debt";
  if (/liquid|money market|overnight/.test(text)) return "Liquid";
  if (/hybrid|balanced|multi asset/.test(text)) return "Other";
  return "Other";
}

export function positionGoal(position = {}) {
  const allocation = Array.isArray(position.goalAllocations) ? position.goalAllocations[0] : null;
  return allocation?.goalId ? allocation : null;
}
