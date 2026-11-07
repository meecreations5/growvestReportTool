import { NextResponse } from "next/server";
import { adminDb, canStaffAccessRecord, verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { inspectReportPortfolioReconciliation } from "@/lib/server/reportPortfolioReconciliation";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const body = await request.json().catch(() => ({}));
    const investorId = String(body.investorId || "").trim();
    if (!investorId) return NextResponse.json({ error: "Investor is required." }, { status: 400 });

    const investorSnapshot = await adminDb.collection("investors").doc(investorId).get();
    if (!investorSnapshot.exists) return NextResponse.json({ error: "Investor profile was not found." }, { status: 404 });
    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    if (!canStaffAccessRecord(actor, investor)) return NextResponse.json({ error: "You are not authorised to reconcile this investor report." }, { status: 403 });

    const reconciliation = await inspectReportPortfolioReconciliation({
      reportType: body.reportType || "monthly",
      investorId,
      statementDate: body.statementDate || "",
      portfolioAsOfDate: body.portfolioAsOfDate || "",
      reportingPeriod: body.reportingPeriod || null,
      sourcePortfolioSnapshotId: body.sourcePortfolioSnapshotId || "",
      sourcePortfolioSnapshotVersion: Number(body.sourcePortfolioSnapshotVersion || 0),
      summary: body.summary && typeof body.summary === "object"
        ? { totalCorpus: Number(body.summary.totalCorpus) }
        : null
    });

    return NextResponse.json({
      success: reconciliation.status === "current" || reconciliation.status === "not_required",
      reconciliation
    }, {
      status: reconciliation.status === "current" || reconciliation.status === "not_required" ? 200 : 409,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Monthly Report portfolio reconciliation check failed", error);
    return NextResponse.json({ error: error?.message || "Unable to reconcile the Monthly Wealth Review with Portfolio Master." }, { status: appRequestErrorStatus(error, 500) });
  }
}
