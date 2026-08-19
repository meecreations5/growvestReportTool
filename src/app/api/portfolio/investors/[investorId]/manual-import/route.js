import * as XLSX from "xlsx";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { PORTFOLIO_PRODUCT_TYPES, PORTFOLIO_SOURCES, portfolioAssetClass } from "@/lib/constants/portfolio";
import { createPortfolioSnapshot, getAccessibleInvestor, indiaDateKey, positionDocumentId } from "@/lib/server/portfolioServer";

export const runtime = "nodejs";

function clean(value) { return String(value ?? "").trim(); }
function number(value) { const parsed = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function normaliseHeader(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

const HEADER_ALIASES = {
  productType: ["investment type", "asset type", "product type", "type"],
  instrumentName: ["investment name", "instrument name", "scheme name", "stock name", "fund name", "name"],
  provider: ["provider", "broker", "institution", "insurer"],
  investmentMode: ["investment mode", "mode", "sip lump sum", "sip/lump sum"],
  folioNo: ["folio", "folio no", "account no", "account number", "policy no", "policy number"],
  isin: ["isin"],
  symbol: ["symbol", "scrip", "ticker"],
  exchange: ["exchange"],
  quantity: ["quantity", "qty", "units"],
  averageBuyRate: ["average buy rate", "avg buy rate", "average price", "purchase nav", "purchase rate", "avg price"],
  totalInvested: ["invested amount", "total invested", "investment amount", "cost value"],
  currentRate: ["current nav", "current rate", "ltp", "market price", "nav"],
  currentValue: ["current value", "market value", "fund value", "valuation"],
  valuationDate: ["valuation date", "nav date", "price date", "as of date"],
  monthlySip: ["monthly sip", "sip amount", "monthly contribution"],
  goalName: ["goal", "goal bucket list", "goal / bucket list", "bucket list"],
  notes: ["notes", "remark", "remarks"]
};

const TYPE_MAP = new Map([
  ["mutual fund", PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND], ["mf", PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND], ["sip", PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND],
  ["direct equity", PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY], ["delivery equity", PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY], ["stock delivery", PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY], ["equity", PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY],
  ["ulip", PORTFOLIO_PRODUCT_TYPES.ULIP], ["pms", PORTFOLIO_PRODUCT_TYPES.PMS], ["bond", PORTFOLIO_PRODUCT_TYPES.BOND], ["bonds", PORTFOLIO_PRODUCT_TYPES.BOND],
  ["fixed deposit", PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT], ["fd", PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT], ["gold", PORTFOLIO_PRODUCT_TYPES.GOLD],
  ["real estate", PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE], ["other", PORTFOLIO_PRODUCT_TYPES.OTHER]
]);

function detectColumns(headers) {
  const result = {};
  headers.forEach((header, index) => {
    const normal = normaliseHeader(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (result[field] == null && aliases.includes(normal)) result[field] = index;
    }
  });
  return result;
}

function cell(row, columns, field) {
  const index = columns[field];
  return index == null ? "" : row[index];
}

function normaliseType(value) {
  const text = normaliseHeader(value);
  if (TYPE_MAP.has(text)) return TYPE_MAP.get(text);
  if (text.includes("mutual")) return PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND;
  if (text.includes("equity") || text.includes("stock")) return PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY;
  if (text.includes("ulip")) return PORTFOLIO_PRODUCT_TYPES.ULIP;
  if (text.includes("pms")) return PORTFOLIO_PRODUCT_TYPES.PMS;
  if (text.includes("bond")) return PORTFOLIO_PRODUCT_TYPES.BOND;
  if (text.includes("deposit")) return PORTFOLIO_PRODUCT_TYPES.FIXED_DEPOSIT;
  if (text.includes("gold")) return PORTFOLIO_PRODUCT_TYPES.GOLD;
  if (text.includes("real")) return PORTFOLIO_PRODUCT_TYPES.REAL_ESTATE;
  return PORTFOLIO_PRODUCT_TYPES.OTHER;
}

function excelDate(value) {
  if (!value) return "";
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = clean(value);
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return text.slice(0, 10);
}

async function parseFile(file) {
  if (!file) throw new Error("Select an Excel file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Manual portfolio Excel must be 8 MB or smaller.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames.includes("Portfolio_Holdings") ? "Portfolio_Holdings" : workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
  const headerIndex = matrix.findIndex((row) => row.some((item) => ["investment type", "investment name", "instrument name", "scheme name"].includes(normaliseHeader(item))));
  if (headerIndex < 0) throw new Error("Could not find the Manual Portfolio header row.");
  const headers = matrix[headerIndex].map(clean);
  const columns = detectColumns(headers);
  if (columns.instrumentName == null) throw new Error("Investment Name column is required.");
  if (columns.productType == null) throw new Error("Investment Type column is required.");

  const rows = matrix.slice(headerIndex + 1).filter((row) => row.some((item) => clean(item))).map((row, index) => {
    const productType = normaliseType(cell(row, columns, "productType"));
    const instrumentName = clean(cell(row, columns, "instrumentName"));
    const quantity = number(cell(row, columns, "quantity"));
    const averageBuyRate = number(cell(row, columns, "averageBuyRate"));
    const currentRate = number(cell(row, columns, "currentRate"));
    let totalInvested = number(cell(row, columns, "totalInvested"));
    let currentValue = number(cell(row, columns, "currentValue"));
    if (productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY) {
      if (!totalInvested && quantity && averageBuyRate) totalInvested = quantity * averageBuyRate;
      if (!currentValue && quantity && currentRate) currentValue = quantity * currentRate;
    }
    if (productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND && !currentValue && quantity && currentRate) currentValue = quantity * currentRate;
    return {
      rowNumber: headerIndex + index + 2,
      productType,
      instrumentName,
      provider: clean(cell(row, columns, "provider")) || "Manual",
      investmentMode: clean(cell(row, columns, "investmentMode")),
      folioNo: clean(cell(row, columns, "folioNo")),
      isin: clean(cell(row, columns, "isin")),
      symbol: clean(cell(row, columns, "symbol")),
      exchange: clean(cell(row, columns, "exchange")),
      quantity,
      averageBuyRate,
      totalInvested: Number(totalInvested.toFixed(2)),
      currentRate,
      currentValue: Number(currentValue.toFixed(2)),
      valuationDate: excelDate(cell(row, columns, "valuationDate")) || indiaDateKey(),
      monthlySip: number(cell(row, columns, "monthlySip")),
      goalName: clean(cell(row, columns, "goalName")),
      notes: clean(cell(row, columns, "notes"))
    };
  }).filter((item) => item.instrumentName);
  if (!rows.length) throw new Error("No portfolio holdings were found in the workbook.");
  return { sheetName, headers, rows };
}

function investorGoals(investor) {
  return Array.isArray(investor.bucketList) && investor.bucketList.length ? investor.bucketList : (Array.isArray(investor.goals) ? investor.goals : []);
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["super_admin", "admin"].includes(actor.role)) {
      return Response.json({ error: "Admin access is required for Manual Portfolio administration." }, { status: 403 });
    }
    const { investorId } = await params;
    const investor = await getAccessibleInvestor(actor, investorId);
    const formData = await request.formData();
    const action = clean(formData.get("action") || "preview").toLowerCase();
    const mode = clean(formData.get("mode") || "merge").toLowerCase() === "replace" ? "replace" : "merge";
    const file = formData.get("file");
    const parsed = await parseFile(file);

    const goals = investorGoals(investor);
    const previewRows = parsed.rows.map((row) => {
      const goal = row.goalName ? goals.find((item) => clean(item.name || item.goalName).toLowerCase() === row.goalName.toLowerCase()) : null;
      return { ...row, goalId: goal?.id || goal?.goalId || "", goalMatched: !row.goalName || Boolean(goal) };
    });
    const warningCount = previewRows.filter((item) => !item.goalMatched).length;

    if (action === "preview") {
      return Response.json({
        preview: {
          mode,
          sheetName: parsed.sheetName,
          holdingCount: previewRows.length,
          currentValue: Number(previewRows.reduce((sum, item) => sum + item.currentValue, 0).toFixed(2)),
          investedAmount: Number(previewRows.reduce((sum, item) => sum + item.totalInvested, 0).toFixed(2)),
          warningCount,
          rows: previewRows.slice(0, 100)
        }
      });
    }
    if (action !== "commit") return Response.json({ error: "Unsupported manual portfolio action." }, { status: 400 });

    const existingSnapshot = await adminDb.collection("portfolioPositions").where("investorId", "==", investorId).get();
    const existingManual = existingSnapshot.docs
      .map((item) => ({ id: item.id, ref: item.ref, ...item.data() }))
      .filter((item) => item.source === PORTFOLIO_SOURCES.MANUAL && !["inactive", "exited", "removed"].includes(item.status));
    const existingMap = new Map(existingManual.map((item) => [item.id, item]));
    const incomingIds = new Set();
    const now = FieldValue.serverTimestamp();
    const writer = adminDb.bulkWriter();
    let created = 0;
    let updated = 0;

    for (const row of previewRows) {
      const positionId = positionDocumentId({
        investorId,
        source: PORTFOLIO_SOURCES.MANUAL,
        isin: row.isin,
        folioNo: row.folioNo,
        symbol: row.symbol,
        instrumentName: row.instrumentName
      });
      incomingIds.add(positionId);
      const existing = existingMap.get(positionId);
      const goal = row.goalId ? goals.find((item) => String(item.id || item.goalId) === String(row.goalId)) : null;
      const goalAllocations = goal
        ? [{ goalId: goal.id || goal.goalId, goalName: goal.name || goal.goalName || "Goal", percentage: 100 }]
        : (Array.isArray(existing?.goalAllocations) ? existing.goalAllocations : []);
      const gainLoss = row.currentValue - row.totalInvested;
      const returnPercentage = row.totalInvested > 0 ? gainLoss / row.totalInvested * 100 : 0;
      const ref = adminDb.collection("portfolioPositions").doc(positionId);
      writer.set(ref, {
        investorId,
        investorName: investor.fullName || investor.name || "Investor",
        clientCode: investor.clientCode || "",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
        investorPortalUid: investor.portalUid || investor.investorPortalUid || null,
        source: PORTFOLIO_SOURCES.MANUAL,
        provider: row.provider || "Manual",
        productType: row.productType,
        assetClass: existing?.assetClass || portfolioAssetClass(row.productType),
        instrumentName: row.instrumentName,
        schemeName: row.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? row.instrumentName : (existing?.schemeName || ""),
        stockName: row.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? row.instrumentName : (existing?.stockName || ""),
        symbol: row.symbol,
        isin: row.isin,
        exchange: row.exchange,
        folioNo: row.folioNo,
        investmentMode: row.investmentMode,
        totalInvested: row.totalInvested,
        investedAmount: row.totalInvested,
        quantity: row.productType === PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? row.quantity : Number(existing?.quantity || 0),
        totalUnits: row.productType !== PORTFOLIO_PRODUCT_TYPES.STOCK_DELIVERY ? row.quantity : Number(existing?.totalUnits || 0),
        averageBuyRate: row.averageBuyRate,
        currentRate: row.currentRate,
        currentNav: row.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? row.currentRate : Number(existing?.currentNav || 0),
        navDate: row.productType === PORTFOLIO_PRODUCT_TYPES.MUTUAL_FUND ? row.valuationDate : (existing?.navDate || ""),
        valuationDate: row.valuationDate,
        currentValue: row.currentValue,
        gainLoss: Number(gainLoss.toFixed(2)),
        returnPercentage: Number(returnPercentage.toFixed(2)),
        monthlySip: row.monthlySip,
        goalAllocations,
        allocationStatus: goalAllocations.length ? "allocated" : "general_wealth",
        notes: row.notes,
        status: "active",
        manualImportFileName: clean(file?.name),
        manualImportMode: mode,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        updatedByUid: actor.uid,
        updatedByName: actor.fullName || actor.email || "GrowVest User"
      }, { merge: true });
      existing ? updated += 1 : created += 1;
    }

    let removed = 0;
    if (mode === "replace") {
      existingManual.filter((item) => !incomingIds.has(item.id)).forEach((item) => { writer.delete(item.ref); removed += 1; });
    }

    const logRef = adminDb.collection("activityLogs").doc();
    writer.set(logRef, {
      recordType: "manual_portfolio_import",
      recordId: logRef.id,
      investorId,
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
      action: mode === "replace" ? "manual_portfolio_replaced" : "manual_portfolio_merged",
      title: mode === "replace" ? "Manual portfolio replaced from Excel" : "Manual portfolio updated from Excel",
      description: `${previewRows.length} manual portfolio holding(s) were processed from ${clean(file?.name) || "Excel"}.`,
      metadata: { mode, created, updated, removed, warningCount },
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      createdAt: now
    });

    await writer.close();
    const snapshot = await createPortfolioSnapshot(investorId, actor, { snapshotDate: indiaDateKey(), verificationStatus: warningCount ? "review_required" : "verified", sourceImportId: `manual_excel_${logRef.id}` });
    return Response.json({ success: true, mode, created, updated, removed, warningCount, snapshot });
  } catch (error) {
    console.error("Manual portfolio Excel import failed", error);
    return Response.json({ error: error?.message || "Unable to import the manual portfolio Excel." }, { status: appRequestErrorStatus(error, 500) });
  }
}
