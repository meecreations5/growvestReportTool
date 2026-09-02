import * as XLSX from "xlsx";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import {
  PORTFOLIO_PRODUCT_TYPES,
  PORTFOLIO_SOURCES,
  portfolioAssetClass
} from "@/lib/constants/portfolio";
import { createPortfolioSnapshot, indiaDateKey } from "@/lib/server/portfolioServer";
import { stableHash } from "@/lib/server/portfolioImportParser";
import {
  GENERAL_WEALTH_BUCKET_NAME,
  generalWealthAllocation,
  isGeneralWealthName,
  normalisePortfolioGoalAllocations,
  portfolioAllocationStatus
} from "@/lib/portfolioGoalAllocation";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_INVESTORS = 100;
const MAX_TOTAL_ROWS = 10000;
const DEFAULT_ACCOUNT_CODE = "MANUAL";

const SHEETS = {
  INVESTORS: ["01_Investors", "Investors"],
  ACCOUNTS: ["02_Portfolio_Accounts", "Portfolio_Accounts", "Accounts"],
  HOLDINGS: ["03_Holdings", "Holdings", "Investor_Portfolios", "Portfolio_Holdings"],
  TRANSACTIONS: ["04_Transactions", "Transactions"],
  CASH: ["05_Cash_Ledger", "Cash_Ledger", "Cash Ledger"],
  INCOME: ["06_Income", "Income"],
  CORPORATE_ACTIONS: ["07_Corporate_Actions", "Corporate_Actions", "Corporate Actions"],
  CHARGES: ["08_Charges", "Charges"],
  GOALS: ["09_Goal_Allocation", "Goal_Allocation", "Goal Allocation"],
  RECONCILIATION: ["10_Reconciliation", "Reconciliation"],
  NOTES: ["11_Notes", "Notes"]
};

const IDENTITY_ALIASES = {
  investorIdInput: ["investor id", "growvest investor id"],
  clientCodeInput: ["client code", "investor client code", "growvest client code", "client id"],
  investorNameInput: ["investor name", "client name", "growvest investor name"],
  panInput: ["pan", "pan no", "pan number", "investor pan"],
  accountCode: ["portfolio account code", "account code", "pms account code", "portfolio code"]
};

const TYPE_MAP = new Map([
  ["mutual fund", PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND], ["mf", PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND], ["sip", PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND],
  ["direct equity", PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY], ["delivery equity", PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY], ["stock delivery", PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY], ["equity", PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY],
  ["ulip", PORTFOLIO_PRODUCT_TYPES.ULIP], ["pms", PORTFOLIO_PRODUCT_TYPES.PMS], ["bond", PORTFOLIO_PRODUCT_TYPES.BOND], ["bonds", PORTFOLIO_PRODUCT_TYPES.BOND],
  ["fixed deposit", PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT], ["fd", PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT], ["gold", PORTFOLIO_PRODUCT_TYPES.GOLD], ["etf", PORTFOLIO_PRODUCT_TYPES.ETF], ["exchange traded fund", PORTFOLIO_PRODUCT_TYPES.ETF],
  ["real estate", PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE], ["other", PORTFOLIO_PRODUCT_TYPES.OTHER], ["cash", PORTFOLIO_PRODUCT_TYPES.OTHER]
]);

function clean(value) { return String(value ?? "").trim(); }
function normaliseHeader(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function normaliseCode(value) { return clean(value).toUpperCase().replace(/\s+/g, ""); }
function normaliseName(value) { return clean(value).toLowerCase().replace(/\brepresented\s+by\b.*$/i, "").replace(/\brep\s+by\b.*$/i, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function normalisePan(value) { const pan = clean(value).toUpperCase().replace(/[^A-Z0-9]/g, ""); return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) ? pan : ""; }
function number(value) { const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^0-9.+-]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round((Number(value) || 0) * factor) / factor; }
function truthy(value) { return ["yes", "y", "true", "1", "active"].includes(clean(value).toLowerCase()); }
function isGeneralWealth(value) { return isGeneralWealthName(value); }

function excelDate(value) {
  if (!value) return "";
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function normaliseProductType(value) {
  const text = normaliseHeader(value);
  if (TYPE_MAP.has(text)) return TYPE_MAP.get(text);
  if (text.includes("mutual")) return PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND;
  if (text.includes("equity") || text.includes("stock")) return PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY;
  if (text.includes("ulip")) return PORTFOLIO_PRODUCT_TYPES.ULIP;
  if (text.includes("pms")) return PORTFOLIO_PRODUCT_TYPES.PMS;
  if (text.includes("bond") || text.includes("ncd") || text.includes("debt")) return PORTFOLIO_PRODUCT_TYPES.BOND;
  if (text.includes("deposit") || text === "fd") return PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT;
  if (text.includes("gold") || text.includes("sgb")) return PORTFOLIO_PRODUCT_TYPES.GOLD;
  if (text.includes("etf") || text.includes("exchange traded")) return PORTFOLIO_PRODUCT_TYPES.ETF;
  if (text.includes("real")) return PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE;
  return PORTFOLIO_PRODUCT_TYPES.OTHER;
}

function findSheet(workbook, aliases) {
  const exact = aliases.find((name) => workbook.SheetNames.includes(name));
  if (exact) return exact;
  const aliasSet = new Set(aliases.map(normaliseHeader));
  return workbook.SheetNames.find((name) => aliasSet.has(normaliseHeader(name))) || "";
}

function matrixFor(workbook, aliases) {
  const sheetName = findSheet(workbook, aliases);
  if (!sheetName) return { sheetName: "", headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
  const headerIndex = matrix.findIndex((row) => row.filter((value) => clean(value)).length >= 2);
  if (headerIndex < 0) return { sheetName, headers: [], rows: [] };
  return {
    sheetName,
    headers: matrix[headerIndex].map(clean),
    rows: matrix.slice(headerIndex + 1).map((row, index) => ({ values: row, rowNumber: headerIndex + index + 2 })).filter((row) => row.values.some((value) => clean(value)))
  };
}

function buildColumns(headers, aliases) {
  const columns = {};
  headers.forEach((header, index) => {
    const normal = normaliseHeader(header);
    Object.entries(aliases).forEach(([field, names]) => {
      if (columns[field] == null && names.includes(normal)) columns[field] = index;
    });
  });
  return columns;
}

function cell(row, columns, field) {
  const index = columns[field];
  return index == null ? "" : row.values[index];
}

function identity(row, columns) {
  return {
    investorIdInput: clean(cell(row, columns, "investorIdInput")),
    clientCodeInput: clean(cell(row, columns, "clientCodeInput")),
    investorNameInput: clean(cell(row, columns, "investorNameInput")),
    panInput: clean(cell(row, columns, "panInput")),
    accountCode: normaliseCode(cell(row, columns, "accountCode")) || DEFAULT_ACCOUNT_CODE
  };
}

function parseInvestors(data) {
  const aliases = { ...IDENTITY_ALIASES, notes: ["notes", "remarks", "remark"] };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row) => ({ rowNumber: row.rowNumber, ...identity(row, columns), notes: clean(cell(row, columns, "notes")) }));
}

function parseAccounts(data) {
  const aliases = {
    ...IDENTITY_ALIASES,
    accountName: ["portfolio account name", "account name", "pms account name"],
    strategy: ["strategy", "portfolio strategy", "mandate"],
    provider: ["provider platform", "provider", "platform", "broker", "pms provider"],
    openingDate: ["account opening date", "opening date", "start date"],
    status: ["status", "account status"],
    baseCurrency: ["base currency", "currency"],
    benchmark: ["benchmark", "benchmark index"],
    discretionary: ["discretionary", "is discretionary"],
    notes: ["notes", "remarks", "remark"]
  };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row) => ({
    rowNumber: row.rowNumber,
    ...identity(row, columns),
    accountName: clean(cell(row, columns, "accountName")) || "Manual Portfolio",
    strategy: clean(cell(row, columns, "strategy")),
    provider: clean(cell(row, columns, "provider")) || "Manual",
    openingDate: excelDate(cell(row, columns, "openingDate")),
    status: clean(cell(row, columns, "status")) || "active",
    baseCurrency: clean(cell(row, columns, "baseCurrency")) || "INR",
    benchmark: clean(cell(row, columns, "benchmark")),
    discretionary: truthy(cell(row, columns, "discretionary")),
    notes: clean(cell(row, columns, "notes"))
  }));
}

