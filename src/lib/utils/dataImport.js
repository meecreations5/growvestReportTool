import {
  DATA_IMPORT_FIELDS,
  DATA_IMPORT_MAX_FILE_SIZE,
  DATA_IMPORT_MAX_ROWS,
  DATA_IMPORT_NUMERIC_FIELDS,
  DATA_IMPORT_SAMPLE_ROWS,
  NORMALISED_ASSET_CLASSES
} from "@/lib/constants/dataImport";
import { ASSET_CLASS_COLORS, calculatePercentage } from "@/lib/constants/report";

export function normaliseHeader(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[%₹$(),./\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeUniqueHeaders(values = []) {
  const counts = new Map();
  return values.map((value, index) => {
    const base = String(value || `Column ${index + 1}`).trim() || `Column ${index + 1}`;
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });
}

export function autoMapImportHeaders(headers = []) {
  const mapping = {};
  const normalisedHeaders = headers.map((header) => ({ original: header, normalised: normaliseHeader(header) }));

  DATA_IMPORT_FIELDS.forEach((field) => {
    const candidates = [field.label, field.key, ...(field.aliases || [])].map(normaliseHeader);
    const exact = normalisedHeaders.find((header) => candidates.includes(header.normalised));
    const partial = exact || normalisedHeaders.find((header) => candidates.some((candidate) => (
      candidate.length > 3 && (header.normalised.includes(candidate) || candidate.includes(header.normalised))
    )));
    mapping[field.key] = partial?.original || "";
  });

  return mapping;
}

export async function parseImportFile(file) {
  if (!file) throw new Error("Choose a CSV or Excel file.");
  if (file.size > DATA_IMPORT_MAX_FILE_SIZE) throw new Error("The file is larger than 5 MB.");

  const extension = String(file.name || "").split(".").pop()?.toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(extension)) {
    throw new Error("Use a CSV, XLSX or XLS file.");
  }

  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("The uploaded workbook does not contain a worksheet.");

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false
  });

  if (!matrix.length) throw new Error("The uploaded file is empty.");

  const headers = makeUniqueHeaders(matrix[0]);
  const rows = matrix
    .slice(1)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""))
    .slice(0, DATA_IMPORT_MAX_ROWS)
    .map((row, rowIndex) => Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""])));

  if (!rows.length) throw new Error("No data rows were found below the header row.");

  return {
    headers,
    rows,
    sheetName: firstSheetName,
    truncated: matrix.length - 1 > DATA_IMPORT_MAX_ROWS,
    totalRowsInFile: Math.max(0, matrix.length - 1)
  };
}

export function parseFinancialNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const original = String(value ?? "").trim();
  if (!original) return 0;
  const negative = /^\(.*\)$/.test(original);
  const cleaned = original
    .replace(/[₹$€£,%\s]/g, "")
    .replace(/,/g, "")
    .replace(/[()]/g, "");
  if (!cleaned || cleaned === "-") return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function normaliseAssetClass(value = "") {
  const text = normaliseHeader(value);
  if (!text) return "";
  const exact = NORMALISED_ASSET_CLASSES.find((item) => normaliseHeader(item) === text);
  if (exact) return exact;
  if (/equity|stock|share|mutual fund|mf/.test(text)) return "Equity";
  if (/debt|bond|fixed income|fd|deposit/.test(text)) return "Debt";
  if (/liquid|money market/.test(text)) return "Liquid";
  if (/cash|bank/.test(text)) return "Cash";
  if (/insurance|policy/.test(text)) return "Insurance";
  if (/trading|f&o|future|option/.test(text)) return "Trading";
  if (/gold|silver|commodity/.test(text)) return "Gold";
  if (/real estate|property|land/.test(text)) return "Real Estate";
  return "Other";
}

