import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";
import { REPORT_TYPE } from "@/lib/constants/report";

/**
 * Client-side guard used immediately before Monthly Review completion.
 * Kept in a dedicated module so Turbopack cannot resolve an older
 * reportService client chunk that predates this export.
 */
export async function reconcileMonthlyReportPortfolio(payload) {
  const headers = await authenticatedApiHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/reports/reconcile-portfolio", {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      reportType: payload?.reportType || REPORT_TYPE.MONTHLY,
      investorId: payload?.investorId || "",
      statementDate: payload?.statementDate || "",
      portfolioAsOfDate: payload?.portfolioAsOfDate || "",
      reportingPeriod: payload?.reportingPeriod || null,
      sourcePortfolioSnapshotId: payload?.sourcePortfolioSnapshotId || "",
      sourcePortfolioSnapshotVersion: Number(payload?.sourcePortfolioSnapshotVersion || 0),
      summary: { totalCorpus: Number(payload?.summary?.totalCorpus || 0) }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data?.reconciliation?.message
        || data?.error
        || "Portfolio data changed after this Wealth Review was prepared."
    );
    error.code = data?.reconciliation?.reason || "report_portfolio_stale";
    error.reconciliation = data?.reconciliation || null;
    throw error;
  }

  return data?.reconciliation || null;
}
