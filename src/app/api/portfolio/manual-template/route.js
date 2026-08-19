import * as XLSX from "xlsx";
import { appRequestErrorStatus, verifyStaffRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["super_admin", "admin"].includes(actor.role)) {
      return Response.json({ error: "Admin access is required for Manual Portfolio administration." }, { status: 403 });
    }

    const headers = [
      "Investment Type", "Investment Name", "Provider", "Investment Mode", "Folio / Account No", "ISIN", "Symbol", "Exchange",
      "Units / Quantity", "Average Buy / Purchase NAV", "Invested Amount", "Current NAV / Rate", "Current Value", "Valuation Date",
      "Monthly SIP", "Goal / Bucket List", "Notes"
    ];
    const examples = [
      ["Mutual Fund", "HDFC Flexi Cap Fund", "Manual", "SIP", "12345678", "", "", "", 520.35, 144.12, 75000, 185.4, 96470, "2026-08-19", 5000, "Child Education", "Managed manually"],
      ["Direct Equity", "Reliance Industries", "Manual", "Delivery", "", "INE002A01018", "RELIANCE", "NSE", 100, 1250, 125000, 1420, 142000, "2026-08-19", 0, "General Wealth", ""],
      ["Fixed Deposit", "HDFC Bank FD", "HDFC Bank", "One Time", "FD-001", "", "", "", 1, 100000, 100000, 104500, 104500, "2026-08-19", 0, "Emergency Fund", ""]
    ];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    sheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, Math.min(28, header.length + 3)) }));
    XLSX.utils.book_append_sheet(workbook, sheet, "Portfolio_Holdings");

    const instructions = XLSX.utils.aoa_to_sheet([
      ["GrowVest Manual Portfolio Import"],
      ["Use this file only when GrowVest staff manages the selected investor's portfolio manually."],
      ["The investor is selected in GrowVest before upload, so Investor Name/PAN is not required in this workbook."],
      ["Merge / Update: updates matching Manual holdings, adds new rows, and leaves missing Manual holdings unchanged."],
      ["Replace Manual Portfolio: replaces only source=Manual holdings. Fundbazaar, Bajaj, ULIP-provider imports and other sources remain untouched."],
      ["Goal / Bucket List is optional. If blank on an existing holding, GrowVest preserves its current assignment."],
      ["Supported Investment Type examples: Mutual Fund, Direct Equity, ULIP, PMS, Bond, Fixed Deposit, Gold, Real Estate, Other."],
      ["This workbook updates current holdings only. Transaction-history imports continue through source-specific or standard transaction workflows."]
    ]);
    instructions["!cols"] = [{ wch: 120 }];
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="GrowVest_Manual_Portfolio_Template_v0.33.0.xlsx"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Manual portfolio template download failed", error);
    return Response.json(
      { error: error?.message || "Unable to prepare the Manual Portfolio template." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
