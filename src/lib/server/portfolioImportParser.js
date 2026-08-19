import crypto from "node:crypto";
import {
  PORTFOLIO_ADAPTER_STATUS,
  PORTFOLIO_PRODUCT_TYPES,
  PORTFOLIO_REPORT_TYPES,
  PORTFOLIO_SOURCES,
  portfolioAssetClass
} from "@/lib/constants/portfolio";

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

export function normaliseExternalName(value = "") {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function stableHash(value = "", length = 32) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function htmlFundbazaarRows(text = "") {
  // Fundbazaar's HTML-style .xls is not always valid HTML: transaction rows may
  // start a new <tr> without closing the previous one. Splitting on row starts is
  // therefore more reliable than depending on </tr> / </table> nesting.
  const rowStarts = [...String(text).matchAll(/<tr\b[^>]*>/gi)];
  if (!rowStarts.length) return [];

  return rowStarts.map((rowMatch, index) => {
    const start = Number(rowMatch.index || 0) + rowMatch[0].length;
    const end = index + 1 < rowStarts.length ? Number(rowStarts[index + 1].index || text.length) : text.length;
    const segment = text.slice(start, end);
    const cells = [...segment.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    return cells.map((cell) => decodeHtml(cell[1]));
  }).filter((row) => row.length);
}

function normaliseHeader(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findFundbazaarTable(matrix = []) {
  for (let index = 0; index < matrix.length; index += 1) {
    const headers = matrix[index].map(normaliseHeader);
    const required = ["client", "scheme", "isin", "folio no", "curr nav", "curr amt"];
    if (required.every((item) => headers.includes(item))) {
      return { headerIndex: index, headers: matrix[index].map((value) => String(value || "").trim()) };
    }
  }
  return null;
}

function makeRows(matrix = [], headerIndex, headers = []) {
  const result = [];
  for (const row of matrix.slice(headerIndex + 1)) {
    if (!row.some((value) => String(value || "").trim())) continue;
    const firstCell = normaliseHeader(row[0]);
    // The Fundbazaar valuation table ends with a Total row. Later HTML tables on
    // the same page (benchmarks/XIRR) must not be interpreted as holdings.
    if (firstCell === "total") break;
    result.push(Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  }
  return result;
}

function sourceNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim();
  if (!text || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text);
  const parsed = Number(text.replace(/[₹$,%\s()]/g, "").replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

export function sourceDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{1,2})[\s\/-]([A-Za-z]{3}|\d{1,2})[\s\/-](\d{2}|\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = /^\d+$/.test(match[2]) ? Number(match[2]) : MONTHS[match[2].toLowerCase()];
    let year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (day && month && year) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function getValue(row, names = []) {
  for (const name of names) {
    const key = Object.keys(row).find((candidate) => normaliseHeader(candidate) === normaliseHeader(name));
    if (key) return row[key];
  }
  return "";
}

const BAJAJ_IDENTITY_ALIASES = {
  investorName: ["Investor Name", "Client Name", "Client", "Account Holder", "Beneficiary Name", "Name"],
  pan: ["PAN", "PAN No", "PAN Number", "Permanent Account Number"],
  clientCode: ["Client Code", "Client ID", "UCC", "Trading Code", "Trading Client Code", "BO ID", "PAN / Client Code"]
};

const BAJAJ_DELIVERY_ALIASES = {
  ...BAJAJ_IDENTITY_ALIASES,
  broker: ["Broker", "Broker Name"],
  stockName: ["Stock Name", "Security Name", "Scrip Name", "Company Name", "Instrument Name", "Instrument"],
  symbol: ["Symbol", "Trading Symbol", "Ticker", "Scrip Code", "Security Code"],
  isin: ["ISIN", "ISIN Code"],
  exchange: ["Exchange", "Exch", "Exchange Name"],
  buyDate: ["Buy Date", "Purchase Date", "Acquisition Date", "Date of Purchase"],
  quantity: ["Quantity", "Qty", "Net Qty", "Net Quantity", "Holding Qty", "Holding Quantity", "Available Qty", "Total Qty"],
  averageBuyRate: ["Average Buy Rate", "Avg Buy Rate", "Average Buy Price", "Avg Buy Price", "Average Price", "Avg Price", "Avg Cost", "Average Cost", "Cost Price"],
  investedAmount: ["Invested Amount", "Investment Value", "Cost Value", "Cost Amount", "Buy Value", "Book Value"],
  currentRate: ["Current Rate", "Current Price", "Market Price", "LTP", "Last Traded Price", "Closing Price", "CMP"],
  currentValue: ["Current Value", "Market Value", "Holding Value", "Market Valuation", "Value"],
  unrealisedPnl: ["Unrealised P&L", "Unrealized P&L", "Unrealised PNL", "Unrealized PNL", "MTM", "Profit/Loss", "P&L"],
  returnPercentage: ["Return %", "Return Percentage", "Returns %", "P&L %", "PnL %"],
  valuationDate: ["Valuation Date", "Price Date", "As On Date", "As of Date", "Closing Date", "Report Date"],
  goalName: ["Goal / Corpus", "Goal", "Bucket List", "Corpus"],
  notes: ["Notes", "Remark", "Remarks"]
};

const BAJAJ_INTRADAY_ALIASES = {
  ...BAJAJ_IDENTITY_ALIASES,
  broker: ["Broker", "Broker Name"],
  tradeDate: ["Trade Date", "Trading Date", "Date"],
  stockName: ["Stock Name", "Security Name", "Scrip Name", "Company Name", "Instrument Name", "Instrument"],
  symbol: ["Symbol", "Trading Symbol", "Ticker", "Scrip Code", "Security Code"],
  exchange: ["Exchange", "Exch", "Exchange Name"],
  buyQuantity: ["Buy Quantity", "Buy Qty", "B Qty", "Bought Qty"],
  buyRate: ["Buy Rate", "Buy Price", "Average Buy Rate", "Avg Buy Rate", "B Rate"],
  sellQuantity: ["Sell Quantity", "Sell Qty", "S Qty", "Sold Qty"],
  sellRate: ["Sell Rate", "Sell Price", "Average Sell Rate", "Avg Sell Rate", "S Rate"],
  quantity: ["Quantity", "Qty", "Trade Qty", "Traded Quantity"],
  rate: ["Rate", "Price", "Trade Price", "Execution Price"],
  side: ["Buy/Sell", "Buy Sell", "Side", "Transaction Type", "Trade Type", "B/S"],
  product: ["Product", "Product Type", "Order Type", "Position Type"],
  grossPnl: ["Gross P&L", "Gross PNL", "Gross Profit/Loss", "Gross Profit"],
  brokerage: ["Brokerage", "Brokerage Charges"],
  stt: ["STT", "Securities Transaction Tax"],
  exchangeCharges: ["Exchange Charges", "Txn Charges", "Transaction Charges", "Exchange Txn Charges"],
  gst: ["GST", "IGST", "CGST/SGST"],
  stampDuty: ["Stamp Duty", "Stamp Charges"],
  otherCharges: ["Other Charges", "Other", "SEBI Charges", "Misc Charges"],
  totalCharges: ["Total Charges", "Total Tax & Charges", "Total Taxes & Charges", "Net Charges"],
  netPnl: ["Net P&L", "Net PNL", "Net Profit/Loss", "Net Profit"],
  tradeId: ["Trade / Order ID", "Trade/Order ID", "Trade ID", "Trade No", "Trade Number", "Order ID", "Order No", "Order Number"],
  status: ["Status", "Trade Status"],
  notes: ["Notes", "Remark", "Remarks"]
};


const ULIP_ALIASES = {
  investorName: ["Investor Name", "Client Name", "Policy Holder", "Policyholder Name", "Life Assured", "Name"],
  pan: ["PAN", "PAN No", "PAN Number", "Permanent Account Number"],
  clientCode: ["Client Code", "Client ID", "Customer ID", "Policyholder ID", "PAN / Client Code"],
  insurer: ["Insurance Company", "Insurer", "Insurance Provider", "Provider", "Company Name"],
  policyNumber: ["Policy Number", "Policy No", "Policy No.", "Policy #"],
  planName: ["Plan Name", "Product Name", "Policy Plan", "ULIP Plan"],
  fundName: ["Fund Name", "Investment Fund", "Fund Option", "Fund", "Portfolio Fund"],
  fundCode: ["Fund Code", "Fund ID", "Fund Option Code", "Fund Identifier"],
  policyStartDate: ["Policy Start Date", "Commencement Date", "Policy Commencement Date", "Start Date", "Issue Date"],
  premiumAmount: ["Premium", "Premium Amount", "Regular Premium", "Annual Premium"],
  premiumFrequency: ["Premium Frequency", "Premium Mode", "Frequency", "Payment Frequency"],
  totalPremiumPaid: ["Total Premium Paid", "Premium Paid", "Total Premium", "Cumulative Premium Paid"],
  allocatedInvestedAmount: ["Fund Invested Amount", "Allocated Amount", "Investment Amount", "Cost Value"],
  units: ["Units", "Fund Units", "Unit Balance", "Balance Units"],
  nav: ["NAV", "Current NAV", "Unit Price", "Fund NAV"],
  navDate: ["NAV Date", "Valuation Date", "As On Date", "As of Date", "Price Date"],
  fundValue: ["Fund Value", "Current Value", "Market Value", "Current Fund Value", "Valuation"],
  maturityDate: ["Maturity Date", "Policy Maturity Date", "Maturity"],
  sumAssured: ["Sum Assured", "Life Cover", "Death Benefit", "Cover Amount"],
  policyStatus: ["Policy Status", "Status"],
  goalName: ["Goal / Corpus", "Goal", "Bucket List", "Corpus"],
  notes: ["Notes", "Remark", "Remarks"]
};

function safeUlipTable(table) {
  if (!table) return false;
  const map = table.map || {};
  const hasIdentity = mappedField(map, "policyNumber") && mappedField(map, "fundName");
  const hasValuation = mappedField(map, "fundValue") || (mappedField(map, "units") && mappedField(map, "nav"));
  return hasIdentity && hasValuation;
}

function collectUlipIdentity(identity, row, map) {
  const name = cleanIdentifier(mappedValue(row, map, "investorName"));
  const explicitPan = normalisePan(mappedValue(row, map, "pan"));
  const combinedIdentity = cleanIdentifier(mappedValue(row, map, "clientCode"));
  const combinedPan = normalisePan(combinedIdentity);
  const clientCode = combinedPan ? "" : normalizeClientCode(combinedIdentity);
  if (name) identity.names.add(name);
  if (explicitPan || combinedPan) identity.pans.add(explicitPan || combinedPan);
  if (clientCode) identity.clientCodes.add(clientCode);
}

function finishUlipIdentity(identity, matrix = []) {
  for (const row of matrix.slice(0, 35)) {
    const cells = row.map((value) => String(value || "").trim());
    cells.forEach((value, index) => {
      const normalized = normaliseHeader(value);
      const next = nextNonEmptyValue(row, index);
      if (["pan", "pan no", "pan number", "permanent account number"].includes(normalized)) {
        const pan = normalisePan(next);
        if (pan) identity.pans.add(pan);
      }
      if (["client code", "client id", "customer id", "policyholder id"].includes(normalized)) {
        const code = normalizeClientCode(next);
        if (code && !normalisePan(code)) identity.clientCodes.add(code);
      }
      if (["client name", "investor name", "policy holder", "policyholder name", "life assured"].includes(normalized) && next) identity.names.add(next);
      const inlinePan = value.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
      if (inlinePan) identity.pans.add(inlinePan[1].toUpperCase());
      const inlinePolicyholder = value.match(/^(?:client name|investor name|policy holder|policyholder name|life assured)\s*[:=-]\s*(.+)$/i);
      if (inlinePolicyholder?.[1]) identity.names.add(inlinePolicyholder[1].trim());
      const inlineCode = value.match(/^(?:client code|client id|customer id|policyholder id)\s*[:=-]\s*([A-Za-z0-9._/-]+)$/i);
      if (inlineCode?.[1] && !normalisePan(inlineCode[1])) identity.clientCodes.add(normalizeClientCode(inlineCode[1]));
    });
  }
  if (identity.names.size > 1) {
    const normalized = new Set([...identity.names].map(normaliseExternalName).filter(Boolean));
    if (normalized.size > 1) throw new Error("This ULIP report contains more than one investor. Upload one investor report per file.");
  }
  if (identity.pans.size > 1) throw new Error("This ULIP report contains more than one PAN. Upload one investor report per file.");
  if (identity.clientCodes.size > 1) throw new Error("This ULIP report contains more than one client code. Upload one investor report per file.");
  const externalClientName = [...identity.names][0] || "";
  return {
    externalClientName,
    normalizedExternalClientName: normaliseExternalName(externalClientName),
    externalPan: [...identity.pans][0] || "",
    externalClientCode: [...identity.clientCodes][0] || ""
  };
}

function parseUlipPortfolio(matrix = []) {
  const candidate = findStructuredTable(
    matrix,
    ULIP_ALIASES,
    ["policyNumber", "fundName", "units", "nav", "fundValue"],
    4
  );
  const table = safeUlipTable(candidate) ? candidate : null;
  if (!table) throw new Error("ULIP portfolio was detected, but Policy Number, Fund Name and Units/NAV/Fund Value columns could not be mapped safely.");

  const identity = { names: new Set(), pans: new Set(), clientCodes: new Set() };
  const rawFunds = [];
  let blankRun = 0;

  for (let rowIndex = table.headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const policyNumber = cleanIdentifier(mappedValue(row, table.map, "policyNumber"));
    const fundName = cleanIdentifier(mappedValue(row, table.map, "fundName"));
    if (!policyNumber && !fundName) {
      blankRun += 1;
      if (blankRun >= 8 && rawFunds.length) break;
      continue;
    }
    blankRun = 0;
    if (/^total$/i.test(policyNumber || fundName)) break;
    if (!policyNumber || !fundName) continue;

    collectUlipIdentity(identity, row, table.map);
    const units = Math.abs(sourceNumber(mappedValue(row, table.map, "units")));
    const nav = sourceNumber(mappedValue(row, table.map, "nav"));
    let fundValue = sourceNumber(mappedValue(row, table.map, "fundValue"));
    if (!fundValue && units && nav) fundValue = units * nav;
    if (!fundValue && !units) continue;

    rawFunds.push({
      sourceRow: rowIndex + 1,
      source: PORTFOLIO_SOURCES.ULIP,
      provider: cleanIdentifier(mappedValue(row, table.map, "insurer")) || "ULIP Provider",
      insurer: cleanIdentifier(mappedValue(row, table.map, "insurer")) || "ULIP Provider",
      productType: PORTFOLIO_PRODUCT_TYPES.ULIP,
      assetClass: "Insurance",
      policyNumber,
      planName: cleanIdentifier(mappedValue(row, table.map, "planName")),
      fundName,
      instrumentName: fundName,
      fundCode: cleanIdentifier(mappedValue(row, table.map, "fundCode")).toUpperCase(),
      policyStartDate: sourceDate(mappedValue(row, table.map, "policyStartDate")),
      premiumAmount: Number(sourceNumber(mappedValue(row, table.map, "premiumAmount")).toFixed(2)),
      premiumFrequency: cleanIdentifier(mappedValue(row, table.map, "premiumFrequency")),
      policyTotalPremiumPaid: Number(sourceNumber(mappedValue(row, table.map, "totalPremiumPaid")).toFixed(2)),
      allocatedInvestedAmount: Number(sourceNumber(mappedValue(row, table.map, "allocatedInvestedAmount")).toFixed(2)),
      totalUnits: Number(units.toFixed(6)),
      currentNav: Number(nav.toFixed(6)),
      navDate: sourceDate(mappedValue(row, table.map, "navDate")),
      valuationDate: sourceDate(mappedValue(row, table.map, "navDate")),
      currentValue: Number(fundValue.toFixed(2)),
      maturityDate: sourceDate(mappedValue(row, table.map, "maturityDate")),
      sumAssured: Number(sourceNumber(mappedValue(row, table.map, "sumAssured")).toFixed(2)),
      policyStatus: cleanIdentifier(mappedValue(row, table.map, "policyStatus")) || "Active",
      requestedGoalName: cleanIdentifier(mappedValue(row, table.map, "goalName")),
      notes: cleanIdentifier(mappedValue(row, table.map, "notes"))
    });
  }

  if (!rawFunds.length) throw new Error("No ULIP fund positions were found in this report.");

  const fundMap = new Map();
  rawFunds.forEach((fund) => {
    const key = `${normaliseExternalName(fund.policyNumber)}|${fund.fundCode || normaliseExternalName(fund.fundName)}`;
    const current = fundMap.get(key);
    if (!current) {
      fundMap.set(key, { ...fund });
      return;
    }
    // Multiple rows for the same policy/fund are treated as repeated valuations,
    // not additional units. Keep the latest dated valuation and the richest
    // policy metadata instead of summing a snapshot export accidentally.
    const currentDate = current.navDate || "";
    const nextDate = fund.navDate || "";
    const preferred = nextDate && (!currentDate || nextDate >= currentDate) ? fund : current;
    fundMap.set(key, {
      ...current,
      ...preferred,
      provider: preferred.provider || current.provider,
      insurer: preferred.insurer || current.insurer,
      planName: preferred.planName || current.planName,
      fundCode: preferred.fundCode || current.fundCode,
      policyStartDate: preferred.policyStartDate || current.policyStartDate,
      premiumAmount: preferred.premiumAmount || current.premiumAmount,
      premiumFrequency: preferred.premiumFrequency || current.premiumFrequency,
      policyTotalPremiumPaid: preferred.policyTotalPremiumPaid || current.policyTotalPremiumPaid,
      allocatedInvestedAmount: preferred.allocatedInvestedAmount || current.allocatedInvestedAmount,
      maturityDate: preferred.maturityDate || current.maturityDate,
      sumAssured: preferred.sumAssured || current.sumAssured,
      requestedGoalName: preferred.requestedGoalName || current.requestedGoalName,
      notes: preferred.notes || current.notes
    });
  });

  const holdings = [...fundMap.values()].map((fund) => {
    const totalInvested = Number(fund.allocatedInvestedAmount || 0);
    const gainLossAvailable = totalInvested > 0;
    const gainLoss = gainLossAvailable ? Number(fund.currentValue || 0) - totalInvested : 0;
    return {
      ...fund,
      investmentMode: "ULIP Fund",
      totalInvested: Number(totalInvested.toFixed(2)),
      investedAmount: Number(totalInvested.toFixed(2)),
      gainLoss: Number(gainLoss.toFixed(2)),
      returnPercentage: gainLossAvailable && totalInvested > 0 ? Number((gainLoss / totalInvested * 100).toFixed(2)) : 0,
      gainLossAvailable
    };
  });

  const policyMap = new Map();
  holdings.forEach((fund) => {
    const key = normaliseExternalName(fund.policyNumber);
    const current = policyMap.get(key) || {
      policyNumber: fund.policyNumber,
      provider: fund.provider,
      insurer: fund.insurer,
      planName: fund.planName,
      policyStartDate: fund.policyStartDate,
      premiumAmount: fund.premiumAmount,
      premiumFrequency: fund.premiumFrequency,
      totalPremiumPaid: fund.policyTotalPremiumPaid,
      maturityDate: fund.maturityDate,
      sumAssured: fund.sumAssured,
      policyStatus: fund.policyStatus || "Active",
      requestedGoalName: fund.requestedGoalName || "",
      currentFundValue: 0,
      fundCount: 0,
      latestNavDate: ""
    };
    current.currentFundValue += Number(fund.currentValue || 0);
    current.fundCount += 1;
    if (!current.totalPremiumPaid && fund.policyTotalPremiumPaid) current.totalPremiumPaid = fund.policyTotalPremiumPaid;
    if (!current.premiumAmount && fund.premiumAmount) current.premiumAmount = fund.premiumAmount;
    if (!current.premiumFrequency && fund.premiumFrequency) current.premiumFrequency = fund.premiumFrequency;
    if (!current.planName && fund.planName) current.planName = fund.planName;
    if (!current.maturityDate && fund.maturityDate) current.maturityDate = fund.maturityDate;
    if (!current.policyStartDate && fund.policyStartDate) current.policyStartDate = fund.policyStartDate;
    if (!current.sumAssured && fund.sumAssured) current.sumAssured = fund.sumAssured;
    if (!current.latestNavDate || (fund.navDate && fund.navDate > current.latestNavDate)) current.latestNavDate = fund.navDate || current.latestNavDate;
    policyMap.set(key, current);
  });

  const policies = [...policyMap.values()].map((policy) => ({
    ...policy,
    totalPremiumPaid: Number(Number(policy.totalPremiumPaid || 0).toFixed(2)),
    currentFundValue: Number(Number(policy.currentFundValue || 0).toFixed(2))
  }));

  const uniquePolicyPremium = policies.reduce((sum, policy) => sum + Number(policy.totalPremiumPaid || 0), 0);
  const currentValue = holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const allocatedCost = holdings.reduce((sum, item) => sum + Number(item.totalInvested || 0), 0);
  const latestNavDate = holdings.map((item) => item.navDate).filter(Boolean).sort().at(-1) || "";
  const id = finishUlipIdentity(identity, matrix.slice(0, table.headerIndex));

  return {
    ...id,
    holdings,
    policies,
    transactions: [],
    trades: [],
    warnings: allocatedCost <= 0 && uniquePolicyPremium > 0
      ? ["Fund-level cost allocation is not present in this ULIP report. Policy premium paid is tracked at policy level; fund-level return is not inferred."]
      : [],
    reportPeriodStart: policies.map((item) => item.policyStartDate).filter(Boolean).sort()[0] || "",
    reportPeriodEnd: latestNavDate,
    summary: {
      totalInvested: Number(uniquePolicyPremium.toFixed(2)),
      currentValue: Number(currentValue.toFixed(2)),
      gainLoss: Number((currentValue - uniquePolicyPremium).toFixed(2)),
      positionCount: holdings.length,
      policyCount: policies.length,
      transactionCount: 0,
      totalUnits: Number(holdings.reduce((sum, item) => sum + Number(item.totalUnits || 0), 0).toFixed(6)),
      valuationDate: latestNavDate,
      navDate: latestNavDate
    }
  };
}


function mergeUlipResults(parts = []) {
  const valid = parts.filter(Boolean);
  if (!valid.length) throw new Error("No ULIP portfolio data was found.");
  const names = new Set(valid.map((item) => normaliseExternalName(item.externalClientName)).filter(Boolean));
  const pans = new Set(valid.map((item) => item.externalPan).filter(Boolean));
  const clientCodes = new Set(valid.map((item) => item.externalClientCode).filter(Boolean));
  if (names.size > 1 || pans.size > 1 || clientCodes.size > 1) {
    throw new Error("The ULIP workbook appears to contain more than one investor. Upload one investor report per file.");
  }

  const holdingMap = new Map();
  valid.flatMap((item) => item.holdings || []).forEach((holding) => {
    const key = `${normaliseExternalName(holding.policyNumber)}|${holding.fundCode || normaliseExternalName(holding.fundName || holding.instrumentName)}`;
    const current = holdingMap.get(key);
    if (!current || String(holding.navDate || "") >= String(current.navDate || "")) holdingMap.set(key, holding);
  });
  const holdings = [...holdingMap.values()];

  const policyMap = new Map();
  valid.flatMap((item) => item.policies || []).forEach((policy) => {
    const key = normaliseExternalName(policy.policyNumber);
    const current = policyMap.get(key);
    if (!current || String(policy.latestNavDate || "") >= String(current.latestNavDate || "")) policyMap.set(key, policy);
  });
  const policies = [...policyMap.values()];
  const totalInvested = policies.reduce((sum, item) => sum + Number(item.totalPremiumPaid || 0), 0);
  const currentValue = holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const latestNavDate = holdings.map((item) => item.navDate).filter(Boolean).sort().at(-1) || "";
  const warnings = [...new Set(valid.flatMap((item) => item.warnings || []))];
  const externalClientName = valid.find((item) => item.externalClientName)?.externalClientName || "";

  return {
    externalClientName,
    normalizedExternalClientName: normaliseExternalName(externalClientName),
    externalPan: [...pans][0] || "",
    externalClientCode: [...clientCodes][0] || "",
    holdings,
    policies,
    transactions: [],
    trades: [],
    warnings,
    reportPeriodStart: policies.map((item) => item.policyStartDate).filter(Boolean).sort()[0] || "",
    reportPeriodEnd: latestNavDate,
    summary: {
      totalInvested: Number(totalInvested.toFixed(2)),
      currentValue: Number(currentValue.toFixed(2)),
      gainLoss: Number((currentValue - totalInvested).toFixed(2)),
      positionCount: holdings.length,
      policyCount: policies.length,
      transactionCount: 0,
      totalUnits: Number(holdings.reduce((sum, item) => sum + Number(item.totalUnits || 0), 0).toFixed(6)),
      valuationDate: latestNavDate,
      navDate: latestNavDate
    }
  };
}


const GENERIC_PORTFOLIO_ALIASES = {
  investorName: ["Investor Name", "Client Name", "Investor", "Account Holder", "Customer Name", "Name"],
  pan: ["PAN", "PAN No", "PAN Number", "Permanent Account Number", "PAN / Client Code"],
  clientCode: ["Client Code", "Client ID", "Customer ID", "UCC", "Account ID", "Investor Code"],
  productType: ["Investment Type", "Product Type", "Asset Type", "Investment Category", "Asset Category"],
  investmentMode: ["Investment Mode", "Mode", "Investment Method", "Purchase Mode"],
  transactionType: ["Transaction Type", "Tran Type", "Activity Type", "Txn Type"],
  provider: ["Provider / Broker", "Provider", "Broker", "Broker Name", "Platform", "AMC", "Bank", "Insurer"],
  instrumentName: ["Investment Name", "Instrument Name", "Scheme Name", "Security Name", "Stock Name", "Fund Name", "Product Name", "Asset Name", "Instrument"],
  symbol: ["Symbol", "Trading Symbol", "Ticker", "Security Code", "Scrip Code"],
  isin: ["ISIN", "ISIN Code"],
  accountReference: ["Account / Folio / Policy No.", "Account / Folio / Policy No", "Account / Reference No", "Account No", "Account Number", "Reference No", "Folio No", "Folio Number", "Policy Number", "Policy No", "Demat Account"],
  exchange: ["Exchange", "Exch", "Exchange Name"],
  purchaseDate: ["Purchase / Start Date", "Purchase Date", "Start Date", "Investment Date", "Buy Date", "Acquisition Date"],
  quantity: ["Units / Quantity", "Units", "Quantity", "Qty", "Balance Units", "Holding Quantity", "Holding Qty"],
  averagePurchaseRate: ["Average Purchase NAV / Rate", "Average Purchase Rate", "Average Buy Rate", "Avg Buy Rate", "Average Price", "Avg Price", "Purchase NAV", "Cost Price", "Average Cost"],
  investedAmount: ["Invested Amount", "Investment Amount", "Total Invested", "Cost Value", "Cost Amount", "Book Value", "Principal Amount"],
  currentRate: ["Current NAV / Rate", "Current NAV", "Current Rate", "Current Price", "LTP", "Market Price", "Unit Price", "CMP"],
  currentValue: ["Current Value", "Market Value", "Fund Value", "Holding Value", "Valuation", "Present Value"],
  valuationDate: ["NAV / Valuation Date", "NAV Date", "Valuation Date", "As On Date", "As of Date", "Price Date", "Report Date"],
  transactionDate: ["Transaction Date", "Tran Date", "Txn Date", "Trade Date", "Date"],
  transactionQuantity: ["Transaction Units / Quantity", "Transaction Units", "Transaction Quantity", "Txn Qty", "Trade Quantity"],
  transactionRate: ["Transaction NAV / Rate", "Transaction NAV", "Transaction Rate", "Txn Rate", "Trade Price", "NAV Rate"],
  transactionAmount: ["Transaction Amount", "Amount", "Txn Amount", "Purchase Amount", "Investment Amount", "Trade Value"],
  transactionReference: ["Transaction / Order ID", "Transaction ID", "Txn ID", "Reference ID", "Transaction Reference", "Order ID", "Order No", "Trade ID"],
  maturityDate: ["Maturity Date", "End Date", "Policy Maturity Date"],
  goalName: ["Goal / Bucket List", "Goal / Corpus", "Goal", "Bucket List", "Corpus"],
  notes: ["Notes", "Remark", "Remarks", "Comments"]
};

function genericProductType(value = "", fallback = "") {
  const text = normaliseHeader(value || fallback);
  if (!text) return "";
  if (["mutual fund", "mutual funds", "mf", "sip"].includes(text) || /mutual fund/.test(text)) return PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND;
  if (/direct equity|delivery equity|stock delivery|equity delivery|shares|stocks|equity/.test(text)) return PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY;
  if (/ulip|unit linked/.test(text)) return PORTFOLIO_PRODUCT_TYPES.ULIP;
  if (/pms|portfolio management/.test(text)) return PORTFOLIO_PRODUCT_TYPES.PMS;
  if (/bond|debenture|ncd|government security|g sec/.test(text)) return PORTFOLIO_PRODUCT_TYPES.BOND;
  if (/fixed deposit|\bfd\b|term deposit/.test(text)) return PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT;
  if (/gold|sovereign gold|sgb/.test(text)) return PORTFOLIO_PRODUCT_TYPES.GOLD;
  if (/real estate|property/.test(text)) return PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE;
  if (/other|custom|alternative/.test(text)) return PORTFOLIO_PRODUCT_TYPES.OTHER;
  if (Object.values(PORTFOLIO_PRODUCT_TYPES).includes(String(value || fallback))) return String(value || fallback);
  return PORTFOLIO_PRODUCT_TYPES.OTHER;
}

function genericTransactionType(value = "", fallback = "") {
  const raw = String(value || fallback || "").trim();
  if (!raw) return "";
  const text = raw.toLowerCase();
  if (text.includes("sip")) return "SIP";
  if (/lump/.test(text)) return "Lump Sum";
  if (/switch\s*in/.test(text)) return "Switch In";
  if (/switch\s*out/.test(text)) return "Switch Out";
  if (/redemption|redeem/.test(text)) return "Redemption";
  if (/withdraw/.test(text)) return "Withdrawal";
  if (/dividend/.test(text)) return "Dividend";
  if (/interest/.test(text)) return "Interest";
  if (/maturity/.test(text)) return "Maturity";
  if (/sell/.test(text)) return "Sell";
  if (/buy/.test(text)) return "Buy";
  if (/deposit/.test(text)) return "Deposit";
  if (/transfer/.test(text)) return "Transfer";
  if (/purchase|investment|additional|fresh/.test(text)) return "Purchase";
  return raw;
}

function genericInvestmentMode(value = "", productType = "", fallback = "") {
  const raw = String(value || fallback || "").trim();
  if (raw) {
    const text = raw.toLowerCase();
    if (/both/.test(text)) return "Both";
    if (/sip|systematic/.test(text)) return "SIP";
    if (/lump/.test(text)) return "Lump Sum";
    if (/delivery/.test(text)) return "Delivery";
    if (/recurring/.test(text)) return "Recurring";
    if (/one time|single/.test(text)) return "One Time";
    return raw;
  }
  if (productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) return "Delivery";
  return "";
}

function genericCashFlowType(transactionType = "") {
  const text = String(transactionType || "").toLowerCase();
  if (/switch\s*in|switch\s*out|transfer/.test(text)) return "internal";
  if (/redemption|withdraw|sell|maturity/.test(text)) return "withdrawal";
  if (/sip|purchase|lump|buy|deposit|investment/.test(text)) return "new_money";
  if (/dividend|interest/.test(text)) return "income";
  return "review";
}

function genericHeaderSignature(headers = []) {
  return stableHash(headers.map(normaliseHeader).filter(Boolean).join("|"), 40);
}

function genericHeaderCandidate(matrix = []) {
  let best = null;
  for (let index = 0; index < Math.min(matrix.length, 50); index += 1) {
    const row = matrix[index] || [];
    const map = headerMap(row, GENERIC_PORTFOLIO_ALIASES);
    const keys = Object.keys(map).filter((key) => Number(map[key]) >= 0);
    const score = keys.length;
    const hasInstrument = mappedField(map, "instrumentName") || mappedField(map, "symbol") || mappedField(map, "isin") || mappedField(map, "accountReference");
    const hasValuation = mappedField(map, "currentValue") || (mappedField(map, "quantity") && mappedField(map, "currentRate"));
    const hasTransaction = mappedField(map, "transactionDate") && (mappedField(map, "transactionAmount") || mappedField(map, "transactionQuantity"));
    if (hasInstrument && (hasValuation || hasTransaction || score >= 5) && (!best || score > best.score)) {
      best = { headerIndex: index, headers: row.map((value) => String(value || "").trim()), map, score, hasValuation, hasTransaction };
    }
  }
  return best;
}

function genericMapFromConfig(headers = [], config = {}, autoMap = {}) {
  const mapping = config?.mapping && typeof config.mapping === "object" ? config.mapping : {};
  const normalizedHeaders = headers.map(normaliseHeader);
  const result = {};
  Object.keys(GENERIC_PORTFOLIO_ALIASES).forEach((key) => {
    const configured = String(mapping[key] || "").trim();
    if (configured) {
      const configuredNormalized = normaliseHeader(configured);
      const index = normalizedHeaders.findIndex((value) => value === configuredNormalized);
      result[key] = index;
      return;
    }
    result[key] = Number(autoMap?.[key] ?? -1);
  });
  return result;
}

function genericRowValue(row = [], map = {}, key, defaults = {}) {
  const value = mappedValue(row, map, key);
  return value === "" || value === null || value === undefined ? defaults?.[key] ?? "" : value;
}

function genericPositionKey(holding = {}) {
  return [
    holding.productType || "",
    normaliseExternalName(holding.provider || ""),
    String(holding.accountReference || holding.folioNo || holding.policyNumber || "").trim().toUpperCase(),
    String(holding.isin || "").trim().toUpperCase(),
    normaliseExternalName(holding.symbol || holding.instrumentName || "")
  ].join("|");
}

function mergeGenericHoldings(rows = [], rowMode = "holdings") {
  const map = new Map();
  rows.forEach((holding) => {
    const key = genericPositionKey(holding);
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...holding });
      return;
    }
    const nextDate = holding.valuationDate || "";
    const currentDate = current.valuationDate || "";
    const nextIsLatest = !currentDate || (nextDate && nextDate >= currentDate);
    if (rowMode === "transactions") {
      current.quantity = Number((Number(current.quantity || 0) + Number(holding.quantity || 0)).toFixed(6));
      current.totalUnits = current.quantity;
      current.totalInvested = Number((Number(current.totalInvested || 0) + Number(holding.totalInvested || 0)).toFixed(2));
      current.investedAmount = current.totalInvested;
      if (nextIsLatest) {
        current.currentRate = holding.currentRate || current.currentRate;
        current.currentNav = holding.currentNav || current.currentNav;
        current.valuationDate = holding.valuationDate || current.valuationDate;
        current.navDate = holding.navDate || current.navDate;
      }
      if (Number(current.currentRate || 0) && Number(current.quantity || 0)) current.currentValue = Number((Number(current.currentRate) * Number(current.quantity)).toFixed(2));
      else current.currentValue = Math.max(Number(current.currentValue || 0), Number(holding.currentValue || 0));
    } else if (nextIsLatest) {
      const goalAllocations = current.goalAllocations;
      Object.assign(current, holding);
      if ((!holding.goalAllocations || !holding.goalAllocations.length) && goalAllocations?.length) current.goalAllocations = goalAllocations;
    }
  });
  return [...map.values()].map((holding) => {
    const invested = Number(holding.totalInvested ?? holding.investedAmount ?? 0);
    const currentValue = Number(holding.currentValue || 0);
    const gainLoss = Number((currentValue - invested).toFixed(2));
    return {
      ...holding,
      gainLoss,
      returnPercentage: invested > 0 ? Number((gainLoss / invested * 100).toFixed(2)) : Number(holding.returnPercentage || 0)
    };
  });
}

function parseGenericMatrix(matrix = [], config = {}, sheetName = "") {
  const candidate = genericHeaderCandidate(matrix);
  if (!candidate) throw new Error("Could not identify a usable portfolio header row. Map an Investment Name or stable identifier plus the valuation/transaction columns manually.");
  const defaults = config?.defaults && typeof config.defaults === "object" ? config.defaults : {};
  const rowMode = ["holdings", "transactions"].includes(config?.rowMode) ? config.rowMode : "holdings";
  const deriveHoldingsFromTransactions = config?.deriveHoldingsFromTransactions === true;
  const map = genericMapFromConfig(candidate.headers, config, candidate.map);
  if (!(mappedField(map, "instrumentName") || mappedField(map, "symbol") || mappedField(map, "isin") || mappedField(map, "accountReference"))) throw new Error("Map Investment Name or at least one stable investment identifier (Symbol, ISIN, or Account/Folio/Policy No.).");
  const hasValuation = mappedField(map, "currentValue") || (mappedField(map, "quantity") && mappedField(map, "currentRate"));
  if (rowMode === "holdings" && !hasValuation) throw new Error("Map Current Value, or map both Units / Quantity and Current NAV / Rate.");

  const identities = { names: new Set(), pans: new Set(), clientCodes: new Set() };
  const holdings = [];
  const transactions = [];
  let blankRun = 0;
  for (let rowIndex = candidate.headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const symbol = cleanIdentifier(genericRowValue(row, map, "symbol", defaults));
    const isin = cleanIdentifier(genericRowValue(row, map, "isin", defaults)).toUpperCase();
    const accountReference = cleanIdentifier(genericRowValue(row, map, "accountReference", defaults));
    const instrumentName = cleanIdentifier(genericRowValue(row, map, "instrumentName", defaults)) || symbol || isin || accountReference;
    if (!instrumentName) {
      blankRun += 1;
      if (blankRun >= 10 && (holdings.length || transactions.length)) break;
      continue;
    }
    blankRun = 0;
    if (/^total$/i.test(instrumentName)) break;

    const investorName = cleanIdentifier(genericRowValue(row, map, "investorName", defaults));
    const explicitPan = normalisePan(genericRowValue(row, map, "pan", defaults));
    const combinedCode = cleanIdentifier(genericRowValue(row, map, "clientCode", defaults));
    const combinedPan = normalisePan(combinedCode);
    if (investorName) identities.names.add(investorName);
    if (explicitPan || combinedPan) identities.pans.add(explicitPan || combinedPan);
    if (combinedCode && !combinedPan) identities.clientCodes.add(normalizeClientCode(combinedCode));

    const productType = genericProductType(genericRowValue(row, map, "productType", defaults), defaults.productType);
    const provider = cleanIdentifier(genericRowValue(row, map, "provider", defaults)) || "GrowVest Standard";
    const quantity = sourceNumber(genericRowValue(row, map, "quantity", defaults));
    const averagePurchaseRate = sourceNumber(genericRowValue(row, map, "averagePurchaseRate", defaults));
    let totalInvested = sourceNumber(genericRowValue(row, map, "investedAmount", defaults));
    const currentRate = sourceNumber(genericRowValue(row, map, "currentRate", defaults));
    let currentValue = sourceNumber(genericRowValue(row, map, "currentValue", defaults));
    if (!totalInvested && quantity && averagePurchaseRate) totalInvested = quantity * averagePurchaseRate;
    if (!currentValue && quantity && currentRate) currentValue = quantity * currentRate;
    const valuationDate = sourceDate(genericRowValue(row, map, "valuationDate", defaults));
    const investmentMode = genericInvestmentMode(genericRowValue(row, map, "investmentMode", defaults), productType, defaults.investmentMode);
    const holding = {
      source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
      provider,
      productType,
      assetClass: portfolioAssetClass(productType, instrumentName),
      instrumentName,
      schemeName: productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? instrumentName : "",
      stockName: productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? instrumentName : "",
      fundName: productType === PORTFOLIO_PRODUCT_TYPES.ULIP ? instrumentName : "",
      symbol,
      isin,
      accountReference,
      folioNo: productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? accountReference : "",
      policyNumber: productType === PORTFOLIO_PRODUCT_TYPES.ULIP ? accountReference : "",
      exchange: cleanIdentifier(genericRowValue(row, map, "exchange", defaults)),
      investmentMode,
      purchaseDate: sourceDate(genericRowValue(row, map, "purchaseDate", defaults)),
      quantity: Number(quantity.toFixed(6)),
      totalUnits: Number(quantity.toFixed(6)),
      units: Number(quantity.toFixed(6)),
      averagePurchaseRate: Number(averagePurchaseRate.toFixed(6)),
      averageBuyRate: productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? Number(averagePurchaseRate.toFixed(6)) : 0,
      averagePurchaseNav: productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? Number(averagePurchaseRate.toFixed(6)) : 0,
      totalInvested: Number(totalInvested.toFixed(2)),
      investedAmount: Number(totalInvested.toFixed(2)),
      currentRate: Number(currentRate.toFixed(6)),
      currentNav: [PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, PORTFOLIO_PRODUCT_TYPES.ULIP].includes(productType) ? Number(currentRate.toFixed(6)) : 0,
      currentValue: Number(currentValue.toFixed(2)),
      valuationDate,
      navDate: [PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, PORTFOLIO_PRODUCT_TYPES.ULIP].includes(productType) ? valuationDate : "",
      maturityDate: sourceDate(genericRowValue(row, map, "maturityDate", defaults)),
      requestedGoalName: cleanIdentifier(genericRowValue(row, map, "goalName", defaults)),
      notes: cleanIdentifier(genericRowValue(row, map, "notes", defaults)),
      sourceRow: rowIndex + 1
    };
    if (rowMode === "holdings" || deriveHoldingsFromTransactions) holdings.push(holding);

    const transactionDate = sourceDate(genericRowValue(row, map, "transactionDate", defaults));
    const transactionType = genericTransactionType(genericRowValue(row, map, "transactionType", defaults), defaults.transactionType);
    const transactionQuantity = sourceNumber(genericRowValue(row, map, "transactionQuantity", defaults)) || (rowMode === "transactions" ? quantity : 0);
    const transactionRate = sourceNumber(genericRowValue(row, map, "transactionRate", defaults)) || (rowMode === "transactions" ? averagePurchaseRate : 0);
    let transactionAmount = sourceNumber(genericRowValue(row, map, "transactionAmount", defaults));
    const transactionReference = cleanIdentifier(genericRowValue(row, map, "transactionReference", defaults));
    if (!transactionAmount && transactionQuantity && transactionRate) transactionAmount = transactionQuantity * transactionRate;
    if (rowMode === "transactions" || transactionDate || transactionType || transactionAmount) {
      if (transactionDate || transactionType || transactionAmount || transactionQuantity) {
        transactions.push({
          source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
          provider,
          productType,
          instrumentName,
          symbol: holding.symbol,
          isin: holding.isin,
          accountReference,
          folioNo: holding.folioNo,
          policyNumber: holding.policyNumber,
          transactionDate,
          transactionType: transactionType || "Other",
          transactionReference,
          externalTransactionId: transactionReference,
          investmentMode,
          quantity: Number(transactionQuantity.toFixed(6)),
          units: Number(transactionQuantity.toFixed(6)),
          transactionRate: Number(transactionRate.toFixed(6)),
          purchaseNav: Number(transactionRate.toFixed(6)),
          amount: Number(transactionAmount.toFixed(2)),
          purchaseAmount: Number(transactionAmount.toFixed(2)),
          cashFlowType: genericCashFlowType(transactionType),
          notes: holding.notes,
          sourceRow: rowIndex + 1
        });
      }
    }
  }

  const normalizedNames = new Set([...identities.names].map(normaliseExternalName).filter(Boolean));
  if (normalizedNames.size > 1) throw new Error("This generic portfolio sheet contains more than one investor name. Upload one investor per file.");
  if (identities.pans.size > 1) throw new Error("This generic portfolio sheet contains more than one PAN. Upload one investor per file.");
  if (identities.clientCodes.size > 1) throw new Error("This generic portfolio sheet contains more than one client code. Upload one investor per file.");

  const mergedHoldings = mergeGenericHoldings(holdings, rowMode);
  const summary = mergedHoldings.reduce((total, item) => {
    total.totalInvested += Number(item.totalInvested || 0);
    total.currentValue += Number(item.currentValue || 0);
    total.gainLoss += Number(item.gainLoss || 0);
    return total;
  }, { totalInvested: 0, currentValue: 0, gainLoss: 0 });
  const dates = [...mergedHoldings.map((item) => item.valuationDate), ...transactions.map((item) => item.transactionDate)].filter(Boolean).sort();
  const externalClientName = [...identities.names][0] || "";
  return {
    externalClientName,
    normalizedExternalClientName: normaliseExternalName(externalClientName),
    externalPan: [...identities.pans][0] || "",
    externalClientCode: [...identities.clientCodes][0] || "",
    holdings: mergedHoldings,
    transactions,
    trades: [],
    policies: [],
    reportPeriodStart: dates[0] || "",
    reportPeriodEnd: dates.at(-1) || "",
    summary: {
      totalInvested: Number(summary.totalInvested.toFixed(2)),
      currentValue: Number(summary.currentValue.toFixed(2)),
      gainLoss: Number(summary.gainLoss.toFixed(2)),
      positionCount: mergedHoldings.length,
      transactionCount: transactions.length,
      valuationDate: mergedHoldings.map((item) => item.valuationDate).filter(Boolean).sort().at(-1) || ""
    },
    genericMapping: {
      sheetName,
      headerRowIndex: candidate.headerIndex,
      headers: candidate.headers,
      headerSignature: genericHeaderSignature(candidate.headers),
      mapping: Object.fromEntries(Object.entries(map).filter(([, index]) => Number(index) >= 0).map(([key, index]) => [key, candidate.headers[index]])),
      defaults,
      rowMode,
      deriveHoldingsFromTransactions
    }
  };
}

function mergeGenericResults(parts = []) {
  const names = new Set();
  const pans = new Set();
  const clientCodes = new Set();
  const holdings = [];
  const transactions = [];
  parts.forEach((part) => {
    if (part.externalClientName) names.add(part.externalClientName);
    if (part.externalPan) pans.add(part.externalPan);
    if (part.externalClientCode) clientCodes.add(part.externalClientCode);
    holdings.push(...(part.holdings || []));
    transactions.push(...(part.transactions || []));
  });
  if (new Set([...names].map(normaliseExternalName)).size > 1 || pans.size > 1 || clientCodes.size > 1) {
    throw new Error("The GrowVest Standard workbook contains conflicting investor identities across sheets. Use one investor per workbook.");
  }
  const mergedHoldings = mergeGenericHoldings(holdings, "holdings");
  const summary = mergedHoldings.reduce((total, item) => {
    total.totalInvested += Number(item.totalInvested || 0);
    total.currentValue += Number(item.currentValue || 0);
    total.gainLoss += Number(item.gainLoss || 0);
    return total;
  }, { totalInvested: 0, currentValue: 0, gainLoss: 0 });
  const dates = [...mergedHoldings.map((item) => item.valuationDate), ...transactions.map((item) => item.transactionDate)].filter(Boolean).sort();
  const externalClientName = [...names][0] || "";
  return {
    externalClientName,
    normalizedExternalClientName: normaliseExternalName(externalClientName),
    externalPan: [...pans][0] || "",
    externalClientCode: [...clientCodes][0] || "",
    holdings: mergedHoldings,
    transactions,
    trades: [],
    policies: [],
    reportPeriodStart: dates[0] || "",
    reportPeriodEnd: dates.at(-1) || "",
    summary: {
      totalInvested: Number(summary.totalInvested.toFixed(2)),
      currentValue: Number(summary.currentValue.toFixed(2)),
      gainLoss: Number(summary.gainLoss.toFixed(2)),
      positionCount: mergedHoldings.length,
      transactionCount: transactions.length,
      valuationDate: mergedHoldings.map((item) => item.valuationDate).filter(Boolean).sort().at(-1) || ""
    }
  };
}

function standardWorkbookResult(sheets = []) {
  const holdingsSheet = sheets.find((item) => ["portfolio holdings", "holdings", "portfolio import"].includes(normaliseHeader(item.sheetName)));
  const transactionsSheet = sheets.find((item) => ["transactions", "portfolio transactions", "investment transactions"].includes(normaliseHeader(item.sheetName)));
  if (!holdingsSheet) return null;
  const holdings = parseGenericMatrix(holdingsSheet.matrix, { rowMode: "holdings" }, holdingsSheet.sheetName);
  const parts = [holdings];
  if (transactionsSheet) parts.push(parseGenericMatrix(transactionsSheet.matrix, { rowMode: "transactions", defaults: { productType: "Other" } }, transactionsSheet.sheetName));
  return mergeGenericResults(parts);
}

export async function inspectGenericPortfolioFile(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const sheets = await workbookSheets(buffer);
  let best = null;
  for (const sheet of sheets) {
    const candidate = genericHeaderCandidate(sheet.matrix);
    if (!candidate) continue;
    const item = {
      sheetName: sheet.sheetName,
      headerRowIndex: candidate.headerIndex,
      headers: candidate.headers,
      headerSignature: genericHeaderSignature(candidate.headers),
      suggestedMapping: Object.fromEntries(Object.entries(candidate.map).filter(([, index]) => Number(index) >= 0).map(([key, index]) => [key, candidate.headers[index]])),
      sampleRows: sheet.matrix.slice(candidate.headerIndex + 1, candidate.headerIndex + 5).map((row) => Object.fromEntries(candidate.headers.map((header, index) => [header || `Column ${index + 1}`, row[index] ?? ""]))),
      rowMode: candidate.hasTransaction && !candidate.hasValuation ? "transactions" : "holdings",
      score: candidate.score
    };
    if (!best || item.score > best.score) best = item;
  }
  return best;
}

export async function parseGenericPortfolioFile(file, config = {}) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const sheets = await workbookSheets(buffer);
  const requestedSheet = String(config?.sheetName || "").trim();
  const sheet = requestedSheet
    ? sheets.find((item) => item.sheetName === requestedSheet)
    : sheets.find((item) => genericHeaderCandidate(item.matrix));
  if (!sheet) throw new Error("The selected Excel/CSV file does not contain a mappable portfolio table.");
  const parsed = parseGenericMatrix(sheet.matrix, config, sheet.sheetName);
  return {
    source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
    reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
    adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
    confidence: config?.mappingProfileId ? 0.99 : 0.95,
    sheetName: sheet.sheetName,
    mappingProfileId: config?.mappingProfileId || "",
    completeSnapshot: config?.completeSnapshot === true,
    ...parsed
  };
}

function headerMap(row = [], aliases = {}) {
  return Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, findHeaderIndex(row, names)]));
}