function parseHoldings(data) {
  const aliases = {
    ...IDENTITY_ALIASES,
    holdingKey: ["holding key", "holding id", "position key", "position id"],
    productType: ["investment type", "asset type", "product type", "type"],
    instrumentName: ["investment name", "instrument name", "scheme name", "stock name", "fund name", "name"],
    provider: ["provider", "broker", "institution", "insurer", "platform"],
    investmentMode: ["investment mode", "mode", "sip lump sum", "sip/lump sum"],
    folioNo: ["folio", "folio no", "account no", "account number", "policy no", "policy number", "folio account no", "folio / account no"],
    isin: ["isin"], symbol: ["symbol", "scrip", "ticker"], exchange: ["exchange"],
    quantity: ["quantity", "qty", "units", "units quantity", "units / quantity"],
    averageBuyRate: ["average buy rate", "avg buy rate", "average price", "purchase nav", "purchase rate", "avg price", "average buy purchase nav", "average buy / purchase nav"],
    totalInvested: ["invested amount", "total invested", "investment amount", "cost value"],
    currentRate: ["current nav", "current rate", "ltp", "market price", "nav", "current nav rate", "current nav / rate"],
    currentValue: ["current value", "market value", "fund value", "valuation"],
    valuationDate: ["valuation date", "nav date", "price date", "as of date"],
    purchaseDate: ["purchase date", "investment date", "start date"],
    maturityDate: ["maturity date"], monthlySip: ["monthly sip", "sip amount", "monthly contribution"],
    goalName: ["goal", "goal bucket list", "goal / bucket list", "bucket list"],
    status: ["status", "holding status"], notes: ["notes", "remark", "remarks"]
  };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => {
    const id = identity(row, columns);
    const productType = normaliseProductType(cell(row, columns, "productType"));
    const quantity = number(cell(row, columns, "quantity"));
    const averageBuyRate = number(cell(row, columns, "averageBuyRate"));
    const currentRate = number(cell(row, columns, "currentRate"));
    let totalInvested = number(cell(row, columns, "totalInvested"));
    let currentValue = number(cell(row, columns, "currentValue"));
    if (!totalInvested && quantity && averageBuyRate) totalInvested = quantity * averageBuyRate;
    if (!currentValue && quantity && currentRate) currentValue = quantity * currentRate;
    return {
      rowNumber: row.rowNumber,
      ...id,
      holdingKey: clean(cell(row, columns, "holdingKey")) || `HLD-${String(index + 1).padStart(4, "0")}`,
      productType,
      instrumentName: clean(cell(row, columns, "instrumentName")),
      provider: clean(cell(row, columns, "provider")) || "Manual",
      investmentMode: clean(cell(row, columns, "investmentMode")),
      folioNo: clean(cell(row, columns, "folioNo")), isin: clean(cell(row, columns, "isin")), symbol: clean(cell(row, columns, "symbol")), exchange: clean(cell(row, columns, "exchange")),
      quantity, averageBuyRate, totalInvested: round(totalInvested), currentRate, currentValue: round(currentValue),
      valuationDate: excelDate(cell(row, columns, "valuationDate")) || indiaDateKey(),
      purchaseDate: excelDate(cell(row, columns, "purchaseDate")), maturityDate: excelDate(cell(row, columns, "maturityDate")),
      monthlySip: number(cell(row, columns, "monthlySip")), goalName: clean(cell(row, columns, "goalName")),
      status: clean(cell(row, columns, "status")) || "active", notes: clean(cell(row, columns, "notes"))
    };
  });
}

function parseTransactions(data) {
  const aliases = {
    ...IDENTITY_ALIASES,
    transactionKey: ["transaction key", "transaction id", "trade id", "entry id"],
    transactionDate: ["transaction date", "trade date", "date"],
    transactionType: ["transaction type", "type", "action"],
    holdingKey: ["holding key", "holding id", "position key"], instrumentName: ["investment name", "instrument name", "scheme name", "stock name", "name"],
    quantity: ["quantity", "qty", "units"], rate: ["rate nav", "rate", "nav", "price", "transaction rate"],
    grossAmount: ["gross amount", "amount", "transaction amount"], charges: ["charges", "brokerage charges"], taxes: ["taxes", "tax", "stt gst taxes"],
    netAmount: ["net amount", "settlement amount"], realizedPnl: ["realized p l", "realized pnl", "realised pnl", "realized profit loss"],
    reference: ["reference", "order id", "transaction reference", "trade reference"], notes: ["notes", "remarks", "remark"]
  };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => {
    const grossAmount = number(cell(row, columns, "grossAmount"));
    const charges = number(cell(row, columns, "charges"));
    const taxes = number(cell(row, columns, "taxes"));
    let netAmount = number(cell(row, columns, "netAmount"));
    if (!netAmount && grossAmount) netAmount = grossAmount - charges - taxes;
    return {
      rowNumber: row.rowNumber, ...identity(row, columns),
      transactionKey: clean(cell(row, columns, "transactionKey")) || `TX-${String(index + 1).padStart(5, "0")}`,
      transactionDate: excelDate(cell(row, columns, "transactionDate")), transactionType: clean(cell(row, columns, "transactionType")),
      holdingKey: clean(cell(row, columns, "holdingKey")), instrumentName: clean(cell(row, columns, "instrumentName")),
      quantity: number(cell(row, columns, "quantity")), rate: number(cell(row, columns, "rate")), grossAmount: round(grossAmount), charges: round(charges), taxes: round(taxes), netAmount: round(netAmount),
      realizedPnl: round(number(cell(row, columns, "realizedPnl"))), reference: clean(cell(row, columns, "reference")), notes: clean(cell(row, columns, "notes"))
    };
  });
}

function parseCash(data) {
  const aliases = {
    ...IDENTITY_ALIASES,
    entryKey: ["cash entry key", "entry key", "cash id", "entry id"], entryDate: ["entry date", "date", "transaction date"],
    entryType: ["cash entry type", "entry type", "type"], amount: ["amount", "cash amount"], reference: ["reference", "bank reference", "transaction reference"], notes: ["notes", "remarks", "remark"]
  };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => ({
    rowNumber: row.rowNumber, ...identity(row, columns), entryKey: clean(cell(row, columns, "entryKey")) || `CASH-${String(index + 1).padStart(5, "0")}`,
    entryDate: excelDate(cell(row, columns, "entryDate")), entryType: clean(cell(row, columns, "entryType")), amount: round(number(cell(row, columns, "amount"))), reference: clean(cell(row, columns, "reference")), notes: clean(cell(row, columns, "notes"))
  }));
}

function parseIncome(data) {
  const aliases = {
    ...IDENTITY_ALIASES,
    incomeKey: ["income key", "income id", "entry id"], incomeDate: ["income date", "date"], incomeType: ["income type", "type"],
    holdingKey: ["holding key", "holding id"], instrumentName: ["investment name", "instrument name", "name"], grossAmount: ["gross amount", "amount"], tds: ["tds", "tax deducted"], netAmount: ["net amount", "received amount"], reference: ["reference", "transaction reference"], notes: ["notes", "remarks", "remark"]
  };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => {
    const gross = number(cell(row, columns, "grossAmount"));
    const tds = number(cell(row, columns, "tds"));
    const net = number(cell(row, columns, "netAmount")) || (gross ? gross - tds : 0);
    return { rowNumber: row.rowNumber, ...identity(row, columns), incomeKey: clean(cell(row, columns, "incomeKey")) || `INC-${String(index + 1).padStart(5, "0")}`, incomeDate: excelDate(cell(row, columns, "incomeDate")), incomeType: clean(cell(row, columns, "incomeType")), holdingKey: clean(cell(row, columns, "holdingKey")), instrumentName: clean(cell(row, columns, "instrumentName")), grossAmount: round(gross), tds: round(tds), netAmount: round(net), reference: clean(cell(row, columns, "reference")), notes: clean(cell(row, columns, "notes")) };
  });
}