export function mapRawRows(rawRows = [], mapping = {}) {
  return rawRows.map((rawRow, index) => {
    const row = {
      id: `import-row-${index + 1}`,
      rowNumber: index + 2,
      excluded: false,
      issues: []
    };

    DATA_IMPORT_FIELDS.forEach((field) => {
      const sourceHeader = mapping[field.key];
      const value = sourceHeader ? rawRow[sourceHeader] : "";
      if (field.key === "assetClass") row[field.key] = normaliseAssetClass(value);
      else if (DATA_IMPORT_NUMERIC_FIELDS.includes(field.key)) row[field.key] = parseFinancialNumber(value);
      else row[field.key] = String(value ?? "").trim();
    });

    return row;
  });
}

function issue(code, field, message, severity = "error") {
  return { code, field, message, severity };
}

export function validateImportRows(rows = []) {
  const duplicateMap = new Map();

  const validated = rows.map((sourceRow) => {
    const row = { ...sourceRow, issues: [] };
    if (row.excluded) return row;

    if (!String(row.instrumentName || "").trim()) {
      row.issues.push(issue("missing_instrument", "instrumentName", "Instrument name is required."));
    }

    if (!String(row.assetClass || "").trim()) {
      row.issues.push(issue("missing_asset_class", "assetClass", "Asset class is required."));
    }

    DATA_IMPORT_NUMERIC_FIELDS.forEach((field) => {
      if (row[field] === null || !Number.isFinite(Number(row[field]))) {
        row.issues.push(issue("invalid_number", field, `${DATA_IMPORT_FIELDS.find((item) => item.key === field)?.label || field} is not a valid number.`));
      }
    });

    if (Number(row.currentValue || 0) < 0) {
      row.issues.push(issue("negative_current_value", "currentValue", "Current value cannot be negative."));
    }

    if (Number(row.investment || 0) < 0) {
      row.issues.push(issue("negative_investment", "investment", "New investment cannot be negative."));
    }

    if (Number(row.withdrawal || 0) < 0) {
      row.issues.push(issue("negative_withdrawal", "withdrawal", "Withdrawal cannot be negative."));
    }

    const expectedClosing = Number(row.openingValue || 0)
      + Number(row.investment || 0)
      - Number(row.withdrawal || 0)
      + Number(row.profitLoss || 0);
    const difference = Math.abs(expectedClosing - Number(row.currentValue || 0));
    if (
      [row.openingValue, row.investment, row.withdrawal, row.profitLoss].some((value) => Number(value || 0) !== 0)
      && difference > 1
    ) {
      row.issues.push(issue(
        "closing_mismatch",
        "currentValue",
        `Closing value differs from the calculated value by ₹${Math.round(difference).toLocaleString("en-IN")}.`,
        "warning"
      ));
    }

    if (Math.abs(Number(row.returnPercentage || 0)) > 50) {
      row.issues.push(issue("unusual_return", "returnPercentage", "Return exceeds 50%. Verify the value.", "warning"));
    }

    const duplicateKey = `${normaliseHeader(row.instrumentName)}|${normaliseHeader(row.assetClass)}`;
    if (duplicateKey !== "|") {
      const previousRow = duplicateMap.get(duplicateKey);
      if (previousRow) {
        row.issues.push(issue("duplicate_instrument", "instrumentName", `Possible duplicate of row ${previousRow}.`, "warning"));
      } else {
        duplicateMap.set(duplicateKey, row.rowNumber);
      }
    }

    return row;
  });

  return {
    rows: validated,
    summary: summariseValidation(validated)
  };
}

export function summariseValidation(rows = []) {
  return rows.reduce((summary, row) => {
    if (row.excluded) {
      summary.excluded += 1;
      return summary;
    }
    const hasError = row.issues?.some((item) => item.severity === "error");
    const hasWarning = row.issues?.some((item) => item.severity === "warning");
    if (hasError) summary.failed += 1;
    else if (hasWarning) summary.warning += 1;
    else summary.valid += 1;
    summary.total += 1;
    return summary;
  }, { total: 0, valid: 0, warning: 0, failed: 0, excluded: 0 });
}