function findStructuredTable(matrix = [], aliases = {}, required = [], minimum = required.length) {
  let best = null;
  for (let index = 0; index < Math.min(matrix.length, 80); index += 1) {
    const map = headerMap(matrix[index] || [], aliases);
    const score = required.filter((key) => Number(map[key]) >= 0).length;
    if (score >= minimum && (!best || score > best.score)) best = { headerIndex: index, map, score };
  }
  return best;
}

function mappedValue(row = [], map = {}, key) {
  const index = Number(map[key]);
  return index >= 0 ? row[index] ?? "" : "";
}

function mappedField(map = {}, key) {
  return Number(map?.[key]) >= 0;
}

function safeBajajDeliveryTable(table) {
  if (!table) return false;
  const map = table.map || {};
  return mappedField(map, "quantity")
    && (mappedField(map, "stockName") || mappedField(map, "symbol"))
    && (mappedField(map, "averageBuyRate") || mappedField(map, "investedAmount"))
    && (mappedField(map, "currentRate") || mappedField(map, "currentValue"));
}

function safeBajajPairedIntradayTable(table) {
  if (!table) return false;
  const map = table.map || {};
  const quantityPair = (mappedField(map, "buyQuantity") && mappedField(map, "sellQuantity")) || mappedField(map, "quantity");
  return mappedField(map, "tradeDate")
    && (mappedField(map, "stockName") || mappedField(map, "symbol"))
    && quantityPair
    && mappedField(map, "buyRate")
    && mappedField(map, "sellRate");
}

