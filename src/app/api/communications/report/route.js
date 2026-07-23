import { NextResponse } from "next/server";
import { verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { loadDeliveryReport, sendReportDelivery } from "@/lib/server/reportDelivery";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { reportId } = await request.json();
    if (!reportId) return NextResponse.json({ error: "Report ID is required." }, { status: 400 });
    const report = await loadDeliveryReport(reportId, actor);
    const result = await sendReportDelivery({ report, actor, payload: {}, testMode: false });
    return NextResponse.json({ success: true, status: result.status, messageId: result.messageId || null, deliveryId: result.id });
  } catch (error) {
    console.error("Report communication failed", error);
    return NextResponse.json({ error: error.message || "Unable to send report communication." }, { status: 500 });
  }
}
