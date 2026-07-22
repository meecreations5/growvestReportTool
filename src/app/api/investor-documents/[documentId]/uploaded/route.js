import { NextResponse } from "next/server";
import { adminDb, verifyAppRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const actor = await verifyAppRequest(request);
    const { documentId } = await params;
    const snapshot = await adminDb.collection("investorDocuments").doc(documentId).get();
    if (!snapshot.exists) return NextResponse.json({ error: "Document record was not found." }, { status: 404 });
    const documentRecord = { id: snapshot.id, ...snapshot.data() };
    const isAdmin = ["super_admin", "admin"].includes(actor.role);
    const isAdvisor = actor.role === "advisor" && documentRecord.advisorUid === actor.uid;
    const isInvestor = actor.role === "investor" && actor.investorId === documentRecord.investorId;
    if (!isAdmin && !isAdvisor && !isInvestor) return NextResponse.json({ error: "You are not authorised to update this document." }, { status: 403 });

    if (documentRecord.advisorUid && documentRecord.advisorUid !== actor.uid) {
      await adminDb.collection("notifications").add({
        recipientUid: documentRecord.advisorUid,
        recipientType: "advisor",
        title: "Investor document uploaded",
        message: `${documentRecord.investorName || "Investor"} uploaded ${documentRecord.title || documentRecord.fileName || "a document"}.`,
        eventType: "investor_document_uploaded",
        link: `/investors/${documentRecord.investorId}`,
        investorId: documentRecord.investorId,
        documentId,
        createdByUid: actor.uid,
        status: "unread",
        createdAt: new Date(),
        readAt: null
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document upload notification failed", error);
    return NextResponse.json({ error: error.message || "Unable to notify the Advisor." }, { status: 500 });
  }
}
