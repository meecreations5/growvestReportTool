import { ASSET_CLASS_OPTIONS, MONTH_OPTIONS } from "@/lib/constants/report";

export { MONTH_OPTIONS };

export const DATA_IMPORT_STATUS = {
  READY: "ready",
  IMPORTED: "imported",
  FAILED: "failed",
  ARCHIVED: "archived"
};

export const DATA_IMPORT_STATUS_LABELS = {
  [DATA_IMPORT_STATUS.READY]: "Ready for report",
  [DATA_IMPORT_STATUS.IMPORTED]: "Used in report",
  [DATA_IMPORT_STATUS.FAILED]: "Validation failed",
  [DATA_IMPORT_STATUS.ARCHIVED]: "Archived"
};

export const DATA_IMPORT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const DATA_IMPORT_MAX_ROWS = 300;
export const DATA_IMPORT_ACCEPT = ".csv,.xlsx,.xls";

export const DATA_IMPORT_FIELDS = [
  {
    key: "instrumentName",
    label: "Instrument",
    required: true,
    aliases: ["instrument", "instrument name", "scheme", "scheme name", "fund", "fund name", "security", "security name"]
  },
  {
    key: "investmentType",
    label: "Investment Type",
    required: false,
    aliases: ["investment type", "product type", "portfolio type", "security type", "instrument type"]
  },
  {
    key: "investmentMode",
    label: "Investment Mode",
    required: false,
    aliases: ["investment mode", "mode", "sip lump sum", "sip/lump sum", "holding mode"]
  },
  {
    key: "provider",
    label: "Provider / Broker",
    required: false,
    aliases: ["provider", "broker", "platform", "insurer", "amc"]
  },
  {
    key: "goalName",
    label: "Goal / Bucket List",
    required: false,
    aliases: ["goal", "goal name", "bucket list", "bucket list goal", "goal corpus"]
  },
  {
    key: "isin",
    label: "ISIN",
    required: false,
    aliases: ["isin", "isin code"]
  },
  {
    key: "folioNo",
    label: "Folio / Account No",
    required: false,
    aliases: ["folio", "folio no", "folio number", "account no", "account number", "policy number"]
  },
  {
    key: "currentNav",
    label: "Current NAV / Rate",
    required: false,
    aliases: ["current nav", "curr nav", "nav", "current rate", "market rate", "price"]
  },
  {
    key: "navDate",
    label: "NAV / Valuation Date",
    required: false,
    aliases: ["nav date", "valuation date", "price date", "as of date"]
  },
  {
    key: "assetClass",
    label: "Asset Class",
    required: true,
    aliases: ["asset class", "asset category", "category", "investment category", "asset type"]
  },
  {
    key: "openingValue",
    label: "Opening Value",
    required: false,
    aliases: ["opening value", "opening balance", "beginning value", "previous value", "opening portfolio value"]
  },
  {
    key: "investment",
    label: "New Investment",
    required: false,
    aliases: ["investment", "new investment", "fresh investment", "addition", "contribution", "purchase", "inflow"]
  },
  {
    key: "withdrawal",
    label: "Withdrawal",
    required: false,
    aliases: ["withdrawal", "withdrawals", "redemption", "outflow", "amount withdrawn"]
  },
  {
    key: "profitLoss",
    label: "Profit / Loss",
    required: false,
    aliases: ["profit loss", "profit/loss", "gain loss", "gain/loss", "p&l", "pnl", "investment gain", "monthly gain"]
  },
  {
    key: "currentValue",
    label: "Closing / Current Value",
    required: true,
    aliases: ["current value", "closing value", "closing balance", "market value", "portfolio value", "valuation"]
  },
  {
    key: "returnPercentage",
    label: "Return %",
    required: false,
    aliases: ["return", "return %", "return percentage", "monthly return", "monthly return %", "roi"]
  },
  {
    key: "monthlySip",
    label: "Monthly SIP",
    required: false,
    aliases: ["monthly sip", "sip", "sip amount", "monthly contribution", "recurring investment"]
  },
  {
    key: "quantity",
    label: "Quantity",
    required: false,
    aliases: ["quantity", "qty", "units", "unit balance"]
  },
  {
    key: "transactionDate",
    label: "Transaction Date",
    required: false,
    aliases: ["transaction date", "date", "trade date", "investment date", "statement date"]
  },
  {
    key: "notes",
    label: "Notes",
    required: false,
    aliases: ["notes", "note", "remarks", "remark", "comments", "description"]
  }
];

export const DATA_IMPORT_NUMERIC_FIELDS = [
  "openingValue",
  "investment",
  "withdrawal",
  "profitLoss",
  "currentValue",
  "returnPercentage",
  "monthlySip",
  "quantity",
  "currentNav"
];

export const DATA_IMPORT_SAMPLE_ROWS = [
  {
    "Instrument": "Parag Parikh Flexi Cap Fund",
    "Investment Type": "Mutual Fund",
    "Investment Mode": "SIP",
    "Provider / Broker": "Fundbazaar",
    "Goal / Bucket List": "Long-term Wealth",
    "Current NAV / Rate": 82.45,
    "NAV / Valuation Date": "2026-03-31",
    "Asset Class": "Equity",
    "Opening Value": 185000,
    "New Investment": 9000,
    "Withdrawal": 0,
    "Profit / Loss": 22000,
    "Closing / Current Value": 216000,
    "Return %": 11.89,
    "Monthly SIP": 9000,
    "Quantity": "",
    "Transaction Date": "2026-03-31",
    "Notes": "Linked to long-term wealth goal"
  },
  {
    "Instrument": "HDFC Short Term Debt Fund",
    "Investment Type": "Mutual Fund",
    "Investment Mode": "Lump Sum",
    "Provider / Broker": "Fundbazaar",
    "Goal / Bucket List": "General Wealth",
    "Current NAV / Rate": 31.72,
    "NAV / Valuation Date": "2026-03-31",
    "Asset Class": "Debt",
    "Opening Value": 120000,
    "New Investment": 5000,
    "Withdrawal": 0,
    "Profit / Loss": 1500,
    "Closing / Current Value": 126500,
    "Return %": 1.25,
    "Monthly SIP": 5000,
    "Quantity": "",
    "Transaction Date": "2026-03-31",
    "Notes": "Stability allocation"
  },
  {
    "Instrument": "Liquid Cash Reserve",
    "Investment Type": "Other",
    "Investment Mode": "Flexible",
    "Provider / Broker": "Manual",
    "Goal / Bucket List": "Emergency Fund",
    "Current NAV / Rate": "",
    "NAV / Valuation Date": "2026-03-31",
    "Asset Class": "Liquid",
    "Opening Value": 52000,
    "New Investment": 0,
    "Withdrawal": 10000,
    "Profit / Loss": 400,
    "Closing / Current Value": 42400,
    "Return %": 0.77,
    "Monthly SIP": 0,
    "Quantity": "",
    "Transaction Date": "2026-03-31",
    "Notes": "Emergency and near-term liquidity"
  }
];

export const NORMALISED_ASSET_CLASSES = ASSET_CLASS_OPTIONS;