function parseCorporateActions(data) {
  const aliases = {
    ...IDENTITY_ALIASES,
    actionKey: ["action key", "corporate action key", "action id"], actionDate: ["action date", "date"], actionType: ["action type", "corporate action type", "type"],
    holdingKey: ["holding key", "holding id"], instrumentName: ["investment name", "instrument name", "name"], ratio: ["ratio", "action ratio"], quantityChange: ["quantity change", "units change", "shares change"], cashAmount: ["cash amount", "amount"], newInstrumentName: ["new investment name", "new instrument name"], reference: ["reference", "corporate action reference"], notes: ["notes", "remarks", "remark"]
  };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => ({ rowNumber: row.rowNumber, ...identity(row, columns), actionKey: clean(cell(row, columns, "actionKey")) || `CA-${String(index + 1).padStart(5, "0")}`, actionDate: excelDate(cell(row, columns, "actionDate")), actionType: clean(cell(row, columns, "actionType")), holdingKey: clean(cell(row, columns, "holdingKey")), instrumentName: clean(cell(row, columns, "instrumentName")), ratio: clean(cell(row, columns, "ratio")), quantityChange: number(cell(row, columns, "quantityChange")), cashAmount: round(number(cell(row, columns, "cashAmount"))), newInstrumentName: clean(cell(row, columns, "newInstrumentName")), reference: clean(cell(row, columns, "reference")), notes: clean(cell(row, columns, "notes")) }));
}

function parseCharges(data) {
  const aliases = {
    ...IDENTITY_ALIASES,
    chargeKey: ["charge key", "charge id", "entry id"], chargeDate: ["charge date", "date"], chargeType: ["charge type", "type"],
    amount: ["amount", "base amount"], gst: ["gst", "tax"], totalAmount: ["total amount", "gross amount"], reference: ["reference", "transaction reference"], notes: ["notes", "remarks", "remark"]
  };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => {
    const amount = number(cell(row, columns, "amount")); const gst = number(cell(row, columns, "gst")); const total = number(cell(row, columns, "totalAmount")) || amount + gst;
    return { rowNumber: row.rowNumber, ...identity(row, columns), chargeKey: clean(cell(row, columns, "chargeKey")) || `CHG-${String(index + 1).padStart(5, "0")}`, chargeDate: excelDate(cell(row, columns, "chargeDate")), chargeType: clean(cell(row, columns, "chargeType")), amount: round(amount), gst: round(gst), totalAmount: round(total), reference: clean(cell(row, columns, "reference")), notes: clean(cell(row, columns, "notes")) };
  });
}

function parseGoals(data) {
  const aliases = { ...IDENTITY_ALIASES, allocationKey: ["allocation key", "allocation id"], holdingKey: ["holding key", "holding id", "position key"], goalName: ["goal", "goal name", "goal bucket list", "goal / bucket list", "bucket list"], percentage: ["allocation percentage", "percentage", "allocation %", "allocation percent"], notes: ["notes", "remarks", "remark"] };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => ({ rowNumber: row.rowNumber, ...identity(row, columns), allocationKey: clean(cell(row, columns, "allocationKey")) || `GA-${String(index + 1).padStart(5, "0")}`, holdingKey: clean(cell(row, columns, "holdingKey")), goalName: clean(cell(row, columns, "goalName")), percentage: round(number(cell(row, columns, "percentage"))), notes: clean(cell(row, columns, "notes")) }));
}

function parseReconciliation(data) {
  const aliases = { ...IDENTITY_ALIASES, reconciliationKey: ["reconciliation key", "reconciliation id"], reconciliationDate: ["reconciliation date", "date", "as of date"], statementValue: ["statement value", "external statement value"], systemValue: ["system value", "growvest value"], status: ["status", "reconciliation status"], statementReference: ["statement reference", "statement file", "reference"], notes: ["notes", "remarks", "remark"] };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => ({ rowNumber: row.rowNumber, ...identity(row, columns), reconciliationKey: clean(cell(row, columns, "reconciliationKey")) || `REC-${String(index + 1).padStart(5, "0")}`, reconciliationDate: excelDate(cell(row, columns, "reconciliationDate")) || indiaDateKey(), statementValue: round(number(cell(row, columns, "statementValue"))), systemValueInput: round(number(cell(row, columns, "systemValue"))), status: clean(cell(row, columns, "status")), statementReference: clean(cell(row, columns, "statementReference")), notes: clean(cell(row, columns, "notes")) }));
}

function parseNotes(data) {
  const aliases = { ...IDENTITY_ALIASES, noteKey: ["note key", "note id"], noteDate: ["note date", "date"], category: ["category", "note category"], title: ["title", "subject"], note: ["note", "notes", "details"], visibility: ["visibility", "visible to"] };
  const columns = buildColumns(data.headers, aliases);
  return data.rows.map((row, index) => {
    const rawVisibility = clean(cell(row, columns, "visibility"));
    const visibility = rawVisibility.toLowerCase() === "investor" ? "Investor" : "Internal";
    return { rowNumber: row.rowNumber, ...identity(row, columns), noteKey: clean(cell(row, columns, "noteKey")) || `NOTE-${String(index + 1).padStart(5, "0")}`, noteDate: excelDate(cell(row, columns, "noteDate")) || indiaDateKey(), category: clean(cell(row, columns, "category")) || "Portfolio", title: clean(cell(row, columns, "title")), note: clean(cell(row, columns, "note")), visibility };
  });
}

export async function parseManualPortfolioWorkbook(file) {
  if (!file) throw new Error("Select a Manual Portfolio Management Excel file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Manual Portfolio Management Excel must be 15 MB or smaller.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  if (!workbook.SheetNames.length) throw new Error("The workbook does not contain any worksheets.");

  const datasets = {
    investors: parseInvestors(matrixFor(workbook, SHEETS.INVESTORS)),
    accounts: parseAccounts(matrixFor(workbook, SHEETS.ACCOUNTS)),
    holdings: parseHoldings(matrixFor(workbook, SHEETS.HOLDINGS)),
    transactions: parseTransactions(matrixFor(workbook, SHEETS.TRANSACTIONS)),
    cash: parseCash(matrixFor(workbook, SHEETS.CASH)),
    income: parseIncome(matrixFor(workbook, SHEETS.INCOME)),
    corporateActions: parseCorporateActions(matrixFor(workbook, SHEETS.CORPORATE_ACTIONS)),
    charges: parseCharges(matrixFor(workbook, SHEETS.CHARGES)),
    goals: parseGoals(matrixFor(workbook, SHEETS.GOALS)),
    reconciliation: parseReconciliation(matrixFor(workbook, SHEETS.RECONCILIATION)),
    notes: parseNotes(matrixFor(workbook, SHEETS.NOTES))
  };

  const totalRows = Object.values(datasets).reduce((sum, rows) => sum + rows.length, 0);
  if (!totalRows) throw new Error("No Manual Portfolio Management rows were found in the workbook.");
  if (totalRows > MAX_TOTAL_ROWS) throw new Error(`Manual Portfolio Management supports up to ${MAX_TOTAL_ROWS} rows per workbook.`);

  // Backward compatibility: old one-sheet files had no account master. Create a default account during resolution.
  return { fileName: clean(file.name), datasets, totalRows, workbookSheets: workbook.SheetNames };
}

function investorGoals(investor) {
  return Array.isArray(investor.bucketList) && investor.bucketList.length ? investor.bucketList : (Array.isArray(investor.goals) ? investor.goals : []);
}

function addLookup(map, key, investor) {
  if (!key) return;
  const list = map.get(key) || [];
  list.push(investor);
  map.set(key, list);
}

async function investorLookup() {
  const snapshot = await adminDb.collection("investors").get();
  const investors = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.isDeleted !== true && item.lifecycleStatus !== "deleted");
  const byId = new Map(investors.map((item) => [String(item.id), item]));
  const byClientCode = new Map(); const byPan = new Map(); const byName = new Map();
  investors.forEach((investor) => {
    addLookup(byClientCode, normaliseCode(investor.clientCode), investor);
    addLookup(byPan, normalisePan(investor.panNormalized || investor.panNumber), investor);
    addLookup(byName, normaliseName(investor.fullName || investor.name), investor);
  });
  return { investors, byId, byClientCode, byPan, byName };
}

function onlyUnique(list = []) { return [...new Map(list.filter(Boolean).map((item) => [String(item.id), item])).values()]; }

