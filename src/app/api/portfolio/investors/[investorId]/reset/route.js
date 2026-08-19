import {
  appRequestErrorStatus,
  verifyStaffRequest
} from "@/lib/server/firebaseAdmin";
import { getAccessibleInvestor } from "@/lib/server/portfolioServer";
import {
  loadPortfolioResetContext,
  portfolioResetPreview,
  resetInvestorPortfolio
} from "@/lib/server/portfolioReset";

export const runtime = "nodejs";

function clean(value) {
  return String(value ?? "").trim();
}

function assertSuperAdmin(actor) {
  if (actor?.role !== "super_admin") {
    const error = new Error("Full Portfolio Reset is restricted to Super Admin users.");
    error.statusCode = 403;
    throw error;
  }
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    assertSuperAdmin(actor);
    const { investorId } = await params;
    const investor = await getAccessibleInvestor(actor, investorId);
    const payload = await request.json().catch(() => ({}));
    const action = clean(payload.action || "preview").toLowerCase();
    const context = await loadPortfolioResetContext({ id: investorId, ...investor });

    if (action === "preview") {
      return Response.json({ investor: { id: investorId, fullName: investor.fullName || investor.name || "Investor", clientCode: investor.clientCode || "" }, preview: portfolioResetPreview(context) });
    }

    if (action !== "reset") return Response.json({ error: "Unsupported Full Portfolio Reset action." }, { status: 400 });
    const reason = clean(payload.reason);
    const confirmation = clean(payload.confirmation).toUpperCase();
    if (reason.length < 5) return Response.json({ error: "Enter a clear reset reason." }, { status: 400 });
    if (confirmation !== "RESET PORTFOLIO") return Response.json({ error: "Type RESET PORTFOLIO to confirm the full reset." }, { status: 400 });

    const result = await resetInvestorPortfolio(context);
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("Full Portfolio Reset failed", error);
    return Response.json(
      { error: error?.message || "Unable to reset the investor portfolio." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