function safeBajajSidewiseIntradayTable(table) {
  if (!table) return false;
  const map = table.map || {};
  return mappedField(map, "tradeDate")
    && (mappedField(map, "stockName") || mappedField(map, "symbol"))
    && mappedField(map, "side")
    && mappedField(map, "quantity")
    && mappedField(map, "rate");
}

function cleanIdentifier(value = "") {
  return String(value || "").trim();
}

function normalizeClientCode(value = "") {
  const text = cleanIdentifier(value).toUpperCase().replace(/\s+/g, "");
  return text && text.length <= 40 ? text : "";
}

function collectBajajIdentity({ names, pans, clientCodes }, row, map) {
  const name = cleanIdentifier(mappedValue(row, map, "investorName"));
  const explicitPan = normalisePan(mappedValue(row, map, "pan"));
  const combinedIdentity = cleanIdentifier(mappedValue(row, map, "clientCode"));
  const combinedPan = normalisePan(combinedIdentity);
  const clientCode = combinedPan ? "" : normalizeClientCode(combinedIdentity);
  if (name) names.add(name);
  if (explicitPan || combinedPan) pans.add(explicitPan || combinedPan);
  if (clientCode) clientCodes.add(clientCode);
}

function finishBajajIdentity(identity, matrix = []) {
  for (const row of matrix.slice(0, 35)) {
    const cells = row.map((value) => String(value || "").trim());
    cells.forEach((value, index) => {
      const normalized = normaliseHeader(value);
      const next = nextNonEmptyValue(row, index);
      if (["pan", "pan no", "pan number", "permanent account number"].includes(normalized)) {
        const pan = normalisePan(next);
        if (pan) identity.pans.add(pan);
      }
      if (["client code", "client id", "ucc", "trading code", "trading client code", "bo id"].includes(normalized)) {
        const code = normalizeClientCode(next);
        if (code && !normalisePan(code)) identity.clientCodes.add(code);
      }
      if (["client name", "investor name", "account holder", "beneficiary name"].includes(normalized) && next) identity.names.add(next);
      const inlinePan = value.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
      if (inlinePan) identity.pans.add(inlinePan[1].toUpperCase());
      const inlineName = value.match(/^(?:client name|investor name|account holder)\s*[:=-]\s*(.+)$/i);
      if (inlineName?.[1]) identity.names.add(inlineName[1].trim());
      const inlineCode = value.match(/^(?:client code|client id|ucc|trading code|bo id)\s*[:=-]\s*([A-Za-z0-9._/-]+)$/i);
      if (inlineCode?.[1] && !normalisePan(inlineCode[1])) identity.clientCodes.add(normalizeClientCode(inlineCode[1]));
    });
  }
  if (identity.names.size > 1) {
    const normalized = new Set([...identity.names].map(normaliseExternalName).filter(Boolean));
    if (normalized.size > 1) throw new Error("This Bajaj report contains more than one investor. Upload one investor report per file.");
  }
  if (identity.pans.size > 1) throw new Error("This Bajaj report contains more than one PAN. Upload one investor report per file.");
  if (identity.clientCodes.size > 1) throw new Error("This Bajaj report contains more than one client code. Upload one investor report per file.");
  const externalClientName = [...identity.names][0] || "";
  return {
    externalClientName,
    normalizedExternalClientName: normaliseExternalName(externalClientName),
    externalPan: [...identity.pans][0] || "",
    externalClientCode: [...identity.clientCodes][0] || ""
  };
}