function matchInvestor(row, lookup) {
  const evidence = [];
  if (row.investorIdInput) evidence.push({ type: "Investor ID", strong: true, investors: lookup.byId.get(row.investorIdInput) ? [lookup.byId.get(row.investorIdInput)] : [] });
  if (row.panInput) evidence.push({ type: "PAN", strong: true, investors: normalisePan(row.panInput) ? (lookup.byPan.get(normalisePan(row.panInput)) || []) : [] });
  if (row.clientCodeInput) evidence.push({ type: "Client Code", strong: true, investors: lookup.byClientCode.get(normaliseCode(row.clientCodeInput)) || [] });
  if (row.investorNameInput) evidence.push({ type: "Investor Name", strong: false, investors: lookup.byName.get(normaliseName(row.investorNameInput)) || [] });
  if (!evidence.length) return { status: "unmatched", reason: "Investor identity is blank." };
  const strong = evidence.filter((item) => item.strong);
  const positive = strong.filter((item) => item.investors.length);
  const missing = strong.filter((item) => !item.investors.length);
  if (positive.length) {
    const candidates = onlyUnique(positive.flatMap((item) => item.investors));
    if (candidates.length !== 1) return { status: "conflict", reason: "PAN, Client Code or Investor ID point to different GrowVest investors." };
    if (missing.length) return { status: "conflict", reason: `${missing.map((item) => item.type).join(", ")} does not match an existing GrowVest investor.` };
    const investor = candidates[0];
    const weakConflict = evidence.filter((item) => !item.strong && item.investors.length).some((item) => item.investors.length !== 1 || String(item.investors[0].id) !== String(investor.id));
    if (weakConflict) return { status: "conflict", reason: "Investor Name conflicts with the supplied strong identity." };
    return { status: "matched", investor, matchedBy: positive.find((item) => item.investors.some((candidate) => candidate.id === investor.id))?.type || "Identity" };
  }
  if (missing.length) return { status: "unmatched", reason: `${missing.map((item) => item.type).join(", ")} does not match an existing GrowVest investor.` };
  const weak = onlyUnique(evidence.filter((item) => !item.strong).flatMap((item) => item.investors));
  if (weak.length === 1) return { status: "matched", investor: weak[0], matchedBy: "Investor Name" };
  if (weak.length > 1) return { status: "ambiguous", reason: "Investor Name is not unique. Add Client Code, PAN or Investor ID." };
  return { status: "unmatched", reason: "No GrowVest investor matches the supplied identity." };
}

function accountDocumentId(investorId, accountCode) { return `mpa_${stableHash([investorId, accountCode], 30)}`; }
function manualPositionId(investorId, accountCode, holdingKey, row = {}) { return `pos_${stableHash([investorId, PORTFOLIO_SOURCES.MANUAL, accountCode, holdingKey || row.isin || row.symbol || row.folioNo || row.instrumentName], 30)}`; }
function ledgerId(prefix, investorId, accountCode, key, natural = "") { return `${prefix}_${stableHash([investorId, accountCode, key || natural], 30)}`; }

function validateRequired(row, fields, sheet, issues) {
  const missing = fields.filter(([field]) => !clean(row[field])).map(([, label]) => label);
  if (missing.length) {
    issues.push({ sheet, rowNumber: row.rowNumber, status: "invalid", reason: `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required.`, investorNameInput: row.investorNameInput, clientCodeInput: row.clientCodeInput });
    return false;
  }
  return true;
}

function resolvedIdentity(row, match) {
  const investor = match.investor;
  return {
    ...row,
    investorId: investor.id,
    investorName: investor.fullName || investor.name || "Investor",
    clientCode: investor.clientCode || "",
    matchedBy: match.matchedBy,
    accountCode: normaliseCode(row.accountCode) || DEFAULT_ACCOUNT_CODE
  };
}

