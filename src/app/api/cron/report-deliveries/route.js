import { NextResponse } from "next/server";
import { secureSecretMatch } from "@/lib/server/secureCompare";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { sendReportDelivery } from "@/lib/server/reportDelivery";

export const runtime = "nodejs";

function authorised(request) {
  const configured = String(process.env.CRON_SECRET || "").trim();
  if (!configured) return false;
  const supplied = String(
    request.headers.get("x-cron-secret")
      || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
      || ""
  ).trim();
  return secureSecretMatch(supplied, configured);
}

async function run(request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const now = new Date();
  const snapshot = await adminDb.collection("emailDeliveries")
    .where("status", "==", "scheduled")
    .where("scheduledFor", "<=", now)
    .limit(50)
    .get();
  const results = [];
  for (const item of snapshot.docs) {
    const claimed = await adminDb.runTransaction(async (transaction) => {
      const fresh = await transaction.get(item.ref);
      if (!fresh.exists || fresh.data().status !== "scheduled") return false;
      transaction.update(item.ref, { status: "queued", queuedAt: new Date(), updatedAt: new Date() });
      return true;
    });
    if (!claimed) continue;
    const delivery = { id: item.id, ...item.data() };
    try {
      const reportSnapshot = await adminDb.collection("monthlyReports").doc(delivery.reportId).get();
      if (!reportSnapshot.exists) throw new Error("Monthly report was not found.");
      const report = { id: reportSnapshot.id, ...reportSnapshot.data() };
      const actor = {
        uid: delivery.createdByUid || "system",
        id: delivery.createdByUid || "system",
        role: "super_admin",
        fullName: delivery.createdByName || "GrowVest Delivery Scheduler",
        email: ""
      };
      const result = await sendReportDelivery({ report, actor, payload: delivery, deliveryId: item.id });
      results.push({ deliveryId: item.id, status: result.status });
    } catch (error) {
      await item.ref.set({ status: "failed", failedAt: new Date(), failureReason: error.message, updatedAt: new Date() }, { merge: true });
      results.push({ deliveryId: item.id, status: "failed", error: error.message });
    }
  }
  return NextResponse.json({ success: true, processed: results.length, results });
}

export async function GET(request) {
  try { return await run(request); }
  catch (error) {
    console.error("Scheduled report delivery cron failed", error);
    return NextResponse.json({ error: error.message || "Scheduled delivery processing failed." }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
