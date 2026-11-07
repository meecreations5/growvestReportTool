import { FieldPath } from "firebase-admin/firestore";
import { adminDb, verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { getAccessibleInvestor } from "@/lib/server/portfolioServer";
import { archiveImportedFundbazaarValuation } from "@/lib/server/portfolioDatedValuationStore";
import { planFundbazaarDatedValuation } from "@/lib/portfolioDatedValuationPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeCursor(value) {
  const key = String(value || "").trim();
  if (key.length > 200 || key.includes("/")) throw new Error("Invalid import cursor.");
  return key;
}

function eligible(file) {
  return file.status === "imported" && file.source === "fundbazaar" && file.reportType === "fundbazaar_client_valuation";
}

async function pageOfFiles(cursor, limit) {
  let query = adminDb.collection("portfolioImportFiles").orderBy(FieldPath.documentId()).limit(limit);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();
  return {
    files: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    nextCursor: snapshot.size === limit ? snapshot.docs.at(-1)?.id || "" : ""
  };
}

async function handle(request, write) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["admin", "super_admin"].includes(actor.role)) {
      return Response.json({ error: "Historical backfill is restricted to Admin and Super Admin." }, { status: 403 });
    }
    const input = write ? await request.json() : Object.fromEntries(new URL(request.url).searchParams);
    if (write && input?.confirm !== "ARCHIVE HISTORY ONLY") {
      return Response.json({ error: "Explicit confirmation is required. This action archives source history only." }, { status: 400 });
    }
    const cursor = safeCursor(input?.cursor);
    const limit = Math.min(write ? 5 : 20, Math.max(1, Number(input?.limit) || (write ? 5 : 20)));
    const page = await pageOfFiles(cursor, limit);
    const result = { scanned: page.files.length, eligible: 0, archived: 0, existing: 0, skipped: 0, failed: 0 };
    const details = [];
    for (const file of page.files) {
      if (!eligible(file)) { result.skipped += 1; continue; }
      result.eligible += 1;
      const investorId = String(file.matchedInvestorId || "").trim();
      try {
        if (!investorId) throw new Error("The original investor mapping is missing.");
        const plan = planFundbazaarDatedValuation(file);
        if (!write) {
          details.push({ fileId: file.id, status: file.datedValuationStatus === "available" ? "existing" : "available_to_archive", investorId, valuationDate: plan.valuationDate });
          continue;
        }
        await getAccessibleInvestor(actor, investorId);
        const archive = await archiveImportedFundbazaarValuation({ file, investorId, actor });
        if (archive.alreadyArchived) result.existing += 1;
        else result.archived += 1;
        details.push({ fileId: file.id, status: archive.alreadyArchived ? "existing" : "archived", investorId, valuationDate: archive.date });
      } catch (error) {
        result.failed += 1;
        details.push({ fileId: file.id, status: "failed", investorId, error: error?.message || "The source record could not be archived." });
      }
    }
    return Response.json({ mode: write ? "archive" : "preview", ...result, details, nextCursor: page.nextCursor }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Historical valuation backfill failed", { message: error?.message || "backfill_failed" });
    return Response.json({ error: error?.message || "Unable to archive historical valuations." }, { status: appRequestErrorStatus(error, 500) });
  }
}

export async function GET(request) { return handle(request, false); }
export async function POST(request) { return handle(request, true); }