export async function resolveManualPortfolioWorkbook(parsed) {
  const lookup = await investorLookup();
  const issues = []; const warnings = []; const groups = new Map();
  const duplicateKeys = new Map();

  function groupFor(investor, matchedBy) {
    const group = groups.get(investor.id) || {
      investor,
      matchedBy: new Set(), accounts: [], holdings: [], transactions: [], cash: [], income: [], corporateActions: [], charges: [], goals: [], reconciliation: [], notes: [], warningCount: 0
    };
    if (matchedBy) group.matchedBy.add(matchedBy);
    groups.set(investor.id, group);
    return group;
  }

  const schemas = [
    ["accounts", "Portfolio Accounts", parsed.datasets.accounts, [["accountCode", "Portfolio Account Code"]]],
    ["holdings", "Holdings", parsed.datasets.holdings, [["accountCode", "Portfolio Account Code"], ["instrumentName", "Investment Name"]]],
    ["transactions", "Transactions", parsed.datasets.transactions, [["accountCode", "Portfolio Account Code"], ["transactionDate", "Transaction Date"], ["transactionType", "Transaction Type"]]],
    ["cash", "Cash Ledger", parsed.datasets.cash, [["accountCode", "Portfolio Account Code"], ["entryDate", "Entry Date"], ["entryType", "Entry Type"]]],
    ["income", "Income", parsed.datasets.income, [["accountCode", "Portfolio Account Code"], ["incomeDate", "Income Date"], ["incomeType", "Income Type"]]],
    ["corporateActions", "Corporate Actions", parsed.datasets.corporateActions, [["accountCode", "Portfolio Account Code"], ["actionDate", "Action Date"], ["actionType", "Action Type"]]],
    ["charges", "Charges", parsed.datasets.charges, [["accountCode", "Portfolio Account Code"], ["chargeDate", "Charge Date"], ["chargeType", "Charge Type"]]],
    ["goals", "Goal Allocation", parsed.datasets.goals, [["accountCode", "Portfolio Account Code"], ["holdingKey", "Holding Key"], ["goalName", "Goal Name"]]],
    ["reconciliation", "Reconciliation", parsed.datasets.reconciliation, [["accountCode", "Portfolio Account Code"], ["reconciliationDate", "Reconciliation Date"]]],
    ["notes", "Notes", parsed.datasets.notes, [["accountCode", "Portfolio Account Code"], ["note", "Note"]]]
  ];

  // Investors sheet is identity/reference only; validate every listed investor
  // but never create an import group from this sheet alone. This is critical
  // for Replace mode: a reference-only investor must not have Manual data
  // deleted unless that investor also has an account/holding/ledger row.
  for (const row of parsed.datasets.investors) {
    const match = matchInvestor(row, lookup);
    if (match.status !== "matched") issues.push({ sheet: "Investors", rowNumber: row.rowNumber, status: match.status, reason: match.reason, investorNameInput: row.investorNameInput, clientCodeInput: row.clientCodeInput, panInput: row.panInput });
  }

  for (const [key, label, rows, required] of schemas) {
    for (const row of rows) {
      if (!validateRequired(row, required, label, issues)) continue;
      const match = matchInvestor(row, lookup);
      if (match.status !== "matched") {
        issues.push({ sheet: label, rowNumber: row.rowNumber, status: match.status, reason: match.reason, investorNameInput: row.investorNameInput, clientCodeInput: row.clientCodeInput, panInput: row.panInput });
        continue;
      }
      const resolved = resolvedIdentity(row, match);
      const group = groupFor(match.investor, match.matchedBy);
      const accountId = accountDocumentId(match.investor.id, resolved.accountCode);
      resolved.accountId = accountId;

      let duplicateKey = "";
      if (key === "accounts") duplicateKey = `${match.investor.id}:${resolved.accountCode}`;
      if (key === "holdings") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.holdingKey).toUpperCase()}`;
      if (key === "transactions") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.transactionKey).toUpperCase()}`;
      if (key === "cash") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.entryKey).toUpperCase()}`;
      if (key === "income") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.incomeKey).toUpperCase()}`;
      if (key === "corporateActions") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.actionKey).toUpperCase()}`;
      if (key === "charges") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.chargeKey).toUpperCase()}`;
      if (key === "goals") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.allocationKey).toUpperCase()}`;
      if (key === "reconciliation") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.reconciliationKey).toUpperCase()}`;
      if (key === "notes") duplicateKey = `${match.investor.id}:${resolved.accountCode}:${clean(resolved.noteKey).toUpperCase()}`;
      const scopedDuplicateKey = `${key}:${duplicateKey}`;
      if (duplicateKey && duplicateKeys.has(scopedDuplicateKey)) {
        issues.push({ sheet: label, rowNumber: row.rowNumber, status: "duplicate", reason: `Duplicate ${label} key; first seen on row ${duplicateKeys.get(scopedDuplicateKey)}.`, investorNameInput: row.investorNameInput, clientCodeInput: row.clientCodeInput });
        continue;
      }
      if (duplicateKey) duplicateKeys.set(scopedDuplicateKey, row.rowNumber);
      group[key].push(resolved);
    }
  }

  const resolvedGroups = [...groups.values()];
  if (resolvedGroups.length > MAX_INVESTORS) throw new Error(`Manual Portfolio Management supports up to ${MAX_INVESTORS} investors per workbook.`);

  for (const group of resolvedGroups) {
    const accountCodes = new Set(group.accounts.map((item) => item.accountCode));
    [...group.holdings, ...group.transactions, ...group.cash, ...group.income, ...group.corporateActions, ...group.charges, ...group.goals, ...group.reconciliation, ...group.notes].forEach((row) => accountCodes.add(row.accountCode));
    for (const code of accountCodes) {
      if (!group.accounts.some((account) => account.accountCode === code)) {
        group.accounts.push({
          rowNumber: 0,
          investorId: group.investor.id,
          investorName: group.investor.fullName || group.investor.name || "Investor",
          clientCode: group.investor.clientCode || "",
          matchedBy: "Derived",
          accountCode: code || DEFAULT_ACCOUNT_CODE,
          accountId: accountDocumentId(group.investor.id, code || DEFAULT_ACCOUNT_CODE),
          accountName: code === DEFAULT_ACCOUNT_CODE ? "Manual Portfolio" : `Manual Portfolio ${code}`,
          strategy: "", provider: "Manual", openingDate: "", status: "active", baseCurrency: "INR", benchmark: "", discretionary: false, notes: ""
        });
      }
    }

    const holdingByKey = new Map();
    const explicitAllocationKeys = new Set(group.goals.map((allocation) => `${allocation.accountCode}:${clean(allocation.holdingKey).toUpperCase()}`));
    group.holdings.forEach((holding) => {
      holding.positionId = manualPositionId(group.investor.id, holding.accountCode, holding.holdingKey, holding);
      const holdingLookupKey = `${holding.accountCode}:${clean(holding.holdingKey).toUpperCase()}`;
      holdingByKey.set(holdingLookupKey, holding);
      if (!holding.instrumentName) return;
      if (holding.goalName && !explicitAllocationKeys.has(holdingLookupKey)) {
        group.goals.push({
          rowNumber: holding.rowNumber,
          investorId: holding.investorId,
          investorName: holding.investorName,
          clientCode: holding.clientCode,
          matchedBy: holding.matchedBy,
          accountCode: holding.accountCode,
          accountId: holding.accountId,
          allocationKey: `INLINE-${holding.holdingKey}`,
          holdingKey: holding.holdingKey,
          goalName: holding.goalName,
          percentage: 100,
          notes: "Imported from Holdings sheet"
        });
      }
    });

    const goals = investorGoals(group.investor);
    const allocationTotals = new Map();
    group.goals.forEach((allocation) => {
      const holding = holdingByKey.get(`${allocation.accountCode}:${clean(allocation.holdingKey).toUpperCase()}`);
      if (!holding) {
        warnings.push({ sheet: "Goal Allocation", rowNumber: allocation.rowNumber, investorId: group.investor.id, reason: `Holding Key ${allocation.holdingKey} was not found in this workbook; allocation will be retained as a ledger row but cannot be attached to a current holding.` });
        group.warningCount += 1;
        return;
      }
      allocation.positionId = holding.positionId;
      if (isGeneralWealth(allocation.goalName)) {
        allocation.goalId = "";
        allocation.goalResolvedName = GENERAL_WEALTH_BUCKET_NAME;
        allocation.goalMatched = true;
      } else {
        const goal = goals.find((item) => clean(item.name || item.goalName).toLowerCase() === clean(allocation.goalName).toLowerCase());
        if (!goal) {
          warnings.push({ sheet: "Goal Allocation", rowNumber: allocation.rowNumber, investorId: group.investor.id, reason: `Goal / Bucket List "${allocation.goalName}" was not found for ${group.investor.fullName || group.investor.name || "Investor"}.` });
          group.warningCount += 1;
        } else {
          allocation.goalId = goal.id || goal.goalId;
          allocation.goalResolvedName = goal.name || goal.goalName || allocation.goalName;
          allocation.goalMatched = true;
        }
      }
      const totalKey = `${allocation.accountCode}:${clean(allocation.holdingKey).toUpperCase()}`;
      allocationTotals.set(totalKey, round((allocationTotals.get(totalKey) || 0) + Number(allocation.percentage || 0)));
    });
    allocationTotals.forEach((total, key) => {
      if (total > 100.0001) issues.push({ sheet: "Goal Allocation", rowNumber: 0, status: "invalid", reason: `Goal allocations for ${key.split(":").slice(1).join(":")} total ${total}%. Maximum is 100%.`, investorNameInput: group.investor.fullName || group.investor.name || "Investor", clientCodeInput: group.investor.clientCode || "" });
    });
  }

  return { groups: resolvedGroups, issues, warnings };
}

function signedCashAmount(row) {
  const amount = Math.abs(Number(row.amount || 0));
  const type = normaliseHeader(row.entryType);
  if (!amount) return 0;
  if (["withdrawal", "purchase debit", "charges", "transfer out", "fee", "expense", "other outflow"].some((item) => type.includes(item))) return -amount;
  if (["opening cash", "contribution", "sale proceeds", "dividend", "interest", "transfer in", "maturity proceeds", "refund", "other inflow"].some((item) => type.includes(item))) return amount;
  return Number(row.amount || 0);
}

function accountPreview(group, account) {
  const code = account.accountCode;
  const holdings = group.holdings.filter((item) => item.accountCode === code);
  const cash = group.cash.filter((item) => item.accountCode === code);
  const currentHoldingsValue = round(holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0));
  const investedAmount = round(holdings.reduce((sum, item) => sum + Number(item.totalInvested || 0), 0));
  const cashBalance = round(cash.reduce((sum, item) => sum + signedCashAmount(item), 0));
  return { accountCode: code, accountName: account.accountName, holdingCount: holdings.length, investedAmount, currentHoldingsValue, cashBalance, currentPortfolioValue: round(currentHoldingsValue + cashBalance) };
}

export function manualPortfolioPreview(mode, parsed, resolution) {
  const counts = Object.fromEntries(Object.entries(parsed.datasets).map(([key, rows]) => [key, rows.length]));
  const investors = resolution.groups.map((group) => {
    const accountRows = group.accounts.map((account) => accountPreview(group, account));
    return {
      investorId: group.investor.id,
      investorName: group.investor.fullName || group.investor.name || "Investor",
      clientCode: group.investor.clientCode || "",
      matchedBy: [...group.matchedBy].join(", ") || "Identity",
      accountCount: group.accounts.length,
      holdingCount: group.holdings.length,
      transactionCount: group.transactions.length,
      cashEntryCount: group.cash.length,
      currentValue: round(accountRows.reduce((sum, item) => sum + item.currentPortfolioValue, 0)),
      warningCount: group.warningCount,
      accounts: accountRows
    };
  });
  return {
    mode,
    fileName: parsed.fileName,
    investorCount: investors.length,
    accountCount: resolution.groups.reduce((sum, group) => sum + group.accounts.length, 0),
    holdingCount: counts.holdings || 0,
    transactionCount: counts.transactions || 0,
    cashEntryCount: counts.cash || 0,
    incomeCount: counts.income || 0,
    corporateActionCount: counts.corporateActions || 0,
    chargeCount: counts.charges || 0,
    goalAllocationCount: counts.goals || 0,
    reconciliationCount: counts.reconciliation || 0,
    noteCount: counts.notes || 0,
    totalRows: parsed.totalRows,
    blockingIssueCount: resolution.issues.length,
    warningCount: resolution.warnings.length,
    issues: resolution.issues.slice(0, 100),
    warnings: resolution.warnings.slice(0, 100),
    investors: investors.slice(0, 100)
  };
}

