import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyAppRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { buildInvestorStatusSummary } from "@/lib/investor/profileStatus";

export const runtime = "nodejs";

function authorized(actor, investorId, investor) {
  if (["super_admin", "admin"].includes(actor.role)) return true;
  if (actor.role === "advisor" && [investor.assignedAdvisorUid, investor.advisorUid].includes(actor.uid)) return true;
  if (actor.role === "investor" && actor.investorId === investorId) return true;
  return false;
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyAppRequest(request);
    const { investorId } = await params;
    const investorRef = adminDb.collection("investors").doc(String(investorId || ""));
    const investorSnapshot = await investorRef.get();
    if (!investorSnapshot.exists) return Response.json({ error: "Investor was not found." }, { status: 404 });
    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    if (!authorized(actor, investor.id, investor)) return Response.json({ error: "You are not authorised to refresh this investor status." }, { status: 403 });

    const documentsSnapshot = await adminDb.collection("investorDocuments").where("investorId", "==", investor.id).get();
    const documents = documentsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const summary = buildInvestorStatusSummary(investor, documents);
    await investorRef.set({
      profileStatus: summary.profile.status,
      profileCompletionPercent: summary.profile.percent,
      kycStatus: summary.kyc.status,
      documentStatusSummary: {
        status: summary.documents.status,
        requiredCount: summary.documents.requiredCount,
        uploadedCount: summary.documents.uploadedCount,
        verifiedCount: summary.documents.verifiedCount,
        attentionCount: summary.documents.attentionCount,
        missingTypes: summary.documents.missingTypes
      },
      statusSummaryUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return Response.json({ summary });
  } catch (error) {
    console.error("Investor status refresh failed", error);
    return Response.json({ error: error?.message || "Unable to refresh investor status." }, { status: appRequestErrorStatus(error, 500) });
  }
}