export function buildReportImportPayload(rows = []) {
  const includedRows = rows.filter((row) => (
    !row.excluded && !row.issues?.some((item) => item.severity === "error")
  ));

  const totalCorpus = includedRows.reduce((sum, row) => sum + Number(row.currentValue || 0), 0);
  const monthlySip = includedRows.reduce((sum, row) => sum + Number(row.monthlySip || 0), 0);
  const newMoneyAdded = includedRows.reduce((sum, row) => sum + Number(row.investment || 0), 0);
  const totalWithdrawals = includedRows.reduce((sum, row) => sum + Number(row.withdrawal || 0), 0);
  const investmentGain = includedRows.reduce((sum, row) => sum + Number(row.profitLoss || 0), 0);
  const openingValue = includedRows.reduce((sum, row) => sum + Number(row.openingValue || 0), 0);

  const funds = includedRows.map((row, index) => ({
    id: `imported-fund-${index + 1}`,
    instrumentName: row.instrumentName,
    assetClass: row.assetClass || "Other",
    goalId: "",
    goalName: "",
    monthlySip: Number(row.monthlySip || 0),
    currentValue: Number(row.currentValue || 0),
    openingValue: Number(row.openingValue || 0),
    investment: Number(row.investment || 0),
    withdrawal: Number(row.withdrawal || 0),
    profitLoss: Number(row.profitLoss || 0),
    returnPercentage: Number(row.returnPercentage || 0),
    quantity: Number(row.quantity || 0),
    transactionDate: row.transactionDate || "",
    type: "Fixed",
    notes: row.notes || ""
  }));

  const grouped = includedRows.reduce((map, row) => {
    const assetClass = row.assetClass || "Other";
    const current = map.get(assetClass) || { currentValue: 0, monthlySip: 0 };
    current.currentValue += Number(row.currentValue || 0);
    current.monthlySip += Number(row.monthlySip || 0);
    map.set(assetClass, current);
    return map;
  }, new Map());

  const holdings = [...grouped.entries()].map(([assetClass, values], index) => ({
    id: `imported-holding-${index + 1}`,
    assetClass,
    currentValue: values.currentValue,
    percentage: calculatePercentage(values.currentValue, totalCorpus),
    color: ASSET_CLASS_COLORS[assetClass] || ASSET_CLASS_COLORS.Other
  }));

  const allocation = [...grouped.entries()].map(([assetClass, values], index) => ({
    id: `imported-allocation-${index + 1}`,
    assetClass,
    currentValue: values.currentValue,
    monthlySip: values.monthlySip,
    currentPercentage: calculatePercentage(values.currentValue, totalCorpus),
    targetPercentage: 0,
    variance: calculatePercentage(values.currentValue, totalCorpus)
  }));

  return {
    summary: {
      totalCorpus,
      monthlySip,
      newMoneyAdded,
      investmentGain,
      openingValue,
      totalWithdrawals
    },
    holdings,
    allocation,
    funds,
    sourceRowCount: includedRows.length
  };
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createSampleImportCsv() {
  const headers = Object.keys(DATA_IMPORT_SAMPLE_ROWS[0]);
  return [
    headers.map(escapeCsvValue).join(","),
    ...DATA_IMPORT_SAMPLE_ROWS.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","))
  ].join("\n");
}

export function downloadSampleImportCsv() {
  const blob = new Blob([createSampleImportCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "GrowVest_Monthly_Portfolio_Import_Sample.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadImportErrorCsv(rows = []) {
  const errorRows = rows.filter((row) => row.excluded || row.issues?.length);
  const headers = [
    "Source Row", "Status", "Instrument", "Asset Class", "Opening Value",
    "New Investment", "Withdrawal", "Profit / Loss", "Current Value",
    "Return %", "Monthly SIP", "Transaction Date", "Notes", "Validation Messages"
  ];
  const csvRows = errorRows.map((row) => [
    row.rowNumber,
    row.excluded ? "Excluded" : row.issues?.some((item) => item.severity === "error") ? "Failed" : "Warning",
    row.instrumentName, row.assetClass, row.openingValue, row.investment, row.withdrawal,
    row.profitLoss, row.currentValue, row.returnPercentage, row.monthlySip, row.transactionDate, row.notes,
    (row.issues || []).map((item) => item.message).join(" | ")
  ]);
  const csv = [headers, ...csvRows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "GrowVest_Data_Import_Validation_Issues.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