function parseBajajDelivery(matrix = []) {
  const candidateTable = findStructuredTable(
    matrix,
    BAJAJ_DELIVERY_ALIASES,
    ["quantity", "stockName", "symbol", "averageBuyRate", "investedAmount", "currentRate", "currentValue"],
    4
  );
  const table = safeBajajDeliveryTable(candidateTable) ? candidateTable : null;
  if (!table) throw new Error("Bajaj Delivery Holdings was detected, but Quantity, Security/Symbol, Cost and Current Valuation columns could not be mapped safely.");

  const identity = { names: new Set(), pans: new Set(), clientCodes: new Set() };
  const rawHoldings = [];
  let blankRun = 0;
  for (let rowIndex = table.headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const stockName = cleanIdentifier(mappedValue(row, table.map, "stockName"));
    const symbol = cleanIdentifier(mappedValue(row, table.map, "symbol"));
    if (!stockName && !symbol) {
      blankRun += 1;
      if (blankRun >= 8 && rawHoldings.length) break;
      continue;
    }
    blankRun = 0;
    if (/^total$/i.test(stockName || symbol)) break;
    collectBajajIdentity(identity, row, table.map);

    const quantity = sourceNumber(mappedValue(row, table.map, "quantity"));
    const averageBuyRate = sourceNumber(mappedValue(row, table.map, "averageBuyRate"));
    let totalInvested = sourceNumber(mappedValue(row, table.map, "investedAmount"));
    const currentRate = sourceNumber(mappedValue(row, table.map, "currentRate"));
    let currentValue = sourceNumber(mappedValue(row, table.map, "currentValue"));
    if (!totalInvested && quantity && averageBuyRate) totalInvested = quantity * averageBuyRate;
    if (!currentValue && quantity && currentRate) currentValue = quantity * currentRate;
    if (!quantity && !currentValue) continue;
    const gainLoss = sourceNumber(mappedValue(row, table.map, "unrealisedPnl")) || (currentValue - totalInvested);
    const returnPercentage = sourceNumber(mappedValue(row, table.map, "returnPercentage")) || (totalInvested > 0 ? gainLoss / totalInvested * 100 : 0);
    rawHoldings.push({
      sourceRow: rowIndex + 1,
      source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
      provider: cleanIdentifier(mappedValue(row, table.map, "broker")) || "Bajaj Broking",
      productType: PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY,
      assetClass: "Equity",
      instrumentName: stockName || symbol,
      stockName: stockName || symbol,
      symbol,
      isin: cleanIdentifier(mappedValue(row, table.map, "isin")).toUpperCase(),
      exchange: cleanIdentifier(mappedValue(row, table.map, "exchange")).toUpperCase() || "NSE",
      purchaseDate: sourceDate(mappedValue(row, table.map, "buyDate")),
      quantity: Number(quantity.toFixed(6)),
      averageBuyRate: Number(averageBuyRate.toFixed(6)),
      totalInvested: Number(totalInvested.toFixed(2)),
      investedAmount: Number(totalInvested.toFixed(2)),
      currentRate: Number(currentRate.toFixed(6)),
      currentValue: Number(currentValue.toFixed(2)),
      gainLoss: Number(gainLoss.toFixed(2)),
      returnPercentage: Number(returnPercentage.toFixed(2)),
      valuationDate: sourceDate(mappedValue(row, table.map, "valuationDate")),
      requestedGoalName: cleanIdentifier(mappedValue(row, table.map, "goalName")),
      notes: cleanIdentifier(mappedValue(row, table.map, "notes"))
    });
  }
  if (!rawHoldings.length) throw new Error("No active Bajaj delivery holdings were found in this report.");

  const holdingMap = new Map();
  rawHoldings.forEach((holding) => {
    const key = holding.isin || `${holding.exchange}|${normaliseExternalName(holding.symbol || holding.stockName)}`;
    const current = holdingMap.get(key) || { ...holding, quantity: 0, totalInvested: 0, investedAmount: 0, currentValue: 0 };
    current.quantity += Number(holding.quantity || 0);
    current.totalInvested += Number(holding.totalInvested || 0);
    current.investedAmount = current.totalInvested;
    current.currentValue += Number(holding.currentValue || 0);
    if (holding.valuationDate && (!current.valuationDate || holding.valuationDate > current.valuationDate)) {
      current.valuationDate = holding.valuationDate;
      current.currentRate = holding.currentRate;
    }
    if (!current.requestedGoalName && holding.requestedGoalName) current.requestedGoalName = holding.requestedGoalName;
    holdingMap.set(key, current);
  });

  const holdings = [...holdingMap.values()].map((holding) => {
    const averageBuyRate = holding.quantity > 0 && holding.totalInvested > 0 ? holding.totalInvested / holding.quantity : Number(holding.averageBuyRate || 0);
    const currentRate = holding.quantity > 0 && holding.currentValue > 0 ? holding.currentValue / holding.quantity : Number(holding.currentRate || 0);
    const gainLoss = holding.currentValue - holding.totalInvested;
    return {
      ...holding,
      quantity: Number(holding.quantity.toFixed(6)),
      totalInvested: Number(holding.totalInvested.toFixed(2)),
      investedAmount: Number(holding.totalInvested.toFixed(2)),
      averageBuyRate: Number(averageBuyRate.toFixed(6)),
      currentRate: Number(currentRate.toFixed(6)),
      currentValue: Number(holding.currentValue.toFixed(2)),
      gainLoss: Number(gainLoss.toFixed(2)),
      returnPercentage: Number((holding.totalInvested > 0 ? gainLoss / holding.totalInvested * 100 : 0).toFixed(2)),
      investmentMode: "Delivery"
    };
  });
  const id = finishBajajIdentity(identity, matrix.slice(0, table.headerIndex));
  const summary = holdings.reduce((total, item) => {
    total.totalInvested += Number(item.totalInvested || 0);
    total.currentValue += Number(item.currentValue || 0);
    total.gainLoss += Number(item.gainLoss || 0);
    return total;
  }, { totalInvested: 0, currentValue: 0, gainLoss: 0 });
  const valuationDate = holdings.map((item) => item.valuationDate).filter(Boolean).sort().at(-1) || "";
  return {
    ...id,
    holdings,
    transactions: [],
    trades: [],
    summary: {
      totalInvested: Number(summary.totalInvested.toFixed(2)),
      currentValue: Number(summary.currentValue.toFixed(2)),
      gainLoss: Number(summary.gainLoss.toFixed(2)),
      positionCount: holdings.length,
      transactionCount: 0,
      tradeCount: 0,
      valuationDate
    }
  };
}