function transactionDocumentId(row) { return ledgerId("manualtx", row.investorId, row.accountCode, row.transactionKey, `${row.transactionDate}:${row.transactionType}:${row.instrumentName}:${row.reference}:${row.netAmount}`); }
function cashDocumentId(row) { return ledgerId("manualcash", row.investorId, row.accountCode, row.entryKey, `${row.entryDate}:${row.entryType}:${row.reference}:${row.amount}`); }
function incomeDocumentId(row) { return ledgerId("manualinc", row.investorId, row.accountCode, row.incomeKey, `${row.incomeDate}:${row.incomeType}:${row.reference}:${row.netAmount}`); }
function corporateActionDocumentId(row) { return ledgerId("manualca", row.investorId, row.accountCode, row.actionKey, `${row.actionDate}:${row.actionType}:${row.instrumentName}:${row.reference}`); }
function chargeDocumentId(row) { return ledgerId("manualchg", row.investorId, row.accountCode, row.chargeKey, `${row.chargeDate}:${row.chargeType}:${row.reference}:${row.totalAmount}`); }
function goalAllocationDocumentId(row) { return ledgerId("manualga", row.investorId, row.accountCode, row.allocationKey, `${row.holdingKey}:${row.goalName}:${row.percentage}`); }
function reconciliationDocumentId(row) { return ledgerId("manualrec", row.investorId, row.accountCode, row.reconciliationKey, `${row.reconciliationDate}:${row.statementReference}`); }
function noteDocumentId(row) { return ledgerId("manualnote", row.investorId, row.accountCode, row.noteKey, `${row.noteDate}:${row.category}:${row.title}`); }

async function existingManualData(investorId) {
  const collectionNames = [
    "portfolioPositions", "investmentTransactions", "manualPortfolioAccounts", "manualPortfolioAccountSnapshots", "manualPortfolioCashLedger", "manualPortfolioIncome", "manualPortfolioCorporateActions", "manualPortfolioCharges", "manualPortfolioGoalAllocations", "manualPortfolioReconciliations", "manualPortfolioNotes"
  ];
  const snapshots = await Promise.all(collectionNames.map((name) => adminDb.collection(name).where("investorId", "==", investorId).get()));
  return Object.fromEntries(collectionNames.map((name, index) => [name, snapshots[index].docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }))]));
}

function xirr(flows) {
  const cleanFlows = flows.filter((item) => item.amount && /^\d{4}-\d{2}-\d{2}$/.test(item.date)).sort((a, b) => a.date.localeCompare(b.date));
  if (cleanFlows.length < 2 || !cleanFlows.some((item) => item.amount < 0) || !cleanFlows.some((item) => item.amount > 0)) return null;
  const start = new Date(`${cleanFlows[0].date}T00:00:00Z`).getTime();
  const npv = (rate) => cleanFlows.reduce((sum, item) => {
    const days = (new Date(`${item.date}T00:00:00Z`).getTime() - start) / 86400000;
    return sum + item.amount / ((1 + rate) ** (days / 365));
  }, 0);
  let low = -0.9999; let high = 10;
  let fLow = npv(low); let fHigh = npv(high);
  if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow * fHigh > 0) return null;
  for (let index = 0; index < 120; index += 1) {
    const mid = (low + high) / 2; const fMid = npv(mid);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) < 0.0001) return round(mid * 100, 4);
    if (fLow * fMid <= 0) { high = mid; fHigh = fMid; } else { low = mid; fLow = fMid; }
  }
  return round(((low + high) / 2) * 100, 4);
}

async function refreshAccountSummaries(investor, actor, batchId) {
  const investorId = investor.id;
  const [accountsSnap, positionsSnap, cashSnap, incomeSnap, chargeSnap, txSnap] = await Promise.all([
    adminDb.collection("manualPortfolioAccounts").where("investorId", "==", investorId).get(),
    adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioCashLedger").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioIncome").where("investorId", "==", investorId).get(),
    adminDb.collection("manualPortfolioCharges").where("investorId", "==", investorId).get(),
    adminDb.collection("investmentTransactions").where("investorId", "==", investorId).get()
  ]);
  const accounts = accountsSnap.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
  const positions = positionsSnap.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() })).filter((item) => item.source === PORTFOLIO_SOURCES.MANUAL && item.manualPortfolioCashPosition !== true && !["inactive", "exited", "removed"].includes(clean(item.status).toLowerCase()));
  const cashRows = cashSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  const incomeRows = incomeSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  const chargeRows = chargeSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  const txRows = txSnap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.source === PORTFOLIO_SOURCES.MANUAL && item.manualPortfolioManaged === true);
  const writer = adminDb.bulkWriter();
  const now = FieldValue.serverTimestamp();
  const summaries = [];

  for (const account of accounts) {
    const accountCode = account.accountCode || DEFAULT_ACCOUNT_CODE;
    const holdings = positions.filter((item) => (item.manualPortfolioAccountCode || DEFAULT_ACCOUNT_CODE) === accountCode);
    const cash = cashRows.filter((item) => item.accountCode === accountCode);
    const income = incomeRows.filter((item) => item.accountCode === accountCode);
    const charges = chargeRows.filter((item) => item.accountCode === accountCode);
    const transactions = txRows.filter((item) => item.manualPortfolioAccountCode === accountCode);
    const investedAmount = round(holdings.reduce((sum, item) => sum + Number(item.totalInvested || item.investedAmount || 0), 0));
    const currentHoldingsValue = round(holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0));
    const cashBalance = round(cash.reduce((sum, item) => sum + Number(item.signedAmount ?? signedCashAmount(item)), 0));
    const currentPortfolioValue = round(currentHoldingsValue + cashBalance);
    const assetClasses = holdings.reduce((totals, item) => {
      const key = clean(item.assetClass) || "Other";
      totals[key] = round(Number(totals[key] || 0) + Number(item.currentValue || 0));
      return totals;
    }, {});
    if (Math.abs(cashBalance) > 0.005) assetClasses.Cash = round(cashBalance);
    const unrealizedGainLoss = round(currentHoldingsValue - investedAmount);
    const realizedPnl = round(transactions.reduce((sum, item) => sum + Number(item.realizedPnl || 0), 0));
    const incomeTotal = round(income.reduce((sum, item) => sum + Number(item.netAmount || 0), 0));
    const chargesTotal = round(charges.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0));
    const investorContribution = round(cash.filter((item) => ["opening cash", "contribution", "transfer in"].some((type) => normaliseHeader(item.entryType).includes(type))).reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0));
    const investorWithdrawal = round(cash.filter((item) => ["withdrawal", "transfer out"].some((type) => normaliseHeader(item.entryType).includes(type))).reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0));
    const absoluteReturnPercentage = investorContribution > 0 ? round(((currentPortfolioValue + investorWithdrawal - investorContribution) / investorContribution) * 100, 4) : null;
    const terminalDate = [indiaDateKey(), ...holdings.map((item) => item.valuationDate).filter(Boolean)].sort().at(-1) || indiaDateKey();
    const flows = cash.flatMap((item) => {
      const type = normaliseHeader(item.entryType); const amount = Math.abs(Number(item.amount || 0));
      if (!item.entryDate || !amount) return [];
      if (["opening cash", "contribution", "transfer in"].some((name) => type.includes(name))) return [{ date: item.entryDate, amount: -amount }];
      if (["withdrawal", "transfer out"].some((name) => type.includes(name))) return [{ date: item.entryDate, amount }];
      return [];
    });
    if (currentPortfolioValue) flows.push({ date: terminalDate, amount: currentPortfolioValue });
    const xirrPercentage = xirr(flows);

    const cashPositionId = manualPositionId(investorId, accountCode, "__CASH__", {});
    const cashPositionRef = adminDb.collection("portfolioPositions").doc(cashPositionId);
    if (Math.abs(cashBalance) > 0.005) {
      writer.set(cashPositionRef, {
        investorId,
        investorName: investor.fullName || investor.name || "Investor",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.MANUAL,
        provider: account.provider || "Manual",
        productType: PORTFOLIO_PRODUCT_TYPES.OTHER,
        assetClass: "Cash",
        instrumentName: `Cash Balance - ${account.accountName || accountCode}`,
        totalInvested: 0,
        investedAmount: 0,
        quantity: 1,
        totalUnits: 0,
        currentRate: cashBalance,
        currentValue: cashBalance,
        gainLoss: 0,
        returnPercentage: 0,
        valuationDate: terminalDate,
        goalAllocations: [generalWealthAllocation()],
        allocationStatus: "general_wealth",
        defaultBucketApplied: true,
        status: "active",
        manualPortfolioManaged: true,
        manualPortfolioCashPosition: true,
        manualPortfolioAccountId: account.id,
        manualPortfolioAccountCode: accountCode,
        manualHoldingKey: "__CASH__",
        manualBulkImportId: batchId,
        updatedAt: now,
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
    } else {
      writer.delete(cashPositionRef);
    }

    const metrics = {
      investedAmount,
      currentHoldingsValue,
      cashBalance,
      currentPortfolioValue,
      unrealizedGainLoss,
      realizedPnl,
      incomeTotal,
      chargesTotal,
      investorContribution,
      investorWithdrawal,
      absoluteReturnPercentage,
      xirrPercentage,
      holdingCount: holdings.length,
      transactionCount: transactions.length,
      assetClasses
    };
    writer.set(account.ref, {
      metrics,
      lastCalculatedAt: now,
      lastCalculatedBatchId: batchId,
      updatedAt: now
    }, { merge: true });
    summaries.push({ accountCode, ...metrics });
  }
  await writer.close();
  return summaries;
}

