import { NextResponse } from "next/server";
import { adminDb, canStaffAccessRecord, verifyStaffRequest } from "@/lib/server/firebaseAdmin";
import { getAdvisorEmailProfile, getServerBranding } from "@/lib/server/settingsServer";
import { generateMomPdf } from "@/lib/server/momPdf";

export const runtime = "nodejs";

function cleanFilePart(value = "") {
  return String(value || "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "MOM";
}

export async function GET(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { momId } = await params;
    const snapshot = await adminDb.collection("meetingMinutes").doc(momId).get();
    if (!snapshot.exists) return NextResponse.json({ error: "MOM was not found." }, { status: 404 });

    const mom = { id: snapshot.id, ...snapshot.data() };
    if (!canStaffAccessRecord(actor, mom)) {
      return NextResponse.json({ error: "You are not authorised to download this MOM." }, { status: 403 });
    }

    const branding = await getServerBranding();
    const advisor = await getAdvisorEmailProfile(mom.advisorUid, {
      fullName: mom.advisorName,
      email: mom.advisorEmail,
      designation: mom.advisorDesignation || "",
      mobile: mom.advisorMobile || ""
    });
    const pdfBytes = await generateMomPdf(mom, { branding, advisor });
    const fileName = `${cleanFilePart(mom.momCode || mom.meetingTitle || "GrowVest-MOM")}.pdf`;

    await adminDb.collection("activityLogs").add({
      recordType: "meeting",
      recordId: mom.meetingId,
      meetingId: mom.meetingId,
      momId,
      investorId: mom.investorId || null,
      advisorUid: mom.advisorUid || actor.uid,
      assignedAdvisorUid: mom.advisorUid || actor.uid,
      action: "mom_pdf_downloaded",
      title: "MOM PDF downloaded",
      description: `${fileName} was generated for download by ${actor.fullName || actor.email || "a staff user"}.`,
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      createdAt: new Date()
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName.replace(/\"/g, "")}"`,
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    console.error("MOM PDF download failed", error);
    const message = error.message || "Unable to generate the MOM PDF.";
    return NextResponse.json({ error: message }, { status: message.includes("authorised") ? 403 : 500 });
  }
}
