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
    key: "assetClass",
    label: "Asset Class",
    required: true,
    aliases: ["asset class", "asset category", "category", "investment category", "type"]
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
  "quantity"
];

export const DATA_IMPORT_SAMPLE_ROWS = [
  {
    "Instrument": "Parag Parikh Flexi Cap Fund",
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