function isBuySide(value = "") {
  const text = normaliseHeader(value);
  return text === "b" || text === "buy" || text.includes("buy");
}

function isSellSide(value = "") {
  const text = normaliseHeader(value);
  return text === "s" || text === "sell" || text.includes("sell");
}

function parseBajajIntraday(matrix = []) {
  const sidewiseCandidate = findStructuredTable(
    matrix,
    BAJAJ_INTRADAY_ALIASES,
    ["tradeDate", "stockName", "symbol", "side", "quantity", "rate"],
    5
  );
  const sidewise = safeBajajSidewiseIntradayTable(sidewiseCandidate) ? sidewiseCandidate : null;
  const pairedCandidate = sidewise ? null : findStructuredTable(
    matrix,
    BAJAJ_INTRADAY_ALIASES,
    ["tradeDate", "stockName", "symbol", "buyRate", "sellRate", "buyQuantity", "sellQuantity", "quantity"],
    5
  );
  const paired = safeBajajPairedIntradayTable(pairedCandidate) ? pairedCandidate : null;
  const table = paired || sidewise;
  if (!table) throw new Error("Bajaj Intraday / Trade Book was detected, but the trade columns could not be mapped safely.");

  const identity = { names: new Set(), pans: new Set(), clientCodes: new Set() };
  const trades = [];
  const warnings = [];

  if (paired) {
    let blankRun = 0;
    for (let rowIndex = table.headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] || [];
      const stockName = cleanIdentifier(mappedValue(row, table.map, "stockName"));
      const symbol = cleanIdentifier(mappedValue(row, table.map, "symbol"));
      const tradeDate = sourceDate(mappedValue(row, table.map, "tradeDate"));
      if ((!stockName && !symbol) || !tradeDate) {
        blankRun += 1;
        if (blankRun >= 8 && trades.length) break;
        continue;
      }
      blankRun = 0;
      if (/^total$/i.test(stockName || symbol)) break;
      const product = normaliseHeader(mappedValue(row, table.map, "product"));
      if (product && !/intraday|mis|day/.test(product)) continue;
      collectBajajIdentity(identity, row, table.map);
      const buyQuantityRaw = sourceNumber(mappedValue(row, table.map, "buyQuantity"));
      const sellQuantityRaw = sourceNumber(mappedValue(row, table.map, "sellQuantity"));
      const sharedQuantity = sourceNumber(mappedValue(row, table.map, "quantity"));
      const buyQuantity = buyQuantityRaw || sharedQuantity;
      const sellQuantity = sellQuantityRaw || sharedQuantity;
      const quantity = Math.min(Math.abs(buyQuantity), Math.abs(sellQuantity));
      const buyRate = sourceNumber(mappedValue(row, table.map, "buyRate"));
      const sellRate = sourceNumber(mappedValue(row, table.map, "sellRate"));
      if (quantity <= 0 || buyRate <= 0 || sellRate <= 0) continue;
      const grossPnl = sourceNumber(mappedValue(row, table.map, "grossPnl")) || (sellRate - buyRate) * quantity;
      const brokerage = sourceNumber(mappedValue(row, table.map, "brokerage"));
      const stt = sourceNumber(mappedValue(row, table.map, "stt"));
      const exchangeCharges = sourceNumber(mappedValue(row, table.map, "exchangeCharges"));
      const gst = sourceNumber(mappedValue(row, table.map, "gst"));
      const stampDuty = sourceNumber(mappedValue(row, table.map, "stampDuty"));
      const otherCharges = sourceNumber(mappedValue(row, table.map, "otherCharges"));
      const suppliedTotalCharges = sourceNumber(mappedValue(row, table.map, "totalCharges"));
      const totalCharges = suppliedTotalCharges || brokerage + stt + exchangeCharges + gst + stampDuty + otherCharges;
      const netPnl = sourceNumber(mappedValue(row, table.map, "netPnl")) || grossPnl - totalCharges;
      trades.push({
        sourceRow: rowIndex + 1,
        source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
        provider: cleanIdentifier(mappedValue(row, table.map, "broker")) || "Bajaj Broking",
        tradeType: "intraday",
        tradeDate,
        stockName: stockName || symbol,
        instrumentName: stockName || symbol,
        symbol,
        exchange: cleanIdentifier(mappedValue(row, table.map, "exchange")).toUpperCase() || "NSE",
        buyQuantity: Number(buyQuantity.toFixed(6)),
        sellQuantity: Number(sellQuantity.toFixed(6)),
        quantity: Number(quantity.toFixed(6)),
        buyRate: Number(buyRate.toFixed(6)),
        sellRate: Number(sellRate.toFixed(6)),
        grossPnl: Number(grossPnl.toFixed(2)),
        brokerage: Number(brokerage.toFixed(2)),
        stt: Number(stt.toFixed(2)),
        exchangeCharges: Number(exchangeCharges.toFixed(2)),
        gst: Number(gst.toFixed(2)),
        stampDuty: Number(stampDuty.toFixed(2)),
        otherCharges: Number(otherCharges.toFixed(2)),
        totalCharges: Number(totalCharges.toFixed(2)),
        netPnl: Number(netPnl.toFixed(2)),
        externalTradeId: cleanIdentifier(mappedValue(row, table.map, "tradeId")),
        status: cleanIdentifier(mappedValue(row, table.map, "status")) || "Closed",
        notes: cleanIdentifier(mappedValue(row, table.map, "notes"))
      });
    }
  } else {
    const groups = new Map();
    for (let rowIndex = table.headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] || [];
      const stockName = cleanIdentifier(mappedValue(row, table.map, "stockName"));
      const symbol = cleanIdentifier(mappedValue(row, table.map, "symbol"));
      const tradeDate = sourceDate(mappedValue(row, table.map, "tradeDate"));
      if ((!stockName && !symbol) || !tradeDate) continue;
      const product = normaliseHeader(mappedValue(row, table.map, "product"));
      if (product && !/intraday|mis|day/.test(product)) continue;
      const side = mappedValue(row, table.map, "side");
      if (!isBuySide(side) && !isSellSide(side)) continue;
      collectBajajIdentity(identity, row, table.map);
      const quantity = Math.abs(sourceNumber(mappedValue(row, table.map, "quantity")));
      const rate = sourceNumber(mappedValue(row, table.map, "rate"));
      if (quantity <= 0 || rate <= 0) continue;
      const exchange = cleanIdentifier(mappedValue(row, table.map, "exchange")).toUpperCase() || "NSE";
      const key = `${tradeDate}|${exchange}|${normaliseExternalName(symbol || stockName)}`;
      const current = groups.get(key) || {
        tradeDate,
        stockName: stockName || symbol,
        symbol,
        exchange,
        buyQuantity: 0,
        buyValue: 0,
        sellQuantity: 0,
        sellValue: 0,
        brokerage: 0,
        stt: 0,
        exchangeCharges: 0,
        gst: 0,
        stampDuty: 0,
        otherCharges: 0,
        totalCharges: 0,
        externalTradeIds: []
      };
      if (isBuySide(side)) {
        current.buyQuantity += quantity;
        current.buyValue += quantity * rate;
      } else {
        current.sellQuantity += quantity;
        current.sellValue += quantity * rate;
      }
      current.brokerage += sourceNumber(mappedValue(row, table.map, "brokerage"));
      current.stt += sourceNumber(mappedValue(row, table.map, "stt"));
      current.exchangeCharges += sourceNumber(mappedValue(row, table.map, "exchangeCharges"));
      current.gst += sourceNumber(mappedValue(row, table.map, "gst"));
      current.stampDuty += sourceNumber(mappedValue(row, table.map, "stampDuty"));
      current.otherCharges += sourceNumber(mappedValue(row, table.map, "otherCharges"));
      current.totalCharges += sourceNumber(mappedValue(row, table.map, "totalCharges"));
      const tradeId = cleanIdentifier(mappedValue(row, table.map, "tradeId"));
      if (tradeId) current.externalTradeIds.push(tradeId);
      groups.set(key, current);
    }
    groups.forEach((group) => {
      const quantity = Math.min(group.buyQuantity, group.sellQuantity);
      if (quantity <= 0) return;
      const mismatch = Math.abs(group.buyQuantity - group.sellQuantity);
      if (mismatch > 0.000001) warnings.push(`${group.symbol || group.stockName} on ${group.tradeDate} has unmatched intraday quantity (${group.buyQuantity} buy / ${group.sellQuantity} sell).`);
      const buyRate = group.buyQuantity > 0 ? group.buyValue / group.buyQuantity : 0;
      const sellRate = group.sellQuantity > 0 ? group.sellValue / group.sellQuantity : 0;
      const grossPnl = (sellRate - buyRate) * quantity;
      const componentCharges = group.brokerage + group.stt + group.exchangeCharges + group.gst + group.stampDuty + group.otherCharges;
      const totalCharges = group.totalCharges || componentCharges;
      const netPnl = grossPnl - totalCharges;
      trades.push({
        source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
        provider: "Bajaj Broking",
        tradeType: "intraday",
        tradeDate: group.tradeDate,
        stockName: group.stockName,
        instrumentName: group.stockName,
        symbol: group.symbol,
        exchange: group.exchange,
        buyQuantity: Number(group.buyQuantity.toFixed(6)),
        sellQuantity: Number(group.sellQuantity.toFixed(6)),
        quantity: Number(quantity.toFixed(6)),
        buyRate: Number(buyRate.toFixed(6)),
        sellRate: Number(sellRate.toFixed(6)),
        grossPnl: Number(grossPnl.toFixed(2)),
        brokerage: Number(group.brokerage.toFixed(2)),
        stt: Number(group.stt.toFixed(2)),
        exchangeCharges: Number(group.exchangeCharges.toFixed(2)),
        gst: Number(group.gst.toFixed(2)),
        stampDuty: Number(group.stampDuty.toFixed(2)),
        otherCharges: Number(group.otherCharges.toFixed(2)),
        totalCharges: Number(totalCharges.toFixed(2)),
        netPnl: Number(netPnl.toFixed(2)),
        externalTradeId: [...new Set(group.externalTradeIds)].sort().join(","),
        status: "Closed",
        notes: "Aggregated from Bajaj side-wise trade rows"
      });
    });
  }

  if (!trades.length) throw new Error("No closed Bajaj intraday trades were found in this report.");
  const id = finishBajajIdentity(identity, matrix.slice(0, table.headerIndex));
  const summary = trades.reduce((total, item) => {
    total.grossPnl += Number(item.grossPnl || 0);
    total.totalCharges += Number(item.totalCharges || 0);
    total.netPnl += Number(item.netPnl || 0);
    total.turnover += Number(item.buyRate || 0) * Number(item.buyQuantity || item.quantity || 0) + Number(item.sellRate || 0) * Number(item.sellQuantity || item.quantity || 0);
    return total;
  }, { grossPnl: 0, totalCharges: 0, netPnl: 0, turnover: 0 });
  const dates = trades.map((item) => item.tradeDate).filter(Boolean).sort();
  return {
    ...id,
    holdings: [],
    transactions: [],
    trades,
    warnings,
    blockingError: warnings.length ? "Some side-wise intraday rows have unmatched buy/sell quantities. GrowVest will not auto-import this file until the quantity mismatch is reviewed." : "",
    reportPeriodStart: dates[0] || "",
    reportPeriodEnd: dates.at(-1) || "",
    summary: {
      totalInvested: 0,
      currentValue: 0,
      gainLoss: 0,
      positionCount: 0,
      transactionCount: trades.length,
      tradeCount: trades.length,
      grossPnl: Number(summary.grossPnl.toFixed(2)),
      totalCharges: Number(summary.totalCharges.toFixed(2)),
      netPnl: Number(summary.netPnl.toFixed(2)),
      turnover: Number(summary.turnover.toFixed(2))
    }
  };
}


