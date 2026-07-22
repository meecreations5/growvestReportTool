import { NextResponse } from "next/server";
import { verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { sendTransactionalEmail } from "@/lib/server/brevoMailer";

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!actor.email) {
      return NextResponse.json({ error: "Your staff profile does not contain an email address." }, { status: 422 });
    }

    const result = await sendTransactionalEmail({
      to: [{ name: actor.fullName || "GrowVest User", address: actor.email }],
      subject: "GrowVest Brevo email test",
      text: "Your GrowVest Brevo SMTP configuration is working.",
      html: "<p>Your <strong>GrowVest Brevo SMTP configuration</strong> is working.</p>",
      advisor: { fullName: actor.fullName, email: actor.email }
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Test email could not be sent." }, { status: 500 });
  }
}
