import {
  adminDb,
  appRequestErrorStatus,
  verifyStaffRequest
} from "@/lib/server/firebaseAdmin";
import {
  loadPortfolioResetContext,
  portfolioResetPreview,
  purgeOrphanFundbazaarImportAttempts,
  resetInvestorPortfolio
} from "@/lib/server/portfolioReset";

export const runtime = "nodejs";

const MAX_BULK_RESET = 25;

function clean(value) {
  return String(value ?? "").trim();
}

function assertSuperAdmin(actor) {
  if (actor?.role !== "super_admin") {
    const error = new Error("Bulk Full Portfolio Reset is restricted to Super Admin users.");
    error.statusCode = 403;
    throw error;
  }
}

function confirmationText(count) {
  return `RESET ${count} INVESTOR${count === 1 ? "" : "S"}`;
}

async function loadInvestors(investorIds) {
  const snapshots = await adminDb.getAll(...investorIds.map((id) => adminDb.collection("investors").doc(id)));
  const investors = snapshots.filter((item) => item.exists && item.data()?.isDeleted !== true).map((item) => ({ id: item.id, ...item.data() }));
  if (investors.length !== investorIds.length) throw new Error("One or more selected investors could not be found. Refresh Portfolio Administration and try again.");
  return investors;
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    assertSuperAdmin(actor);
    const payload = await request.json().catch(() => ({}));
    const action = clean(payload.action || "preview").toLowerCase();
    const investorIds = [...new Set((Array.isArray(payload.investorIds) ? payload.investorIds : []).map(clean).filter(Boolean))];
    if (!investorIds.length) return Response.json({ error: "Select at least one investor." }, { status: 400 });
    if (investorIds.length > MAX_BULK_RESET) return Response.json({ error: `Full Portfolio Reset supports up to ${MAX_BULK_RESET} investors at a time.` }, { status: 400 });

    const investors = await loadInvestors(investorIds);
    const contexts = [];
    for (const investor of investors) contexts.push(await loadPortfolioResetContext(investor));
    const details = contexts.map(portfolioResetPreview);
    const totals = details.reduce((total, item) => {
      total.investors += 1;
      total.currentValue += Number(item.currentValue || 0);
      Object.entries(item.counts || {}).forEach(([key, value]) => { total[key] = Number(total[key] || 0) + Number(value || 0); });
      return total;
    }, { investors: 0, currentValue: 0 });
    totals.currentValue = Number(totals.currentValue.toFixed(2));
    const expectedConfirmation = confirmationText(investorIds.length);

    if (action === "preview") return Response.json({ details, totals, expectedConfirmation });
    if (action !== "reset") return Response.json({ error: "Unsupported bulk Full Portfolio Reset action." }, { status: 400 });

    const reason = clean(payload.reason);
    const confirmation = clean(payload.confirmation).toUpperCase();
    if (reason.length < 5) return Response.json({ error: "Enter a clear reset reason." }, { status: 400 });
    if (confirmation !== expectedConfirmation) return Response.json({ error: `Type ${expectedConfirmation} to confirm this reset.` }, { status: 400 });

    const resetStartedAt = new Date();
    const results = [];
    // Reload each context immediately before deleting it. Multiple selected investors
    // can share one import batch; refreshing prevents a later reset from restoring
    // stale fileIds that an earlier reset already removed from that shared batch.
    for (const investor of investors) {
      const currentContext = await loadPortfolioResetContext(investor);
      results.push(await resetInvestorPortfolio(currentContext));
    }
    const orphanImportCleanup = await purgeOrphanFundbazaarImportAttempts({ before: resetStartedAt });
    return Response.json({ success: true, results, totals, expectedConfirmation, orphanImportCleanup });
  } catch (error) {
    console.error("Bulk Full Portfolio Reset failed", error);
    return Response.json(
      { error: error?.message || "Unable to reset the selected investor portfolios." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