function mergeBajajResults(results = []) {
  const valid = results.filter(Boolean);
  if (!valid.length) throw new Error("No supported Bajaj data was found in this workbook.");
  const names = new Set(valid.map((item) => normaliseExternalName(item.externalClientName)).filter(Boolean));
  const pans = new Set(valid.map((item) => item.externalPan).filter(Boolean));
  const clientCodes = new Set(valid.map((item) => item.externalClientCode).filter(Boolean));
  if (names.size > 1 || pans.size > 1 || clientCodes.size > 1) {
    throw new Error("The Bajaj workbook contains conflicting investor identities across sheets. Upload one investor per workbook.");
  }
  const externalClientName = valid.find((item) => item.externalClientName)?.externalClientName || "";
  const externalPan = valid.find((item) => item.externalPan)?.externalPan || "";
  const externalClientCode = valid.find((item) => item.externalClientCode)?.externalClientCode || "";
  const holdings = valid.flatMap((item) => item.holdings || []);
  const transactions = valid.flatMap((item) => item.transactions || []);
  const trades = valid.flatMap((item) => item.trades || []);
  const warnings = valid.flatMap((item) => item.warnings || []);
  const startDates = valid.map((item) => item.reportPeriodStart).filter(Boolean).sort();
  const endDates = valid.map((item) => item.reportPeriodEnd || item.summary?.valuationDate).filter(Boolean).sort();
  const summary = valid.reduce((total, item) => {
    total.totalInvested += Number(item.summary?.totalInvested || 0);
    total.currentValue += Number(item.summary?.currentValue || 0);
    total.gainLoss += Number(item.summary?.gainLoss || 0);
    total.grossPnl += Number(item.summary?.grossPnl || 0);
    total.totalCharges += Number(item.summary?.totalCharges || 0);
    total.netPnl += Number(item.summary?.netPnl || 0);
    total.turnover += Number(item.summary?.turnover || 0);
    return total;
  }, { totalInvested: 0, currentValue: 0, gainLoss: 0, grossPnl: 0, totalCharges: 0, netPnl: 0, turnover: 0 });
  return {
    externalClientName,
    normalizedExternalClientName: normaliseExternalName(externalClientName),
    externalPan,
    externalClientCode,
    holdings,
    transactions,
    trades,
    warnings,
    blockingError: valid.map((item) => item.blockingError).filter(Boolean).join(" "),
    reportPeriodStart: startDates[0] || "",
    reportPeriodEnd: endDates.at(-1) || "",
    summary: {
      totalInvested: Number(summary.totalInvested.toFixed(2)),
      currentValue: Number(summary.currentValue.toFixed(2)),
      gainLoss: Number(summary.gainLoss.toFixed(2)),
      positionCount: holdings.length,
      transactionCount: transactions.length + trades.length,
      tradeCount: trades.length,
      grossPnl: Number(summary.grossPnl.toFixed(2)),
      totalCharges: Number(summary.totalCharges.toFixed(2)),
      netPnl: Number(summary.netPnl.toFixed(2)),
      turnover: Number(summary.turnover.toFixed(2)),
      valuationDate: endDates.at(-1) || ""
    }
  };
}


function transactionMode(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("sip")) return "SIP";
  if (/purchase|fresh|additional|lump|switch\s*in/.test(text)) return "Lump Sum";
  return "Other";
}

function normalisePan(value = "") {
  const pan = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) ? pan : "";
}

function nonEmptyCells(row = []) {
  return row
    .map((value, index) => ({ index, value: String(value ?? "").trim(), normalized: normaliseHeader(value) }))
    .filter((item) => item.value);
}

function findHeaderIndex(row = [], aliases = []) {
  const normalizedAliases = aliases.map(normaliseHeader).filter(Boolean);
  const exactIndex = row.findIndex((value) => normalizedAliases.includes(normaliseHeader(value)));
  if (exactIndex >= 0) return exactIndex;
  return row.findIndex((value) => {
    const normalized = normaliseHeader(value);
    if (!normalized || normalized.length < 4) return false;
    return normalizedAliases.some((alias) => alias.length >= 4 && (normalized.includes(alias) || alias.includes(normalized)));
  });
}