export async function commitManualPortfolioWorkbook({ actor, file, mode, parsed, resolution }) {
  const batchId = `manual_pms_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const results = [];
  const now = FieldValue.serverTimestamp();

  for (const group of resolution.groups) {
    const investor = group.investor;
    const investorId = investor.id;
    const existing = await existingManualData(investorId);

    // Replace is a true two-phase operation: delete the investor's existing
    // Manual-source state first, then start a fresh writer for recreated rows.
    // This avoids enqueueing delete + set operations for the same document in
    // one BulkWriter and makes replacement deterministic.
    if (mode === "replace") {
      const replaceWriter = adminDb.bulkWriter();
      existing.portfolioPositions.filter((item) => item.source === PORTFOLIO_SOURCES.MANUAL).forEach((item) => replaceWriter.delete(item.ref));
      existing.investmentTransactions.filter((item) => item.source === PORTFOLIO_SOURCES.MANUAL && item.manualPortfolioManaged === true).forEach((item) => replaceWriter.delete(item.ref));
      ["manualPortfolioAccounts", "manualPortfolioAccountSnapshots", "manualPortfolioCashLedger", "manualPortfolioIncome", "manualPortfolioCorporateActions", "manualPortfolioCharges", "manualPortfolioGoalAllocations", "manualPortfolioReconciliations", "manualPortfolioNotes"].forEach((name) => existing[name].forEach((item) => replaceWriter.delete(item.ref)));
      await replaceWriter.close();
    }

    const writer = adminDb.bulkWriter();
    for (const account of group.accounts) {
      const ref = adminDb.collection("manualPortfolioAccounts").doc(account.accountId || accountDocumentId(investorId, account.accountCode));
      writer.set(ref, {
        investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        accountCode: account.accountCode, accountName: account.accountName, strategy: account.strategy, provider: account.provider,
        openingDate: account.openingDate, status: account.status || "active", baseCurrency: account.baseCurrency || "INR", benchmark: account.benchmark,
        discretionary: Boolean(account.discretionary), notes: account.notes, source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true,
        manualImportFileName: parsed.fileName, manualImportMode: mode, manualBulkImportId: batchId,
        createdAt: now, updatedAt: now, updatedByUid: actor.uid, updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
    }

    const allocationsByPosition = new Map();
    group.goals.filter((item) => item.positionId && (item.goalId || isGeneralWealth(item.goalResolvedName || item.goalName))).forEach((item) => {
      const list = allocationsByPosition.get(item.positionId) || [];
      list.push({ goalId: item.goalId, goalName: item.goalResolvedName || item.goalName, percentage: Number(item.percentage || 0) });
      allocationsByPosition.set(item.positionId, list);
    });

    let createdHoldings = 0; let updatedHoldings = 0;
    const existingPositionIds = new Set(existing.portfolioPositions.map((item) => item.id));
    for (const row of group.holdings) {
      const ref = adminDb.collection("portfolioPositions").doc(row.positionId);
      const goalAllocations = normalisePortfolioGoalAllocations(allocationsByPosition.get(row.positionId) || []);
      const gainLoss = round(row.currentValue - row.totalInvested);
      const returnPercentage = row.totalInvested > 0 ? round(gainLoss / row.totalInvested * 100) : 0;
      writer.set(ref, {
        investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.MANUAL, provider: row.provider || "Manual", productType: row.productType,
        assetClass: portfolioAssetClass(row.productType), instrumentName: row.instrumentName,
        schemeName: row.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? row.instrumentName : "",
        stockName: row.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? row.instrumentName : "",
        symbol: row.symbol, isin: row.isin, exchange: row.exchange, folioNo: row.folioNo, investmentMode: row.investmentMode,
        totalInvested: row.totalInvested, investedAmount: row.totalInvested,
        quantity: row.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? row.quantity : 0,
        totalUnits: row.productType !== PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? row.quantity : 0,
        averageBuyRate: row.averageBuyRate, currentRate: row.currentRate,
        currentNav: row.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? row.currentRate : 0,
        navDate: row.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? row.valuationDate : "",
        valuationDate: row.valuationDate, purchaseDate: row.purchaseDate, maturityDate: row.maturityDate,
        currentValue: row.currentValue, gainLoss, returnPercentage, monthlySip: row.monthlySip,
        goalAllocations, allocationStatus: portfolioAllocationStatus(goalAllocations), defaultBucketApplied: goalAllocations.some((item) => !item.goalId), notes: row.notes, status: row.status || "active",
        manualPortfolioManaged: true, manualPortfolioAccountId: row.accountId, manualPortfolioAccountCode: row.accountCode, manualHoldingKey: row.holdingKey,
        manualImportFileName: parsed.fileName, manualImportMode: mode, manualBulkImportId: batchId,
        createdAt: now, updatedAt: now, updatedByUid: actor.uid, updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
      existingPositionIds.has(row.positionId) ? updatedHoldings += 1 : createdHoldings += 1;
    }

    for (const row of group.transactions) {
      const ref = adminDb.collection("investmentTransactions").doc(transactionDocumentId(row));
      writer.set(ref, {
        investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualPortfolioAccountId: row.accountId, manualPortfolioAccountCode: row.accountCode,
        manualHoldingKey: row.holdingKey, transactionKey: row.transactionKey, transactionDate: row.transactionDate, transactionType: row.transactionType,
        instrumentName: row.instrumentName, quantity: row.quantity, transactionQuantity: row.quantity, rate: row.rate, transactionRate: row.rate,
        grossAmount: row.grossAmount, transactionAmount: row.grossAmount, charges: row.charges, taxes: row.taxes, netAmount: row.netAmount,
        realizedPnl: row.realizedPnl, realisedPnl: row.realizedPnl, transactionReference: row.reference, notes: row.notes, manualBulkImportId: batchId, createdAt: now, updatedAt: now
      }, { merge: true });
    }

    for (const row of group.cash) {
      writer.set(adminDb.collection("manualPortfolioCashLedger").doc(cashDocumentId(row)), {
        investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "", advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        accountId: row.accountId, accountCode: row.accountCode, entryKey: row.entryKey, entryDate: row.entryDate, entryType: row.entryType,
        amount: row.amount, signedAmount: round(signedCashAmount(row)), reference: row.reference, notes: row.notes, source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualBulkImportId: batchId, createdAt: now, updatedAt: now
      }, { merge: true });
    }
    for (const row of group.income) {
      writer.set(adminDb.collection("manualPortfolioIncome").doc(incomeDocumentId(row)), { investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "", advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, accountId: row.accountId, accountCode: row.accountCode, incomeKey: row.incomeKey, incomeDate: row.incomeDate, incomeType: row.incomeType, holdingKey: row.holdingKey, instrumentName: row.instrumentName, grossAmount: row.grossAmount, tds: row.tds, netAmount: row.netAmount, reference: row.reference, notes: row.notes, source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualBulkImportId: batchId, createdAt: now, updatedAt: now }, { merge: true });
    }
    for (const row of group.corporateActions) {
      writer.set(adminDb.collection("manualPortfolioCorporateActions").doc(corporateActionDocumentId(row)), { investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "", advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, accountId: row.accountId, accountCode: row.accountCode, actionKey: row.actionKey, actionDate: row.actionDate, actionType: row.actionType, holdingKey: row.holdingKey, instrumentName: row.instrumentName, ratio: row.ratio, quantityChange: row.quantityChange, cashAmount: row.cashAmount, newInstrumentName: row.newInstrumentName, reference: row.reference, notes: row.notes, source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualBulkImportId: batchId, createdAt: now, updatedAt: now }, { merge: true });
    }
    for (const row of group.charges) {
      writer.set(adminDb.collection("manualPortfolioCharges").doc(chargeDocumentId(row)), { investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "", advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, accountId: row.accountId, accountCode: row.accountCode, chargeKey: row.chargeKey, chargeDate: row.chargeDate, chargeType: row.chargeType, amount: row.amount, gst: row.gst, totalAmount: row.totalAmount, reference: row.reference, notes: row.notes, source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualBulkImportId: batchId, createdAt: now, updatedAt: now }, { merge: true });
    }
    for (const row of group.goals) {
      writer.set(adminDb.collection("manualPortfolioGoalAllocations").doc(goalAllocationDocumentId(row)), { investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "", advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, accountId: row.accountId, accountCode: row.accountCode, allocationKey: row.allocationKey, holdingKey: row.holdingKey, positionId: row.positionId || "", goalId: row.goalId || "", goalName: row.goalResolvedName || row.goalName, percentage: row.percentage, matched: Boolean(row.positionId && (row.goalId || isGeneralWealth(row.goalResolvedName || row.goalName))), notes: row.notes, source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualBulkImportId: batchId, createdAt: now, updatedAt: now }, { merge: true });
    }
    for (const row of group.reconciliation) {
      writer.set(adminDb.collection("manualPortfolioReconciliations").doc(reconciliationDocumentId(row)), { investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "", advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, accountId: row.accountId, accountCode: row.accountCode, reconciliationKey: row.reconciliationKey, reconciliationDate: row.reconciliationDate, statementValue: row.statementValue, systemValueInput: row.systemValueInput, statusInput: row.status, statementReference: row.statementReference, notes: row.notes, source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualBulkImportId: batchId, createdAt: now, updatedAt: now }, { merge: true });
    }
    for (const row of group.notes) {
      writer.set(adminDb.collection("manualPortfolioNotes").doc(noteDocumentId(row)), { investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "", advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, accountId: row.accountId, accountCode: row.accountCode, noteKey: row.noteKey, noteDate: row.noteDate, category: row.category, title: row.title, note: row.note, visibility: row.visibility, source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualBulkImportId: batchId, createdAt: now, updatedAt: now }, { merge: true });
    }

    const logRef = adminDb.collection("activityLogs").doc();
    writer.set(logRef, {
      recordType: "manual_portfolio_management_import", recordId: logRef.id, investorId, clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
      action: mode === "replace" ? "manual_portfolio_management_replaced" : "manual_portfolio_management_merged",
      title: mode === "replace" ? "Manual Portfolio Management workbook replaced" : "Manual Portfolio Management workbook updated",
      description: `${group.accounts.length} account(s), ${group.holdings.length} holding(s), ${group.transactions.length} transaction(s) and supporting PMS ledger rows were processed from ${parsed.fileName || "Excel"}.`,
      metadata: { batchId, mode, accounts: group.accounts.length, holdings: group.holdings.length, transactions: group.transactions.length, cash: group.cash.length, income: group.income.length, corporateActions: group.corporateActions.length, charges: group.charges.length, goalAllocations: group.goals.length, reconciliations: group.reconciliation.length, notes: group.notes.length, warningCount: group.warningCount },
      createdByUid: actor.uid, createdByName: actor.fullName || actor.email || "GrowVest User", createdAt: now
    });

    await writer.close();
    const accountSummaries = await refreshAccountSummaries(investor, actor, batchId);

    // Reconciliation rows compare statement value with the newly calculated account value after all writes.
    if (group.reconciliation.length) {
      const recWriter = adminDb.bulkWriter();
      const latestByAccount = new Map();
      for (const row of group.reconciliation) {
        const accountSummary = accountSummaries.find((item) => item.accountCode === row.accountCode);
        const systemValue = row.systemValueInput || Number(accountSummary?.currentPortfolioValue || 0);
        const difference = round(row.statementValue - systemValue);
        const tolerance = Math.max(5, Math.abs(row.statementValue) * 0.01);
        const status = row.status || (Math.abs(difference) <= tolerance ? "verified" : "mismatch");
        recWriter.set(adminDb.collection("manualPortfolioReconciliations").doc(reconciliationDocumentId(row)), { systemValue, difference, status, tolerance, reconciledAt: FieldValue.serverTimestamp() }, { merge: true });
        const current = latestByAccount.get(row.accountCode);
        if (!current || String(row.reconciliationDate || "") >= String(current.reconciliationDate || "")) {
          latestByAccount.set(row.accountCode, {
            reconciliationKey: row.reconciliationKey,
            reconciliationDate: row.reconciliationDate,
            statementValue: row.statementValue,
            systemValue,
            difference,
            tolerance,
            status,
            statementReference: row.statementReference
          });
        }
      }
      for (const [accountCode, reconciliation] of latestByAccount.entries()) {
        recWriter.set(adminDb.collection("manualPortfolioAccounts").doc(accountDocumentId(investorId, accountCode)), { latestReconciliation: reconciliation, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      await recWriter.close();
    }

    const accountSnapshotWriter = adminDb.bulkWriter();
    const accountSnapshotDate = indiaDateKey();
    for (const accountSummary of accountSummaries) {
      const account = group.accounts.find((item) => item.accountCode === accountSummary.accountCode);
      const { accountCode: _accountCode, ...accountMetrics } = accountSummary;
      const snapshotId = `mpas_${stableHash([investorId, accountSummary.accountCode, accountSnapshotDate, batchId], 36)}`;
      accountSnapshotWriter.set(adminDb.collection("manualPortfolioAccountSnapshots").doc(snapshotId), {
        investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid, assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        accountId: account?.accountId || accountDocumentId(investorId, accountSummary.accountCode), accountCode: accountSummary.accountCode, accountName: account?.accountName || accountSummary.accountCode,
        strategy: account?.strategy || "", provider: account?.provider || "Manual", snapshotDate: accountSnapshotDate, metrics: accountMetrics,
        source: PORTFOLIO_SOURCES.MANUAL, manualPortfolioManaged: true, manualBulkImportId: batchId, capturedAt: FieldValue.serverTimestamp(), capturedByUid: actor.uid, capturedByName: actor.fullName || actor.email || "GrowVest User"
      });
    }
    await accountSnapshotWriter.close();

    const snapshot = await createPortfolioSnapshot(investorId, actor, { snapshotDate: accountSnapshotDate, verificationStatus: group.warningCount ? "review_required" : "verified", sourceImportId: batchId });
    results.push({ investorId, investorName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "", accountCount: group.accounts.length, holdingCount: group.holdings.length, transactionCount: group.transactions.length, createdHoldings, updatedHoldings, warningCount: group.warningCount, accountSummaries, snapshot });
  }

  const batchLog = adminDb.collection("activityLogs").doc();
  await batchLog.set({ recordType: "manual_portfolio_management_import_batch", recordId: batchLog.id, action: mode === "replace" ? "manual_portfolio_management_batch_replaced" : "manual_portfolio_management_batch_merged", title: "Multi-investor Manual Portfolio Management workbook processed", description: `${resolution.groups.length} investor(s) were processed from ${parsed.fileName || "Excel"}.`, metadata: { batchId, mode, investorCount: resolution.groups.length, totalRows: parsed.totalRows, fileName: parsed.fileName }, createdByUid: actor.uid, createdByName: actor.fullName || actor.email || "GrowVest User", createdAt: FieldValue.serverTimestamp() });

  return { batchId, results };
}
