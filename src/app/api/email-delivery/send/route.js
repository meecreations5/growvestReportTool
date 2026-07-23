import { NextResponse } from "next/server";
import { verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { loadDeliveryReport, sendReportDelivery } from "@/lib/server/reportDelivery";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const payload = await request.json();
    if (!payload.reportId) return NextResponse.json({ error: "Report ID is required." }, { status: 400 });
    const report = await loadDeliveryReport(payload.reportId, actor);
    const result = await sendReportDelivery({
      report,
      actor,
      payload,
      deliveryId: payload.deliveryId || "",
      testMode: false
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Report delivery failed", error);
    return NextResponse.json({ error: error.message || "Unable to send the report email." }, { status: 500 });
  }
}