function firstValueInRange(row = [], start = 0, end = row.length) {
  const safeStart = Math.max(0, Number(start || 0));
  const safeEnd = Math.min(row.length, Number.isFinite(end) ? end : row.length);
  for (let index = safeStart; index < safeEnd; index += 1) {
    const value = String(row[index] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function nextNonEmptyValue(row = [], startIndex = 0, endIndex = row.length) {
  return firstValueInRange(row, Number(startIndex || 0) + 1, endIndex);
}

function ledgerReportPeriod(matrix = []) {
  const text = matrix.slice(0, 20).flatMap((row) => row).map((value) => String(value || "").trim()).filter(Boolean).join(" | ");
  const match = text.match(/Period\s+from\s+(.+?)\s+to\s+([^|]+)/i);
  return {
    startDate: match ? sourceDate(match[1].trim()) : "",
    endDate: match ? sourceDate(match[2].trim()) : ""
  };
}

function findLedgerSummaryTable(matrix = []) {
  for (let index = 0; index < matrix.length; index += 1) {
    const row = matrix[index] || [];
    const anchors = {
      schemeName: findHeaderIndex(row, ["Scheme Name"]),
      folioNo: findHeaderIndex(row, ["Folio No"]),
      purchaseAmount: findHeaderIndex(row, ["Purchase Amt", "Purchase Amount"]),
      switchInAmount: findHeaderIndex(row, ["SwitchIn Amt", "Switch In Amt"]),
      redemptionAmount: findHeaderIndex(row, ["Redemption Amt", "Redemption Amount"]),
      switchOutAmount: findHeaderIndex(row, ["SwitchOut Amt", "Switch Out Amt"]),
      dividendPayout: findHeaderIndex(row, ["Dividend Payout"]),
      netInvestment: findHeaderIndex(row, ["Net Investment"]),
      currentValue: findHeaderIndex(row, ["Current Value"]),
      absReturn: findHeaderIndex(row, ["ABS Return", "ABS Return %"]),
      xirr: findHeaderIndex(row, ["XIRR", "XIRR %"])
    };
    const required = [anchors.schemeName, anchors.folioNo, anchors.netInvestment, anchors.currentValue];
    if (required.every((item) => item >= 0)) return { headerIndex: index, anchors };
  }
  return null;
}

function anchorValue(row = [], anchors = {}, key) {
  const entries = Object.entries(anchors)
    .filter(([, index]) => Number(index) >= 0)
    .sort((left, right) => left[1] - right[1]);
  const currentIndex = anchors[key];
  if (currentIndex < 0) return "";
  const position = entries.findIndex(([name]) => name === key);
  const nextIndex = position >= 0 && position + 1 < entries.length ? entries[position + 1][1] : row.length;
  return firstValueInRange(row, currentIndex, nextIndex);
}

function ledgerClientCandidate(matrix = [], summaryHeaderIndex = 0) {
  for (let index = summaryHeaderIndex - 1; index >= Math.max(0, summaryHeaderIndex - 12); index -= 1) {
    const values = nonEmptyCells(matrix[index] || []).map((item) => item.value);
    if (values.length !== 1) continue;
    const value = values[0];
    const normalized = normaliseHeader(value);
    if (!normalized || /portfolio ledger report|period from|@|arn|registered|mumbai|address|\d{6}/i.test(value)) continue;
    if (/^[A-Z][A-Z .'-]{3,}$/i.test(value)) return value.trim();
  }
  return "";
}

function transactionKind(value = "") {
  const text = normaliseHeader(value);
  if (text.includes("sip")) return "SIP";
  if (text.includes("switch in")) return "Switch In";
  if (text.includes("switch out")) return "Switch Out";
  if (/redemption|redeem|withdraw/.test(text)) return "Redemption";
  if (/dividend/.test(text)) return "Dividend";
  if (/purchase|fresh|additional|lump/.test(text)) return "Purchase";
  return String(value || "").trim() || "Investment";
}

function signedUnitsForTransaction(transactionType = "", units = 0) {
  const kind = transactionKind(transactionType);
  const value = Math.abs(Number(units || 0));
  return ["Redemption", "Switch Out"].includes(kind) ? -value : value;
}

function parseFundbazaarLedger(matrix = []) {
  const summaryTable = findLedgerSummaryTable(matrix);
  if (!summaryTable) throw new Error("Fundbazaar Portfolio Ledger was detected, but its scheme summary table could not be read.");

  const period = ledgerReportPeriod(matrix);
  const summaryHoldings = [];
  for (let index = summaryTable.headerIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index] || [];
    const schemeName = anchorValue(row, summaryTable.anchors, "schemeName");
    const normalizedScheme = normaliseHeader(schemeName);
    if (!schemeName) continue;
    if (["total", "grand total"].includes(normalizedScheme)) break;
    const folioNo = anchorValue(row, summaryTable.anchors, "folioNo");
    const currentValue = sourceNumber(anchorValue(row, summaryTable.anchors, "currentValue"));
    const netInvestment = sourceNumber(anchorValue(row, summaryTable.anchors, "netInvestment"));
    if (!folioNo && !currentValue && !netInvestment) continue;
    summaryHoldings.push({
      key: `${normaliseExternalName(schemeName)}__${folioNo || "NO_FOLIO"}`,
      productType: PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND,
      source: PORTFOLIO_SOURCES.FUNDBAZAAR,
      provider: "Fundbazaar",
      instrumentName: schemeName,
      schemeName,
      isin: "",
      folioNo,
      nature: "",
      assetClass: "Other",
      grossPurchaseAmount: sourceNumber(anchorValue(row, summaryTable.anchors, "purchaseAmount")),
      switchInAmount: sourceNumber(anchorValue(row, summaryTable.anchors, "switchInAmount")),
      redemptionAmount: sourceNumber(anchorValue(row, summaryTable.anchors, "redemptionAmount")),
      switchOutAmount: sourceNumber(anchorValue(row, summaryTable.anchors, "switchOutAmount")),
      dividendPayout: sourceNumber(anchorValue(row, summaryTable.anchors, "dividendPayout")),
      netInvestment,
      totalInvested: netInvestment,
      totalUnits: 0,
      currentValue,
      gainLoss: 0,
      currentNav: 0,
      navDate: period.endDate,
      averagePurchaseNav: 0,
      returnPercentage: sourceNumber(anchorValue(row, summaryTable.anchors, "absReturn")),
      weightedCagr: sourceNumber(anchorValue(row, summaryTable.anchors, "xirr")),
      monthlySip: 0,
      investmentMode: "Lump Sum",
      transactionCount: 0
    });
  }
  if (!summaryHoldings.length) throw new Error("No mutual fund holdings were found in the Fundbazaar Portfolio Ledger.");

  const holdingByFolio = new Map(summaryHoldings.filter((item) => item.folioNo).map((item) => [String(item.folioNo), item]));
  const transactions = [];
  const clientNames = new Set();
  const pans = new Set();

  for (let index = 0; index < matrix.length; index += 1) {
    const row = matrix[index] || [];
    const folioLabelIndex = findHeaderIndex(row, ["Folio No"]);
    const panLabelIndex = findHeaderIndex(row, ["PAN No", "PAN"]);
    if (folioLabelIndex < 0 || panLabelIndex < 0) continue;

    const folioNo = nextNonEmptyValue(row, folioLabelIndex, panLabelIndex);
    const pan = normalisePan(nextNonEmptyValue(row, panLabelIndex));
    if (pan) pans.add(pan);
    const holding = holdingByFolio.get(String(folioNo || ""));

    let contextRow = null;
    for (let back = index - 1; back >= Math.max(0, index - 4); back -= 1) {
      const values = nonEmptyCells(matrix[back] || []);
      if (values.length >= 2) { contextRow = values; break; }
    }
    if (contextRow) {
      const values = contextRow.map((item) => item.value);
      const schemeName = holding?.schemeName || values.at(-1) || "";
      const clientName = values.find((value) => normaliseExternalName(value) !== normaliseExternalName(schemeName)) || "";
      if (clientName && !/portfolio ledger report/i.test(clientName)) clientNames.add(clientName.trim());
      if (holding && schemeName) {
        holding.schemeName = schemeName;
        holding.instrumentName = schemeName;
      }
    }

    const cellsAfterPan = nonEmptyCells(row).filter((item) => item.index > panLabelIndex && item.value !== pan);
    const nature = cellsAfterPan.length ? cellsAfterPan.at(-1).value : "";
    if (holding && nature) {
      holding.nature = nature;
      holding.assetClass = portfolioAssetClass(PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, nature);
    }

    let headerIndex = -1;
    for (let next = index + 1; next <= Math.min(matrix.length - 1, index + 6); next += 1) {
      const nextRow = matrix[next] || [];
      if (findHeaderIndex(nextRow, ["Tran Date", "Transaction Date"]) >= 0
        && findHeaderIndex(nextRow, ["Tran Type", "Transaction Type"]) >= 0) {
        headerIndex = next;
        break;
      }
    }
    if (headerIndex < 0) continue;

    const header = matrix[headerIndex] || [];
    const anchors = {
      transactionDate: findHeaderIndex(header, ["Tran Date", "Transaction Date"]),
      transactionType: findHeaderIndex(header, ["Tran Type", "Transaction Type"]),
      investedAmount: findHeaderIndex(header, ["Invested Amount"]),
      navRate: findHeaderIndex(header, ["NAV Rate"]),
      units: findHeaderIndex(header, ["Units"]),
      balanceUnits: findHeaderIndex(header, ["Balance Units"]),
      navDate: findHeaderIndex(header, ["NAV Date"]),
      days: findHeaderIndex(header, ["Days"]),
      profitLoss: findHeaderIndex(header, ["Profit Loss", "Profit/Loss"])
    };

    let marketRow = null;
    for (let txIndex = headerIndex + 1; txIndex < matrix.length; txIndex += 1) {
      const txRow = matrix[txIndex] || [];
      const txDateRaw = anchorValue(txRow, anchors, "transactionDate");
      if (/market value/i.test(txDateRaw)) {
        marketRow = txRow;
        index = txIndex;
        break;
      }
      const rawType = anchorValue(txRow, anchors, "transactionType");
      const transactionDate = sourceDate(txDateRaw);
      if (!transactionDate || !rawType || /opening inv/i.test(rawType)) continue;
      const investedAmount = sourceNumber(anchorValue(txRow, anchors, "investedAmount"));
      const navRate = sourceNumber(anchorValue(txRow, anchors, "navRate"));
      const units = sourceNumber(anchorValue(txRow, anchors, "units"));
      const kind = transactionKind(rawType);
      transactions.push({
        sourceRow: txIndex + 1,
        clientName: [...clientNames].at(-1) || "",
        pan,
        schemeName: holding?.schemeName || "",
        isin: holding?.isin || "",
        nature: holding?.nature || nature,
        folioNo,
        transactionDate,
        transactionType: kind,
        sourceTransactionType: String(rawType || "").trim(),
        investmentMode: transactionMode(rawType),
        investedAmount,
        purchaseAmount: investedAmount,
        navRate,
        purchaseNav: navRate,
        units,
        signedUnits: signedUnitsForTransaction(kind, units),
        balanceUnits: sourceNumber(anchorValue(txRow, anchors, "balanceUnits")),
        navDate: sourceDate(anchorValue(txRow, anchors, "navDate")),
        days: sourceNumber(anchorValue(txRow, anchors, "days")),
        profitLoss: sourceNumber(anchorValue(txRow, anchors, "profitLoss"))
      });
    }

    if (holding) {
      const holdingTransactions = transactions.filter((item) => String(item.folioNo) === String(folioNo));
      const sipTransactions = holdingTransactions.filter((item) => item.investmentMode === "SIP");
      const nonSipPurchase = holdingTransactions.some((item) => ["Purchase", "Switch In"].includes(transactionKind(item.transactionType)) && item.investmentMode !== "SIP");
      const hasSip = sipTransactions.length > 0;
      holding.investmentMode = hasSip && nonSipPurchase ? "Both" : hasSip ? "SIP" : "Lump Sum";
      holding.transactionCount = holdingTransactions.length;
      const latestSip = [...sipTransactions].sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)))[0];
      holding.monthlySip = Math.abs(Number(latestSip?.investedAmount || 0));

      if (marketRow) {
        const marketValue = sourceNumber(anchorValue(marketRow, anchors, "transactionType"));
        const marketInvested = sourceNumber(anchorValue(marketRow, anchors, "investedAmount"));
        const marketAverageNav = sourceNumber(anchorValue(marketRow, anchors, "navRate"));
        const marketUnits = sourceNumber(anchorValue(marketRow, anchors, "units"));
        if (marketValue) holding.currentValue = marketValue;
        if (marketInvested) holding.totalInvested = marketInvested;
        if (marketAverageNav) holding.averagePurchaseNav = marketAverageNav;
        if (marketUnits) holding.totalUnits = marketUnits;
      }
      if (!holding.totalUnits) holding.totalUnits = holdingTransactions.reduce((sum, item) => sum + Number(item.signedUnits || 0), 0);
      if (!holding.currentNav && holding.totalUnits > 0 && holding.currentValue > 0) holding.currentNav = holding.currentValue / holding.totalUnits;
      if (!holding.averagePurchaseNav && holding.totalUnits > 0 && holding.totalInvested > 0) holding.averagePurchaseNav = holding.totalInvested / holding.totalUnits;
      holding.gainLoss = holding.currentValue + Number(holding.dividendPayout || 0) - holding.totalInvested;
      if (!holding.returnPercentage && holding.totalInvested > 0) holding.returnPercentage = holding.gainLoss / holding.totalInvested * 100;
    }
  }

  if (!clientNames.size) {
    const candidate = ledgerClientCandidate(matrix, summaryTable.headerIndex);
    if (candidate) clientNames.add(candidate);
  }
  if (clientNames.size > 1) {
    const normalized = new Set([...clientNames].map(normaliseExternalName).filter(Boolean));
    if (normalized.size > 1) throw new Error("The Fundbazaar Portfolio Ledger contains more than one client identity.");
  }
  if (pans.size > 1) throw new Error("The Fundbazaar Portfolio Ledger contains more than one PAN. Upload one investor ledger per file.");

  const externalClientName = [...clientNames][0] || ledgerClientCandidate(matrix, summaryTable.headerIndex);
  if (!externalClientName) throw new Error("The investor name could not be identified in this Fundbazaar Portfolio Ledger.");

  const holdings = summaryHoldings.map((holding) => ({
    ...holding,
    totalInvested: Number(Number(holding.totalInvested || 0).toFixed(2)),
    totalUnits: Number(Number(holding.totalUnits || 0).toFixed(6)),
    currentValue: Number(Number(holding.currentValue || 0).toFixed(2)),
    currentNav: Number(Number(holding.currentNav || 0).toFixed(6)),
    averagePurchaseNav: Number(Number(holding.averagePurchaseNav || 0).toFixed(6)),
    gainLoss: Number(Number(holding.gainLoss || 0).toFixed(2)),
    returnPercentage: Number(Number(holding.returnPercentage || 0).toFixed(2)),
    weightedCagr: Number(Number(holding.weightedCagr || 0).toFixed(2)),
    monthlySip: Number(Number(holding.monthlySip || 0).toFixed(2)),
    assetClass: holding.assetClass || portfolioAssetClass(PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, holding.nature)
  }));

  const summary = holdings.reduce((total, holding) => {
    total.totalInvested += Number(holding.totalInvested || 0);
    total.currentValue += Number(holding.currentValue || 0);
    total.gainLoss += Number(holding.gainLoss || 0);
    total.monthlySip += Number(holding.monthlySip || 0);
    total.totalUnits += Number(holding.totalUnits || 0);
    return total;
  }, { totalInvested: 0, currentValue: 0, gainLoss: 0, monthlySip: 0, totalUnits: 0 });

  return {
    externalClientName,
    normalizedExternalClientName: normaliseExternalName(externalClientName),
    externalPan: [...pans][0] || "",
    reportPeriodStart: period.startDate,
    reportPeriodEnd: period.endDate,
    holdings,
    transactions,
    summary: {
      totalInvested: Number(summary.totalInvested.toFixed(2)),
      currentValue: Number(summary.currentValue.toFixed(2)),
      gainLoss: Number(summary.gainLoss.toFixed(2)),
      monthlySip: Number(summary.monthlySip.toFixed(2)),
      totalUnits: Number(summary.totalUnits.toFixed(6)),
      positionCount: holdings.length,
      transactionCount: transactions.length,
      navDate: period.endDate
    }
  };
}

function parseFundbazaarRows(rows = []) {
  const transactions = [];
  const clientNames = new Set();

  rows.forEach((row, index) => {
    const clientName = String(getValue(row, ["Client"]) || "").trim();
    const schemeName = String(getValue(row, ["Scheme"]) || "").trim();
    const isin = String(getValue(row, ["ISIN"]) || "").trim();
    const folioNo = String(getValue(row, ["Folio No", "Folio"]) || "").trim();
    if (!clientName || !schemeName || /^total$/i.test(clientName)) return;

    clientNames.add(clientName);
    const nature = String(getValue(row, ["Nature"]) || "").trim();
    const tranType = String(getValue(row, ["Tran Type", "Transaction Type"]) || "").trim();
    const transactionDate = sourceDate(getValue(row, ["Tran Date", "Transaction Date"]));
    const navDate = sourceDate(getValue(row, ["NAV Date"]));
    const purchaseAmount = sourceNumber(getValue(row, ["Pur Amt", "Purchase Amount"]));
    const purchaseNav = sourceNumber(getValue(row, ["Pur NAV", "Purchase NAV"]));
    const units = sourceNumber(getValue(row, ["Units"]));
    const currentNav = sourceNumber(getValue(row, ["Curr NAV", "Current NAV"]));
    const currentAmount = sourceNumber(getValue(row, ["Curr Amt", "Current Amount"]));
    const gainShortTerm = sourceNumber(getValue(row, ["GL ST"]));
    const gainLongTerm = sourceNumber(getValue(row, ["GL LT"]));
    const returnAbsolute = sourceNumber(getValue(row, ["Ret ABS"]));
    const returnCagr = sourceNumber(getValue(row, ["Ret CAGR"]));

    transactions.push({
      sourceRow: index + 1,
      clientName,
      schemeName,
      isin,
      nature,
      folioNo,
      navDate,
      transactionDate,
      transactionType: tranType,
      investmentMode: transactionMode(tranType),
      purchaseAmount,
      purchaseNav,
      units,
      currentNav,
      currentAmount,
      gainShortTerm,
      gainLongTerm,
      gainLoss: gainShortTerm + gainLongTerm,
      returnAbsolute,
      returnCagr
    });
  });

  if (!transactions.length) throw new Error("No Fundbazaar portfolio transactions were found in this file.");
  if (clientNames.size > 1) throw new Error("The Fundbazaar file contains more than one client. Upload one client valuation report per file.");

  const holdingMap = new Map();
  transactions.forEach((transaction) => {
    const key = `${transaction.isin || transaction.schemeName}__${transaction.folioNo || "NO_FOLIO"}`;
    const current = holdingMap.get(key) || {
      key,
      productType: PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND,
      source: PORTFOLIO_SOURCES.FUNDBAZAAR,
      provider: "Fundbazaar",
      instrumentName: transaction.schemeName,
      schemeName: transaction.schemeName,
      isin: transaction.isin,
      folioNo: transaction.folioNo,
      nature: transaction.nature,
      assetClass: portfolioAssetClass(PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND, transaction.nature),
      totalInvested: 0,
      totalUnits: 0,
      currentValue: 0,
      gainLoss: 0,
      currentNav: 0,
      navDate: "",
      monthlySip: 0,
      investmentMode: "Lump Sum",
      transactionCount: 0,
      weightedCagrNumerator: 0,
      weightedCagrDenominator: 0,
      modes: new Set(),
      latestSipDate: ""
    };

    current.totalInvested += transaction.purchaseAmount;
    current.totalUnits += transaction.units;
    current.currentValue += transaction.currentAmount;
    current.gainLoss += transaction.gainLoss;
    current.transactionCount += 1;
    current.modes.add(transaction.investmentMode);
    if (transaction.returnCagr && transaction.purchaseAmount > 0) {
      current.weightedCagrNumerator += transaction.returnCagr * transaction.purchaseAmount;
      current.weightedCagrDenominator += transaction.purchaseAmount;
    }
    if (!current.navDate || transaction.navDate >= current.navDate) {
      current.navDate = transaction.navDate;
      current.currentNav = transaction.currentNav;
    }
    if (transaction.investmentMode === "SIP" && (!current.latestSipDate || transaction.transactionDate >= current.latestSipDate)) {
      current.latestSipDate = transaction.transactionDate;
      current.monthlySip = transaction.purchaseAmount;
    }
    holdingMap.set(key, current);
  });

  const holdings = [...holdingMap.values()].map((holding) => {
    const modes = holding.modes;
    const hasSip = modes.has("SIP");
    const hasLumpSum = modes.has("Lump Sum") || modes.has("Other");
    const investmentMode = hasSip && hasLumpSum ? "Both" : hasSip ? "SIP" : "Lump Sum";
    const averagePurchaseNav = holding.totalUnits > 0 ? holding.totalInvested / holding.totalUnits : 0;
    const returnPercentage = holding.totalInvested > 0 ? (holding.gainLoss / holding.totalInvested) * 100 : 0;
    const weightedCagr = holding.weightedCagrDenominator > 0
      ? holding.weightedCagrNumerator / holding.weightedCagrDenominator
      : 0;
    const { modes: _modes, weightedCagrNumerator: _n, weightedCagrDenominator: _d, latestSipDate: _s, ...clean } = holding;
    return {
      ...clean,
      investmentMode,
      averagePurchaseNav: Number(averagePurchaseNav.toFixed(6)),
      totalInvested: Number(holding.totalInvested.toFixed(2)),
      totalUnits: Number(holding.totalUnits.toFixed(6)),
      currentValue: Number(holding.currentValue.toFixed(2)),
      gainLoss: Number(holding.gainLoss.toFixed(2)),
      returnPercentage: Number(returnPercentage.toFixed(2)),
      weightedCagr: Number(weightedCagr.toFixed(2))
    };
  });

  const summary = holdings.reduce((total, holding) => ({
    totalInvested: total.totalInvested + holding.totalInvested,
    currentValue: total.currentValue + holding.currentValue,
    gainLoss: total.gainLoss + holding.gainLoss,
    monthlySip: total.monthlySip + holding.monthlySip,
    totalUnits: total.totalUnits + holding.totalUnits
  }), { totalInvested: 0, currentValue: 0, gainLoss: 0, monthlySip: 0, totalUnits: 0 });

  const latestNavDate = holdings.map((item) => item.navDate).filter(Boolean).sort().at(-1) || "";

  return {
    externalClientName: [...clientNames][0],
    normalizedExternalClientName: normaliseExternalName([...clientNames][0]),
    holdings,
    transactions,
    summary: {
      ...summary,
      totalInvested: Number(summary.totalInvested.toFixed(2)),
      currentValue: Number(summary.currentValue.toFixed(2)),
      gainLoss: Number(summary.gainLoss.toFixed(2)),
      monthlySip: Number(summary.monthlySip.toFixed(2)),
      totalUnits: Number(summary.totalUnits.toFixed(6)),
      positionCount: holdings.length,
      transactionCount: transactions.length,
      navDate: latestNavDate
    }
  };
}

async function workbookSheets(buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: false });
  return workbook.SheetNames.map((sheetName) => ({
    sheetName,
    matrix: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false
    })
  }));
}

function matrixTerms(matrix = [], maxRows = 80) {
  return new Set(
    matrix.slice(0, maxRows)
      .flatMap((row) => row)
      .map(normaliseHeader)
      .filter(Boolean)
  );
}

function hasTerms(terms, candidates = [], minimum = candidates.length) {
  let matches = 0;
  candidates.forEach((candidate) => {
    const normalized = normaliseHeader(candidate);
    if ([...terms].some((term) => term === normalized || term.includes(normalized) || normalized.includes(term))) matches += 1;
  });
  return matches >= minimum;
}

