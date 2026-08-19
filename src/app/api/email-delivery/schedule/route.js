import { NextResponse } from "next/server";
import { verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { createScheduledDelivery, loadDeliveryReport } from "@/lib/server/reportDelivery";

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const payload = await request.json();
    if (!payload.reportId) return NextResponse.json({ error: "Report ID is required." }, { status: 400 });
    const report = await loadDeliveryReport(payload.reportId, actor);
    const result = await createScheduledDelivery({ report, actor, payload });
    return NextResponse.json({ success: true, delivery: { ...result, scheduledFor: result.scheduledFor.toISOString() } });
  } catch (error) {
    console.error("Report scheduling failed", error);
    return NextResponse.json({ error: error.message || "Unable to schedule the report email." }, { status: appRequestErrorStatus(error, 500) });
  }
}
