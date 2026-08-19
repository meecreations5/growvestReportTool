import {
  appRequestErrorStatus,
  verifyStaffRequest
} from "@/lib/server/firebaseAdmin";
import { purgeOrphanFundbazaarImportAttempts } from "@/lib/server/portfolioReset";

export const runtime = "nodejs";

function clean(value) {
  return String(value ?? "").trim();
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (actor?.role !== "super_admin") {
      return Response.json({ error: "Only Super Admin can permanently clear orphan portfolio import attempts." }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    if (clean(payload.confirmation).toUpperCase() !== "CLEAR FAILED IMPORTS") {
      return Response.json({ error: "Type CLEAR FAILED IMPORTS to confirm this cleanup." }, { status: 400 });
    }

    const cleanup = await purgeOrphanFundbazaarImportAttempts({ before: new Date() });
    if (cleanup.skipped && cleanup.reason === "verified_fundbazaar_mappings_exist") {
      return Response.json({
        error: "Failed-attempt cleanup is available only when no verified Fundbazaar mappings remain. Use Investor-specific Full Portfolio Reset instead."
      }, { status: 409 });
    }

    return Response.json({ success: true, cleanup });
  } catch (error) {
    console.error("Orphan portfolio import cleanup failed", error);
    return Response.json(
      { error: error?.message || "Unable to clear old failed portfolio import attempts." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
