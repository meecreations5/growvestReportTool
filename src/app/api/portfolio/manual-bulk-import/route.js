import { verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import {
  commitManualPortfolioWorkbook,
  manualPortfolioPreview,
  parseManualPortfolioWorkbook,
  resolveManualPortfolioWorkbook
} from "@/lib/server/manualPortfolioWorkbook";

export const runtime = "nodejs";

function clean(value) { return String(value ?? "").trim(); }

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["super_admin", "admin"].includes(actor.role)) {
      return Response.json({ error: "Admin access is required for Manual Portfolio Management administration." }, { status: 403 });
    }

    const formData = await request.formData();
    const action = clean(formData.get("action") || "preview").toLowerCase();
    const mode = clean(formData.get("mode") || "merge").toLowerCase() === "replace" ? "replace" : "merge";
    const file = formData.get("file");
    const parsed = await parseManualPortfolioWorkbook(file);
    const resolution = await resolveManualPortfolioWorkbook(parsed);
    const preview = manualPortfolioPreview(mode, parsed, resolution);

    if (action === "preview") return Response.json({ preview });
    if (action !== "commit") return Response.json({ error: "Unsupported Manual Portfolio Management action." }, { status: 400 });
    if (preview.blockingIssueCount) {
      return Response.json({
        error: `Resolve ${preview.blockingIssueCount} blocking workbook issue(s) before importing.`,
        preview
      }, { status: 409 });
    }
    if (!resolution.groups.length) {
      return Response.json({ error: "No matched investor Manual Portfolio Management rows are ready to import." }, { status: 400 });
    }

    const committed = await commitManualPortfolioWorkbook({ actor, file, mode, parsed, resolution });
    return Response.json({
      success: true,
      mode,
      batchId: committed.batchId,
      investorCount: committed.results.length,
      accountCount: committed.results.reduce((sum, item) => sum + Number(item.accountCount || 0), 0),
      holdingCount: committed.results.reduce((sum, item) => sum + Number(item.holdingCount || 0), 0),
      transactionCount: committed.results.reduce((sum, item) => sum + Number(item.transactionCount || 0), 0),
      created: committed.results.reduce((sum, item) => sum + Number(item.createdHoldings || 0), 0),
      updated: committed.results.reduce((sum, item) => sum + Number(item.updatedHoldings || 0), 0),
      warningCount: preview.warningCount,
      investors: committed.results
    });
  } catch (error) {
    console.error("Manual Portfolio Management workbook import failed", error);
    return Response.json({ error: error?.message || "Unable to import the Manual Portfolio Management workbook." }, { status: appRequestErrorStatus(error, 500) });
  }
}