function detectMatrixReport(matrix = [], sheetName = "") {
  const fundbazaarTable = findFundbazaarTable(matrix);
  if (fundbazaarTable) {
    return {
      source: PORTFOLIO_SOURCES.FUNDBAZAAR,
      reportType: PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_CLIENT_VALUATION,
      adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
      confidence: 1,
      sheetName,
      fundbazaarTable
    };
  }

  const terms = matrixTerms(matrix);
  const sheet = normaliseHeader(sheetName);
  const bajajBrand = sheet.includes("bajaj") || [...terms].some((term) => term.includes("bajaj broking") || term === "bajaj");

  if (hasTerms(terms, ["scheme name", "folio no", "net investment", "current value", "xirr"], 4)
    || hasTerms(terms, ["transaction date", "transaction type", "nav rate", "balance units", "scheme name"], 4)) {
    return { source: PORTFOLIO_SOURCES.FUNDBAZAAR, reportType: PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_LEDGER, adapterStatus: PORTFOLIO_ADAPTER_STATUS.UNSUPPORTED, confidence: 0.98, sheetName, error: "Fundbazaar Portfolio Ledger is not applicable for GrowVest daily portfolio updates. Upload Client Wise Valuation Report.xlsx instead." };
  }

  const bajajDeliveryCandidate = findStructuredTable(
    matrix,
    BAJAJ_DELIVERY_ALIASES,
    ["quantity", "stockName", "symbol", "averageBuyRate", "investedAmount", "currentRate", "currentValue"],
    4
  );
  const bajajDeliveryTable = safeBajajDeliveryTable(bajajDeliveryCandidate) ? bajajDeliveryCandidate : null;
  if (bajajDeliveryTable && bajajBrand) {
    return {
      source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
      reportType: PORTFOLIO_REPORT_TYPES.BAJAJ_DELIVERY,
      adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
      confidence: sheet.includes("bajaj delivery") ? 1 : Math.min(0.96, 0.72 + Number(bajajDeliveryTable?.score || 0) * 0.04),
      sheetName
    };
  }

  const bajajIntradaySidewiseCandidate = findStructuredTable(
    matrix,
    BAJAJ_INTRADAY_ALIASES,
    ["tradeDate", "stockName", "symbol", "side", "quantity", "rate"],
    5
  );
  const bajajIntradaySidewise = safeBajajSidewiseIntradayTable(bajajIntradaySidewiseCandidate) ? bajajIntradaySidewiseCandidate : null;
  const bajajIntradayPairedCandidate = bajajIntradaySidewise ? null : findStructuredTable(
    matrix,
    BAJAJ_INTRADAY_ALIASES,
    ["tradeDate", "stockName", "symbol", "buyRate", "sellRate", "buyQuantity", "sellQuantity", "quantity"],
    5
  );
  const bajajIntradayPaired = safeBajajPairedIntradayTable(bajajIntradayPairedCandidate) ? bajajIntradayPairedCandidate : null;
  if ((bajajIntradayPaired || bajajIntradaySidewise) && bajajBrand) {
    return {
      source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
      reportType: PORTFOLIO_REPORT_TYPES.BAJAJ_INTRADAY,
      adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
      confidence: sheet.includes("bajaj intraday") || sheet.includes("trade book") ? 1 : 0.88,
      sheetName
    };
  }

  const ulipCandidate = findStructuredTable(
    matrix,
    ULIP_ALIASES,
    ["policyNumber", "fundName", "units", "nav", "fundValue"],
    4
  );
  const ulipTable = safeUlipTable(ulipCandidate) ? ulipCandidate : null;
  if (ulipTable || sheet === "ulip" || hasTerms(terms, ["policy number", "fund name", "units", "nav", "fund value"], 4)) {
    return {
      source: PORTFOLIO_SOURCES.ULIP,
      reportType: PORTFOLIO_REPORT_TYPES.ULIP_PORTFOLIO,
      adapterStatus: ulipTable ? PORTFOLIO_ADAPTER_STATUS.READY : PORTFOLIO_ADAPTER_STATUS.DETECTED_NOT_ENABLED,
      confidence: ulipTable ? (sheet === "ulip" ? 1 : Math.min(0.96, 0.76 + Number(ulipTable?.score || 0) * 0.04)) : 0.8,
      sheetName
    };
  }

  if (["portfolio holdings", "holdings", "portfolio import"].includes(sheet)) {
    const genericTable = genericHeaderCandidate(matrix);
    if (genericTable) {
      return {
        source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
        reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
        adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
        confidence: 1,
        sheetName,
        genericConfig: { rowMode: "holdings" }
      };
    }
  }

  if (sheet === "manual mutual fund") {
    const genericTable = genericHeaderCandidate(matrix);
    if (genericTable) {
      return {
        source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
        reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
        adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
        confidence: 0.98,
        sheetName,
        genericConfig: { rowMode: "transactions", deriveHoldingsFromTransactions: true, defaults: { productType: "Mutual Fund", provider: "Manual / Other" } }
      };
    }
  }

  if (sheet === "other investments") {
    const genericTable = genericHeaderCandidate(matrix);
    if (genericTable) {
      return {
        source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
        reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
        adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
        confidence: 0.98,
        sheetName,
        genericConfig: { rowMode: "holdings" }
      };
    }
  }

  const genericTable = genericHeaderCandidate(matrix);
  if (genericTable && genericTable.score >= 4) {
    return {
      source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
      reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
      adapterStatus: PORTFOLIO_ADAPTER_STATUS.MAPPING_REQUIRED,
      confidence: Math.min(0.88, 0.55 + genericTable.score * 0.03),
      sheetName,
      genericTable
    };
  }

  return null;
}

function excelWebWrapper(text = "") {
  const value = String(text || "");
  return /Excel Workbook Frameset/i.test(value)
    || /<frame[^>]+src=["']?[^>]*_files\/sheet\d+\.htm/i.test(value)
    || /rel=File-List[^>]+_files\/filelist\.xml/i.test(value);
}

export async function detectPortfolioImportFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fingerprint = crypto.createHash("sha256").update(buffer).digest("hex");
  const textStart = buffer.slice(0, 4096).toString("utf8");
  const start = textStart.trimStart().toLowerCase();
  const isHtml = start.startsWith("<table") || start.startsWith("<!doctype") || start.startsWith("<html");

  const base = {
    fileName: file.name,
    fileSize: file.size,
    fileFingerprint: fingerprint,
    source: PORTFOLIO_SOURCES.MANUAL,
    reportType: PORTFOLIO_REPORT_TYPES.UNKNOWN,
    adapterStatus: PORTFOLIO_ADAPTER_STATUS.UNSUPPORTED,
    confidence: 0,
    sheetName: "",
    fileFormat: isHtml ? "HTML-XLS" : (/\.xlsx$/i.test(file.name) ? "XLSX" : /\.xls$/i.test(file.name) ? "XLS" : /\.csv$/i.test(file.name) ? "CSV" : "Unknown")
  };

  if (isHtml && excelWebWrapper(buffer.toString("utf8"))) {
    return {
      ...base,
      source: PORTFOLIO_SOURCES.FUNDBAZAAR,
      reportType: PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_WEB_WRAPPER,
      adapterStatus: PORTFOLIO_ADAPTER_STATUS.NEEDS_PACKAGE,
      confidence: 1,
      error: "Excel web-wrapper detected. The actual portfolio table is stored in the companion _files/sheet001.htm folder. Upload the original Fundbazaar download; ZIP package support will be added separately."
    };
  }

  if (isHtml) {
    const matrix = htmlFundbazaarRows(buffer.toString("utf8"));
    const detection = detectMatrixReport(matrix, "HTML Export");
    if (detection?.reportType === PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_CLIENT_VALUATION) {
      const table = detection.fundbazaarTable;
      const parsed = parseFundbazaarRows(makeRows(matrix, table.headerIndex, table.headers));
      return {
        ...base,
        ...detection,
        ...parsed,
        adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
        fundbazaarBootstrapOnly: true,
        warnings: [
          ...(parsed.warnings || []),
          "Legacy Fundbazaar HTML-XLS is accepted only to establish a completely blank/newly reset portfolio. After the first successful import, use Client Wise Valuation Report.xlsx for normal daily updates."
        ],
        error: ""
      };
    }
    return { ...base, error: "The HTML/XLS file was read, but its portfolio report structure is not recognised yet." };
  }

  if (/\.(xls|xlsx|csv)$/i.test(file.name)) {
    try {
      const sheets = await workbookSheets(buffer);

      const standard = standardWorkbookResult(sheets);
      if (standard) {
        const hasStandardRows = Boolean(standard.holdings?.length || standard.transactions?.length);
        return {
          ...base,
          source: PORTFOLIO_SOURCES.GROWVEST_STANDARD,
          reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
          adapterStatus: hasStandardRows ? PORTFOLIO_ADAPTER_STATUS.READY : PORTFOLIO_ADAPTER_STATUS.UNSUPPORTED,
          confidence: 1,
          sheetName: sheets.filter((item) => ["portfolio holdings", "holdings", "portfolio import", "transactions", "portfolio transactions", "investment transactions"].includes(normaliseHeader(item.sheetName))).map((item) => item.sheetName).join(", "),
          completeSnapshot: true,
          ...standard,
          error: hasStandardRows ? "" : "GrowVest Standard template detected, but no portfolio data rows were found. Add at least one holding or transaction before uploading."
        };
      }

      let best = null;
      const detectedSheets = [];
      for (const sheet of sheets) {
        const detection = detectMatrixReport(sheet.matrix, sheet.sheetName);
        if (!detection) continue;
        detectedSheets.push({ ...sheet, detection });
        if (!best || detection.confidence > best.detection.confidence) best = { ...sheet, detection };
        if (detection.reportType === PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_CLIENT_VALUATION) {
          const table = detection.fundbazaarTable;
          const parsed = parseFundbazaarRows(makeRows(sheet.matrix, table.headerIndex, table.headers));
          if (!/\.xlsx$/i.test(file.name)) {
            if (/\.xls$/i.test(file.name)) {
              return {
                ...base,
                ...detection,
                ...parsed,
                adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
                fundbazaarBootstrapOnly: true,
                warnings: [
                  ...(parsed.warnings || []),
                  "Legacy Fundbazaar XLS is accepted only to establish a completely blank/newly reset portfolio. After the first successful import, use Client Wise Valuation Report.xlsx for normal daily updates."
                ],
                error: ""
              };
            }
            return {
              ...base,
              ...detection,
              ...parsed,
              adapterStatus: PORTFOLIO_ADAPTER_STATUS.UNSUPPORTED,
              error: "Fundbazaar daily import requires Client Wise Valuation Report.xlsx. The selected report is readable, but it is not an .xlsx workbook."
            };
          }
          return { ...base, ...detection, ...parsed };
        }
        if (detection.reportType === PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_LEDGER) {
          return {
            ...base,
            ...detection,
            adapterStatus: PORTFOLIO_ADAPTER_STATUS.UNSUPPORTED,
            error: "Fundbazaar Portfolio Ledger is not applicable. Upload Client Wise Valuation Report.xlsx instead."
          };
        }
        if (detection.reportType === PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD
          && detection.adapterStatus === PORTFOLIO_ADAPTER_STATUS.READY) {
          const parsed = parseGenericMatrix(sheet.matrix, detection.genericConfig || { rowMode: "holdings" }, sheet.sheetName);
          const hasRows = Boolean(parsed.holdings?.length || parsed.transactions?.length);
          return {
            ...base,
            ...detection,
            ...parsed,
            adapterStatus: hasRows ? PORTFOLIO_ADAPTER_STATUS.READY : PORTFOLIO_ADAPTER_STATUS.UNSUPPORTED,
            completeSnapshot: detection.genericConfig?.rowMode !== "transactions",
            error: hasRows ? "" : "GrowVest Standard sheet detected, but no portfolio data rows were found."
          };
        }
      }

      const sheetNames = sheets.map((item) => normaliseHeader(item.sheetName));
      const standardTemplateSheetCount = ["bajaj delivery", "bajaj intraday", "ulip", "manual mutual fund", "other investments"]
        .filter((name) => sheetNames.includes(name)).length;
      if (standardTemplateSheetCount >= 3) {
        return {
          ...base,
          source: PORTFOLIO_SOURCES.MIXED,
          reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
          adapterStatus: PORTFOLIO_ADAPTER_STATUS.DETECTED_NOT_ENABLED,
          confidence: 1,
          sheetName: sheets.map((item) => item.sheetName).join(", "),
          error: "GrowVest Standard multi-asset workbook detected. Bajaj and ULIP are enabled as standalone source imports, but mixed multi-source sheets must be uploaded separately until the generic standard-template commit adapter is enabled."
        };
      }

      const bajajSheets = detectedSheets.filter((item) => item.detection.source === PORTFOLIO_SOURCES.BAJAJ_BROKING);
      const ulipSheets = detectedSheets.filter((item) => item.detection.source === PORTFOLIO_SOURCES.ULIP && item.detection.adapterStatus === PORTFOLIO_ADAPTER_STATUS.READY);

      if (bajajSheets.length && ulipSheets.length) {
        return {
          ...base,
          source: PORTFOLIO_SOURCES.MIXED,
          reportType: PORTFOLIO_REPORT_TYPES.GROWVEST_STANDARD,
          adapterStatus: PORTFOLIO_ADAPTER_STATUS.DETECTED_NOT_ENABLED,
          confidence: 1,
          sheetName: [...bajajSheets, ...ulipSheets].map((item) => item.sheetName).join(", "),
          error: "A mixed Bajaj + ULIP workbook was detected. Upload Bajaj and ULIP reports as separate files so each source can be verified and recovered independently."
        };
      }

      if (ulipSheets.length) {
        const parsed = mergeUlipResults(ulipSheets.map((item) => parseUlipPortfolio(item.matrix)));
        return {
          ...base,
          source: PORTFOLIO_SOURCES.ULIP,
          reportType: PORTFOLIO_REPORT_TYPES.ULIP_PORTFOLIO,
          adapterStatus: PORTFOLIO_ADAPTER_STATUS.READY,
          confidence: Math.max(...ulipSheets.map((item) => Number(item.detection.confidence || 0))),
          sheetName: ulipSheets.map((item) => item.sheetName).join(", "),
          ...parsed
        };
      }

      if (bajajSheets.length) {
        const parsedParts = bajajSheets.map((item) => item.detection.reportType === PORTFOLIO_REPORT_TYPES.BAJAJ_DELIVERY
          ? parseBajajDelivery(item.matrix)
          : parseBajajIntraday(item.matrix));
        const parsed = mergeBajajResults(parsedParts);
        const hasDelivery = parsed.holdings.length > 0;
        const hasIntraday = parsed.trades.length > 0;
        const reportType = hasDelivery && hasIntraday
          ? PORTFOLIO_REPORT_TYPES.BAJAJ_COMBINED
          : hasDelivery ? PORTFOLIO_REPORT_TYPES.BAJAJ_DELIVERY : PORTFOLIO_REPORT_TYPES.BAJAJ_INTRADAY;
        const blockingError = parsed.blockingError || "";
        return {
          ...base,
          source: PORTFOLIO_SOURCES.BAJAJ_BROKING,
          reportType,
          adapterStatus: blockingError ? PORTFOLIO_ADAPTER_STATUS.DETECTED_NOT_ENABLED : PORTFOLIO_ADAPTER_STATUS.READY,
          confidence: Math.max(...bajajSheets.map((item) => Number(item.detection.confidence || 0))),
          sheetName: bajajSheets.map((item) => item.sheetName).join(", "),
          ...parsed,
          error: blockingError
        };
      }

      if (best) {
        if (best.detection.adapterStatus === PORTFOLIO_ADAPTER_STATUS.MAPPING_REQUIRED) {
          const candidate = best.detection.genericTable || genericHeaderCandidate(best.matrix);
          return {
            ...base,
            ...best.detection,
            genericMapping: candidate ? {
              sheetName: best.sheetName,
              headerRowIndex: candidate.headerIndex,
              headers: candidate.headers,
              headerSignature: genericHeaderSignature(candidate.headers),
              suggestedMapping: Object.fromEntries(Object.entries(candidate.map).filter(([, index]) => Number(index) >= 0).map(([key, index]) => [key, candidate.headers[index]])),
              sampleRows: best.matrix.slice(candidate.headerIndex + 1, candidate.headerIndex + 5).map((row) => Object.fromEntries(candidate.headers.map((header, index) => [header || `Column ${index + 1}`, row[index] ?? ""]))),
              rowMode: candidate.hasTransaction && !candidate.hasValuation ? "transactions" : "holdings"
            } : null,
            error: "Portfolio table detected. Map the provider columns once; GrowVest can remember this layout for future uploads."
          };
        }
        return { ...base, ...best.detection, error: "Report type detected successfully, but its automatic import adapter is not enabled yet." };
      }
      return { ...base, sheetName: sheets.map((item) => item.sheetName).join(", "), error: "Excel workbook opened successfully, but no supported portfolio report signature was found." };
    } catch (error) {
      return { ...base, error: error?.message || "Unable to read this Excel workbook." };
    }
  }

  return { ...base, error: "This file type is not supported by the Daily Portfolio Update yet." };
}

export async function parseFundbazaarFile(file) {
  const detected = await detectPortfolioImportFile(file);
  if (detected.reportType !== PORTFOLIO_REPORT_TYPES.FUNDBAZAAR_CLIENT_VALUATION
    || detected.adapterStatus !== PORTFOLIO_ADAPTER_STATUS.READY) {
    throw new Error(detected.error || "This file is not a supported Fundbazaar Client Wise Valuation report.");
  }
  return detected;
}
