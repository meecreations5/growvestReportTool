import * as XLSX from "xlsx";
import { verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

function addSheet(workbook, name, headers, rows = []) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, Math.min(30, String(header).length + 3)) }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["super_admin", "admin"].includes(actor.role)) {
      return Response.json({ error: "Admin access is required for Manual Portfolio Management administration." }, { status: 403 });
    }

    const workbook = XLSX.utils.book_new();
    addSheet(workbook, "01_Investors",
      ["Investor Client Code", "Investor Name", "PAN", "GrowVest Investor ID", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "", "Reference only - investor must already exist in GrowVest"], ["GV-1002", "Diya Shah", "FGHIJ5678K", "", "Second sample investor"]]
    );
    addSheet(workbook, "02_Portfolio_Accounts",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Portfolio Account Name", "Strategy", "Provider / Platform", "Account Opening Date", "Status", "Base Currency", "Benchmark", "Discretionary", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "Core Growth Portfolio", "Growth", "Manual", "2024-04-01", "Active", "INR", "NIFTY 500", "No", "Primary manually managed account"], ["GV-1002", "Diya Shah", "FGHIJ5678K", "PMS-01", "Balanced Wealth Portfolio", "Balanced", "Manual", "2025-01-15", "Active", "INR", "NIFTY 50 TRI", "No", "Sample account"]]
    );
    addSheet(workbook, "03_Holdings",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Holding Key", "Investment Type", "Investment Name", "Provider", "Investment Mode", "Folio / Account No", "ISIN", "Symbol", "Exchange", "Units / Quantity", "Average Buy / Purchase NAV", "Invested Amount", "Current NAV / Rate", "Current Value", "Valuation Date", "Purchase Date", "Maturity Date", "Monthly SIP", "Goal / Bucket List", "Status", "Notes"],
      [
        ["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "HLD-001", "Mutual Fund", "HDFC Flexi Cap Fund", "Manual", "SIP", "MF-1001", "", "", "", 520.35, 144.12, 75000, 185.4, 96470, "2026-08-19", "2024-04-05", "", 5000, "Child Education", "Active", "SIP holding"],
        ["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "HLD-002", "Direct Equity", "Reliance Industries", "Manual", "Delivery", "", "INE002A01018", "RELIANCE", "NSE", 40, 1250, 50000, 1420, 56800, "2026-08-19", "2025-02-10", "", 0, "General Wealth", "Active", "Delivery equity"],
        ["GV-1002", "Diya Shah", "FGHIJ5678K", "PMS-01", "HLD-001", "Bond", "ABC Corporate Bond", "Manual", "One Time", "BOND-2001", "", "", "", 10, 10000, 100000, 10350, 103500, "2026-08-19", "2025-01-20", "2028-01-20", 0, "Retirement", "Active", "Debt allocation"]
      ]
    );
    addSheet(workbook, "04_Transactions",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Transaction Key", "Transaction Date", "Transaction Type", "Holding Key", "Investment Name", "Units / Quantity", "Rate / NAV", "Gross Amount", "Charges", "Taxes", "Net Amount", "Realized P&L", "Reference / Order ID", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "TX-001", "2026-08-05", "SIP", "HLD-001", "HDFC Flexi Cap Fund", 27.25, 183.49, 5000, 0, 0, 5000, 0, "SIP-AUG-2026", "August SIP"], ["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "TX-002", "2026-08-12", "Sell", "HLD-002", "Reliance Industries", 5, 1410, 7050, 25, 12, 7013, 800, "ORD-10002", "Partial profit booking"]]
    );
    addSheet(workbook, "05_Cash_Ledger",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Cash Entry Key", "Entry Date", "Cash Entry Type", "Amount", "Reference", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "CASH-001", "2026-08-01", "Opening Cash", 50000, "", "Opening cash balance"], ["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "CASH-002", "2026-08-05", "Purchase Debit", 5000, "SIP-AUG-2026", "SIP funding debit"], ["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "CASH-003", "2026-08-10", "Dividend", 800, "DIV-AUG-2026", "Income received into portfolio cash"], ["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "CASH-004", "2026-08-12", "Sale Proceeds", 7013, "ORD-10002", "Net sale proceeds; transaction charges are already reflected in this net settlement"]]
    );
    addSheet(workbook, "06_Income",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Income Key", "Income Date", "Income Type", "Holding Key", "Investment Name", "Gross Amount", "TDS", "Net Amount", "Reference", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "INC-001", "2026-08-10", "Dividend", "HLD-002", "Reliance Industries", 800, 0, 800, "DIV-AUG-2026", "Dividend received"]]
    );
    addSheet(workbook, "07_Corporate_Actions",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Action Key", "Action Date", "Action Type", "Holding Key", "Investment Name", "Ratio", "Quantity Change", "Cash Amount", "New Investment Name", "Reference", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "CA-001", "2026-07-15", "Bonus", "HLD-002", "Reliance Industries", "1:10", 4, 0, "", "CA-REL-2026", "Historical corporate action example"]]
    );
    addSheet(workbook, "08_Charges",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Charge Key", "Charge Date", "Charge Type", "Amount", "GST", "Total Amount", "Reference", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "CHG-001", "2026-08-12", "Brokerage / Transaction Charges", 25, 4.5, 29.5, "ORD-10002", "Keep charges separate from holding value"]]
    );
    addSheet(workbook, "09_Goal_Allocation",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Allocation Key", "Holding Key", "Goal / Bucket List", "Allocation Percentage", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "GA-001", "HLD-001", "Child Education", 100, "Full allocation"], ["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "GA-002", "HLD-002", "Retirement", 60, "Partial goal allocation"], ["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "GA-003", "HLD-002", "General Wealth", 40, "Remaining allocation"]]
    );
    addSheet(workbook, "10_Reconciliation",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Reconciliation Key", "Reconciliation Date", "Statement Value", "System Value", "Status", "Statement Reference", "Notes"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "REC-001", "2026-08-19", 205283, "", "", "Broker Statement Aug-2026", "System Value may be left blank; GrowVest calculates it after import"]]
    );
    addSheet(workbook, "11_Notes",
      ["Investor Client Code", "Investor Name", "PAN", "Portfolio Account Code", "Note Key", "Note Date", "Category", "Title", "Note", "Visibility"],
      [["GV-1001", "Aarav Mehta", "ABCDE1234F", "PMS-01", "NOTE-001", "2026-08-19", "Review", "Monthly portfolio note", "Maintain liquidity before the next SIP cycle.", "Internal"]]
    );

    const instructions = XLSX.utils.aoa_to_sheet([
      ["GrowVest Manual Portfolio Management - Multi-Investor Workbook"],
      ["Purpose", "Use one workbook to maintain multiple investors and multiple manually managed portfolio/PMS-style accounts."],
      ["Investor matching", "GrowVest matches Investor ID, PAN, Client Code, then exact unique Investor Name. Strong identifiers that conflict are blocked."],
      ["Account model", "Every portfolio row belongs to a Portfolio Account Code. The same code may be reused by different investors because account identity is investor-specific."],
      ["Current holdings", "03_Holdings is the current holdings snapshot and feeds the Portfolio Master. It supports Mutual Fund SIP/Lump Sum, Delivery Equity, ETF, Bonds/NCD, FD, Gold/SGB, ULIP, PMS, Real Estate and Other."],
      ["Transactions", "04_Transactions preserves buy/sell/SIP/lump-sum/redemption/switch/top-up/transfer and other transaction history. Use a stable Transaction Key for later updates."],
      ["Cash", "05_Cash_Ledger is the authoritative account cash movement ledger. Record each actual cash movement once. Entry types such as Opening Cash, Contribution, Sale Proceeds, Purchase Debit, Dividend, Interest, Charges, Transfer In and Transfer Out are supported. If charges are already netted inside Sale Proceeds/Purchase Debit, do not add them again as a separate cash entry."],
      ["Income and actions", "06_Income, 07_Corporate_Actions and 08_Charges preserve dividend/interest income, bonus/split/rights/maturity events and costs separately."],
      ["Goals", "09_Goal_Allocation can split one holding across multiple GrowVest Goals/Bucket Lists. Allocation for one holding cannot exceed 100%. Unknown goals are imported as review warnings but are not attached to the live holding."],
      ["Reconciliation", "10_Reconciliation compares an external statement value with GrowVest system value. Leave System Value and Status blank to let GrowVest calculate them after import."],
      ["Performance", "GrowVest calculates account invested value, current holdings value, cash balance, current portfolio value, unrealized P&L, realized P&L, income, charges, contributions, withdrawals, absolute return and XIRR when usable cash-flow dates are available."],
      ["Cash in Portfolio Master", "Computed account cash is represented as a Manual Cash Balance position so uninvested cash is included in current portfolio value and snapshots."],
      ["Merge / Update", "Upserts rows by stable keys and leaves existing omitted manual records unchanged."],
      ["Replace Manual Portfolio Data", "For each investor present in the workbook, deletes their existing Manual-source holdings and Manual Portfolio Management ledgers, then recreates them from this workbook. Fundbazaar, Bajaj, provider ULIP and other non-Manual sources are untouched."],
      ["Important", "This module is for internal/manual portfolio administration and tracking. It does not represent GrowVest as a regulated PMS provider."],
      ["Before upload", "Replace all fictional sample identities and sample values with real GrowVest investor data. Investors must already exist in GrowVest."]
    ]);
    instructions["!cols"] = [{ wch: 28 }, { wch: 125 }];
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="GrowVest_Manual_Portfolio_Management_Multi_Investor_Template_v0.33.2.xlsx"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Manual Portfolio Management template download failed", error);
    return Response.json({ error: error?.message || "Unable to prepare the Manual Portfolio Management workbook template." }, { status: appRequestErrorStatus(error, 500) });
  }
}
