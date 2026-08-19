import { NextResponse } from "next/server";
import { verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { verifyBrevoConnection } from "@/lib/server/brevoMailer";

export async function GET(request) {
  try {
    await verifyStaffRequest(request);
    const result = await verifyBrevoConnection();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || "Email service check failed." }, { status: appRequestErrorStatus(error, 500) });
  }
}
