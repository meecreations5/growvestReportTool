import { NextResponse } from "next/server";
import { adminDb, canStaffAccessRecord, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { getAdvisorEmailProfile, getServerBranding } from "@/lib/server/settingsServer";
import { buildInvestorMomWhatsAppMessage } from "@/lib/utils/meetingMessages";
import { renderWhatsAppSignatureText } from "@/lib/utils/emailSignature";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { momId } = await request.json();
    if (!momId) return NextResponse.json({ error: "MOM ID is required." }, { status: 400 });

    const snapshot = await adminDb.collection("meetingMinutes").doc(momId).get();
    if (!snapshot.exists) return NextResponse.json({ error: "MOM was not found." }, { status: 404 });

    const mom = { id: snapshot.id, ...snapshot.data() };
    if (!canStaffAccessRecord(actor, mom)) {
      return NextResponse.json({ error: "You are not authorised to prepare this MOM message." }, { status: 403 });
    }
    if (!mom.investorMobile) {
      return NextResponse.json({ error: "Investor mobile number is missing." }, { status: 422 });
    }

    const branding = await getServerBranding();
    const advisor = await getAdvisorEmailProfile(mom.advisorUid, {
      fullName: mom.advisorName,
      email: mom.advisorEmail,
      designation: mom.advisorDesignation || "",
      mobile: mom.advisorMobile || ""
    });
    const signature = advisor.emailSignature || {};
    const signatureText = renderWhatsAppSignatureText({ signature, user: advisor, branding });
    const message = buildInvestorMomWhatsAppMessage(mom, { signatureText });

    return NextResponse.json({
      success: true,
      mobile: mom.investorMobile,
      message,
      signatureSource: advisor.emailSignature ? "published_advisor_signature" : "advisor_profile_with_branding"
    });
  } catch (error) {
    console.error("MOM WhatsApp preparation failed", error);
    return NextResponse.json({ error: error.message || "Unable to prepare MOM WhatsApp message." }, { status: appRequestErrorStatus(error, 500) });
  }
}
