import { NextResponse } from "next/server";
import { adminDb, canStaffAccessRecord, verifyStaffRequest } from "@/lib/server/firebaseAdmin";

function serialise(value) {
  if (value === null || value === undefined) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialise(item)]));
  }
  return value;
}

function timeValue(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const [reportSnapshot, deliverySnapshot, logSnapshot] = await Promise.all([
      adminDb.collection("monthlyReports").orderBy("updatedAt", "desc").limit(500).get(),
      adminDb.collection("emailDeliveries").orderBy("updatedAt", "desc").limit(700).get(),
      adminDb.collection("communicationLogs").where("channel", "==", "email").limit(700).get()
    ]);

    const reports = reportSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => canStaffAccessRecord(actor, item));
    const reportMap = new Map(reports.map((item) => [item.id, item]));

    const deliveries = deliverySnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => {
        const report = reportMap.get(item.reportId);
        return report ? canStaffAccessRecord(actor, report) : (["super_admin", "admin"].includes(actor.role) || item.advisorUid === actor.uid);
      })
      .sort((a, b) => timeValue(b.updatedAt || b.createdAt) - timeValue(a.updatedAt || a.createdAt));

    const deliveryByReport = new Map();
    deliveries.forEach((item) => {
      if (item.reportId && !deliveryByReport.has(item.reportId) && !item.testMode) deliveryByReport.set(item.reportId, item);
    });

    const legacyLogs = logSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.reportId && reportMap.has(item.reportId) && !item.deliveryId)
      .sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));

    const rows = reports.map((report) => {
      const delivery = deliveryByReport.get(report.id);
      const legacy = !delivery ? legacyLogs.find((item) => item.reportId === report.id) : null;
      const latest = delivery || (legacy ? {
        id: `legacy-${legacy.id}`,
        reportId: report.id,
        status: legacy.status || report.lastEmailStatus || "pending",
        recipientEmail: legacy.recipientEmail || report.investorEmail || "",
        sentAt: legacy.sentAt || legacy.createdAt || report.lastEmailAttemptAt || null,
        updatedAt: legacy.updatedAt || legacy.createdAt || null,
        subject: legacy.subject || "Monthly Wealth Report",
        failureReason: legacy.failureReason || report.lastEmailError || null,
        providerMessageId: legacy.providerMessageId || report.lastEmailMessageId || null,
        legacy: true
      } : null);
      return {
        id: report.id,
        reportId: report.id,
        reportCode: report.reportCode || "",
        reportTitle: report.title || "Monthly Wealth Report",
        reportMonthKey: report.reportMonthKey || "",
        reportMonth: report.reportMonth || null,
        reportYear: report.reportYear || null,
        reportStatus: report.status || "draft",
        publicationStatus: report.publicationStatus || (report.investorVisible ? "published" : "internal"),
        investorVisible: Boolean(report.investorVisible),
        investorId: report.investorId || null,
        investorName: report.investorName || "",
        clientCode: report.clientCode || "",
        investorEmail: report.investorEmail || "",
        advisorUid: report.advisorUid || null,
        advisorName: report.advisorName || "",
        pdfStoragePath: report.pdfStoragePath || null,
        pdfFileName: report.pdfFileName || null,
        pdfSizeBytes: report.pdfSizeBytes || null,
        lastEmailStatus: latest?.status || report.lastEmailStatus || (report.investorVisible ? "pending" : "not_ready"),
        lastEmailAttemptAt: latest?.sentAt || latest?.updatedAt || report.lastEmailAttemptAt || null,
        lastEmailError: latest?.failureReason || report.lastEmailError || null,
        latestDelivery: latest || null,
        createdAt: report.createdAt || null,
        updatedAt: report.updatedAt || null
      };
    }).sort((a, b) => String(b.reportMonthKey || "").localeCompare(String(a.reportMonthKey || "")) || timeValue(b.updatedAt) - timeValue(a.updatedAt));

    const cleanDeliveries = deliveries.map(({ htmlPreview: _htmlPreview, textPreview: _textPreview, ...item }) => item);

    return NextResponse.json({
      success: true,
      rows: serialise(rows),
      deliveries: serialise(cleanDeliveries),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Email delivery list failed", error);
    return NextResponse.json({ error: error.message || "Unable to load report delivery records." }, { status: 500 });
  }
}
