import { NextResponse } from "next/server";
import { adminDb, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { sendTransactionalEmail } from "@/lib/server/brevoMailer";
import { getServerBranding, getServerCommunicationSettings } from "@/lib/server/settingsServer";
import { renderEmailSignatureHtml } from "@/lib/utils/emailSignature";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { userId = actor.uid, useDraft = true } = await request.json();
    const isAdmin = ["super_admin", "admin"].includes(actor.role);
    if (userId !== actor.uid && !isAdmin) {
      return NextResponse.json({ error: "You can send a test only for your own signature." }, { status: 403 });
    }

    const snapshot = await adminDb.collection("users").doc(userId).get();
    if (!snapshot.exists) return NextResponse.json({ error: "Staff user was not found." }, { status: 404 });
    const staff = { id: snapshot.id, ...snapshot.data() };
    if (!actor.email) return NextResponse.json({ error: "Your staff profile does not contain an email address." }, { status: 422 });

    const branding = await getServerBranding();
    const communicationSettings = await getServerCommunicationSettings();
    const signature = useDraft ? (staff.emailSignatureDraft || staff.emailSignature || {}) : (staff.emailSignature || {});
    const signatureHtml = renderEmailSignatureHtml({ signature, user: staff, branding });
    const html = `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px"><table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#fff;border:1px solid #e4e9f2;border-radius:16px"><tr><td style="padding:28px"><h2 style="margin:0 0 12px">GrowVest email signature preview</h2><p style="margin:0;color:#667085;line-height:1.7">This test shows how ${staff.fullName || "the staff member"}'s ${useDraft ? "draft" : "published"} signature will appear in outgoing communication.</p>${signatureHtml}</td></tr></table></td></tr></table></body></html>`;

    const advisor = {
      ...staff,
      companyName: branding.companyName,
      defaultSenderName: communicationSettings.senderName,
      defaultSenderEmail: communicationSettings.senderEmail,
      replyToEmail: communicationSettings.replyToEmail
    };
    const result = await sendTransactionalEmail({
      to: [{ name: actor.fullName || "GrowVest User", address: actor.email }],
      subject: `[TEST] ${staff.fullName || "GrowVest"} email signature`,
      html,
      text: `GrowVest email signature preview for ${staff.fullName || "staff user"}.`,
      advisor
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Signature test email failed", error);
    return NextResponse.json({ error: error.message || "Signature test email could not be sent." }, { status: appRequestErrorStatus(error, 500) });
  }
}
